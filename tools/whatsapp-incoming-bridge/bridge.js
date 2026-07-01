#!/usr/bin/env node

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const axios = require('axios');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const P = require('pino');
const qrcode = require('qrcode-terminal');

const DEFAULT_DASHBOARD_URL = 'https://first-chord-dashbord-production.up.railway.app';

function clean(value = '') {
  return `${value ?? ''}`.trim();
}

function expandHome(input = '') {
  if (input === '~') return os.homedir();
  if (input.startsWith('~/')) return path.join(os.homedir(), input.slice(2));
  return input;
}

function parseBoolean(value = '') {
  return ['1', 'true', 'yes', 'on'].includes(clean(value).toLowerCase());
}

function nowIso() {
  return new Date().toISOString();
}

function phoneFromJid(jid = '') {
  const id = clean(jid).split('@')[0].split(':')[0];
  return id && /^\d+$/u.test(id) ? `+${id}` : '';
}

function messageCacheKey(key = {}) {
  return `${key.remoteJid || ''}::${key.id || ''}`;
}

function extractMessageContent(message = {}) {
  const content = message.message || message;
  const text = content?.conversation
    || content?.extendedTextMessage?.text
    || content?.imageMessage?.caption
    || content?.videoMessage?.caption
    || content?.documentMessage?.caption
    || content?.buttonsResponseMessage?.selectedDisplayText
    || content?.listResponseMessage?.title
    || '';

  return {
    text: clean(text),
    type: content?.conversation ? 'text'
      : content?.extendedTextMessage ? 'extended_text'
        : content?.imageMessage ? 'image'
          : content?.videoMessage ? 'video'
            : content?.audioMessage ? 'audio'
              : content?.documentMessage ? 'document'
                : content?.stickerMessage ? 'sticker'
                  : 'unknown',
  };
}

class WhatsAppIncomingBridge {
  constructor(options = {}) {
    this.dashboardUrl = clean(options.dashboardUrl || process.env.DASHBOARD_BASE_URL || DEFAULT_DASHBOARD_URL).replace(/\/$/u, '');
    this.webhookUrl = clean(options.webhookUrl || process.env.INCOMING_MESSAGE_WEBHOOK_URL)
      || `${this.dashboardUrl}/api/admin/incoming-messages`;
    this.webhookSecret = clean(options.webhookSecret || process.env.INCOMING_MESSAGE_INGEST_SECRET);
    this.authDir = expandHome(clean(options.authDir || process.env.BAILEYS_AUTH_DIR || './auth_info_baileys'));
    this.captureName = clean(options.captureName || process.env.WHATSAPP_CAPTURED_BY || 'Finn');
    this.maxCachedMessages = Number(process.env.WHATSAPP_CACHE_LIMIT || 2000);
    this.writeStarredLog = parseBoolean(process.env.WRITE_STARRED_LOG);
    this.dryRun = parseBoolean(process.env.DRY_RUN);
    this.logger = P({ level: process.env.LOG_LEVEL || 'info' });
    this.sock = null;
    this.recentMessages = new Map();
    this.sentMessageIds = new Set();
  }

  validateConfig() {
    if (!this.webhookUrl) {
      throw new Error('INCOMING_MESSAGE_WEBHOOK_URL or DASHBOARD_BASE_URL is required');
    }
    if (!this.webhookSecret && !this.dryRun) {
      throw new Error('INCOMING_MESSAGE_INGEST_SECRET is required unless DRY_RUN=true');
    }
  }

  logInfo(message, data = {}) {
    this.logger.info(data, message);
  }

  logWarn(message, data = {}) {
    this.logger.warn(data, message);
  }

  logError(message, data = {}) {
    this.logger.error(data, message);
  }

  trimCache() {
    while (this.recentMessages.size > this.maxCachedMessages) {
      const firstKey = this.recentMessages.keys().next().value;
      this.recentMessages.delete(firstKey);
    }
  }

  async getChatName(chatId = '') {
    if (!chatId) return '';
    if (chatId.includes('@g.us') && this.sock) {
      try {
        const metadata = await this.sock.groupMetadata(chatId);
        return metadata?.subject || chatId;
      } catch {
        return 'WhatsApp group';
      }
    }
    if (chatId.includes('@s.whatsapp.net')) return 'Direct WhatsApp chat';
    return chatId;
  }

  cacheMessage(message) {
    if (!message?.key?.id || !message?.key?.remoteJid) return null;

    const { text, type } = extractMessageContent(message);
    const senderJid = message.key.fromMe ? 'me' : message.key.participant || message.key.remoteJid;
    const timestamp = Number(message.messageTimestamp || Date.now() / 1000);
    const cached = {
      messageId: message.key.id,
      chatId: message.key.remoteJid,
      senderName: message.pushName || '',
      senderJid,
      senderPhone: phoneFromJid(senderJid),
      messageText: text || '[Media or unsupported message]',
      messageType: type,
      messageAt: new Date(timestamp * 1000).toISOString(),
      fromMe: Boolean(message.key.fromMe),
      cachedAt: nowIso(),
    };

    this.recentMessages.set(messageCacheKey(message.key), cached);
    this.trimCache();
    return cached;
  }

  async buildPayload(data = {}) {
    const chatName = data.chatName || await this.getChatName(data.chatId);
    return {
      source: 'whatsapp_starred',
      external_message_id: data.messageId || '',
      chat_id: data.chatId || '',
      chat_name: chatName || '',
      sender_name: data.senderName || data.senderJid || '',
      sender_phone: data.senderPhone || phoneFromJid(data.senderJid || ''),
      message_text: data.messageText || '',
      message_at: data.messageAt || '',
      captured_at: nowIso(),
      captured_by: this.captureName,
      raw_json: JSON.stringify({
        messageId: data.messageId || '',
        messageType: data.messageType || '',
        fromMe: Boolean(data.fromMe),
        cacheHit: Boolean(data.cacheHit),
      }),
    };
  }

  async sendPayload(payload) {
    if (this.writeStarredLog) {
      const logDir = path.join(process.cwd(), 'logs');
      fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(path.join(logDir, 'starred-payloads.ndjson'), `${JSON.stringify(payload)}\n`);
    }

    if (this.dryRun) {
      this.logInfo('Dry run payload', { payload });
      return { dryRun: true };
    }

    const response = await axios.post(this.webhookUrl, payload, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'x-firstchord-incoming-secret': this.webhookSecret,
      },
    });
    this.logInfo('Posted incoming message to dashboard', {
      status: response.status,
      messageId: payload.external_message_id,
    });
    return response.data;
  }

  async handleStarredKey(key = {}) {
    const messageId = key.id || '';
    if (!messageId) return;
    if (this.sentMessageIds.has(messageId)) {
      this.logInfo('Ignoring duplicate starred event', { messageId });
      return;
    }

    const cached = this.recentMessages.get(messageCacheKey(key));
    const fallbackSenderJid = key.fromMe ? 'me' : key.participant || key.remoteJid || '';
    const payload = await this.buildPayload({
      messageId,
      chatId: key.remoteJid || '',
      senderJid: cached?.senderJid || fallbackSenderJid,
      senderName: cached?.senderName || '',
      senderPhone: cached?.senderPhone || phoneFromJid(fallbackSenderJid),
      messageText: cached?.messageText || '[Message content unavailable - star update arrived before cache]',
      messageType: cached?.messageType || 'starred_update',
      messageAt: cached?.messageAt || nowIso(),
      fromMe: Boolean(key.fromMe),
      cacheHit: Boolean(cached?.messageText),
    });

    await this.sendPayload(payload);
    this.sentMessageIds.add(messageId);
  }

  async handleStarredMessage(message) {
    const cached = this.cacheMessage(message) || {};
    await this.handleStarredKey({
      id: cached.messageId || message.key?.id,
      remoteJid: cached.chatId || message.key?.remoteJid,
      participant: cached.senderJid || message.key?.participant,
      fromMe: cached.fromMe || message.key?.fromMe,
    });
  }

  async connect() {
    this.validateConfig();
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    this.logInfo('Starting WhatsApp incoming bridge', {
      webhookUrl: this.webhookUrl,
      authDir: this.authDir,
      version: version.join('.'),
      isLatest,
      dryRun: this.dryRun,
    });

    this.sock = makeWASocket({
      version,
      auth: state,
      logger: P({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' }),
      browser: ['First Chord Incoming Bridge', 'Chrome', '121.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      markOnlineOnConnect: false,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        console.log('\nScan this QR code from WhatsApp Linked Devices:\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        this.logInfo('WhatsApp bridge connected');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        this.logWarn('WhatsApp bridge connection closed', { statusCode, shouldReconnect });
        if (shouldReconnect) {
          setTimeout(() => this.connect().catch((error) => this.logError('Reconnect failed', { error: error.message })), 5000);
        }
      }
    });

    this.sock.ev.on('messages.upsert', async ({ messages = [] }) => {
      for (const message of messages) {
        this.cacheMessage(message);
        if (message.starred) {
          await this.handleStarredMessage(message);
        }
      }
    });

    this.sock.ev.on('messages.update', async (updates = []) => {
      for (const update of updates) {
        if (update.update?.starred === true) {
          this.logInfo('Starred message detected', { messageId: update.key?.id, chatId: update.key?.remoteJid });
          await this.handleStarredKey(update.key || {});
        }
      }
    });
  }

  async sendTestPayload(text) {
    this.validateConfig();
    const payload = await this.buildPayload({
      messageId: `manual-test-${Date.now()}`,
      chatId: 'manual-test',
      chatName: 'Manual bridge test',
      senderName: 'Manual test',
      senderPhone: '',
      messageText: text,
      messageType: 'manual_test',
      messageAt: nowIso(),
      cacheHit: true,
    });
    return this.sendPayload(payload);
  }
}

async function main() {
  const bridge = new WhatsAppIncomingBridge();
  const testIndex = process.argv.indexOf('--send-test');
  if (testIndex !== -1) {
    const text = process.argv.slice(testIndex + 1).join(' ').trim() || 'Alex is away next Friday';
    await bridge.sendTestPayload(text);
    return;
  }
  await bridge.connect();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  WhatsAppIncomingBridge,
  extractMessageContent,
  phoneFromJid,
};
