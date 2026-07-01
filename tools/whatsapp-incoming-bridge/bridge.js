#!/usr/bin/env node

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const axios = require('axios');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const P = require('pino');
const qrcode = require('qrcode-terminal');

const DEFAULT_DASHBOARD_URL = 'https://first-chord-dashbord-production.up.railway.app';

function loadLocalEnv(filePath = path.join(__dirname, '.env')) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && typeof process.env[key] === 'undefined') {
      process.env[key] = value;
    }
  }
}

function clean(value = '') {
  return `${value ?? ''}`.trim();
}

function expandHome(input = '') {
  if (input === '~') return os.homedir();
  if (input.startsWith('~/')) return path.join(os.homedir(), input.slice(2));
  return input;
}

function resolveLocalPath(input = '', basePath = process.cwd()) {
  const expanded = expandHome(clean(input));
  return path.isAbsolute(expanded) ? expanded : path.resolve(basePath, expanded);
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
    loadLocalEnv();
    this.dashboardUrl = clean(options.dashboardUrl || process.env.DASHBOARD_BASE_URL || DEFAULT_DASHBOARD_URL).replace(/\/$/u, '');
    this.webhookUrl = clean(options.webhookUrl || process.env.INCOMING_MESSAGE_WEBHOOK_URL)
      || `${this.dashboardUrl}/api/admin/incoming-messages`;
    this.webhookSecret = clean(options.webhookSecret || process.env.INCOMING_MESSAGE_INGEST_SECRET);
    this.authDir = expandHome(clean(options.authDir || process.env.BAILEYS_AUTH_DIR || './auth_info_baileys'));
    this.captureName = clean(options.captureName || process.env.WHATSAPP_CAPTURED_BY || 'Finn');
    this.maxCachedMessages = Math.max(100, Number(process.env.WHATSAPP_CACHE_LIMIT || 2000) || 2000);
    const maxCacheAgeDays = Math.max(1, Number(process.env.WHATSAPP_CACHE_MAX_AGE_DAYS || 14) || 14);
    this.maxCacheAgeMs = maxCacheAgeDays * 24 * 60 * 60 * 1000;
    this.cachePath = resolveLocalPath(process.env.WHATSAPP_CACHE_PATH || './cache/recent-messages.json');
    this.cacheSaveTimer = null;
    this.writeStarredLog = parseBoolean(process.env.WRITE_STARRED_LOG);
    this.dryRun = parseBoolean(process.env.DRY_RUN);
    this.logger = P({ level: process.env.LOG_LEVEL || 'info' });
    this.sock = null;
    this.recentMessages = new Map();
    this.sentMessageIds = new Set();
    this.loadMessageCache();
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

  loadMessageCache() {
    if (!fs.existsSync(this.cachePath)) return;

    try {
      const parsed = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
      const rows = Array.isArray(parsed) ? parsed : parsed?.messages;
      if (!Array.isArray(rows)) return;

      for (const row of rows) {
        const cacheKey = clean(row?.cacheKey) || messageCacheKey({ remoteJid: row?.chatId, id: row?.messageId });
        if (!cacheKey || !row?.messageId || !row?.chatId) continue;
        this.recentMessages.set(cacheKey, { ...row, cacheKey });
      }
      this.trimCache({ persist: false });
      this.logInfo('Loaded WhatsApp message cache', {
        cachePath: this.cachePath,
        cachedMessages: this.recentMessages.size,
      });
    } catch (error) {
      this.logWarn('Could not load WhatsApp message cache', { cachePath: this.cachePath, error: error.message });
    }
  }

  trimCache({ persist = true } = {}) {
    const now = Date.now();
    let changed = false;
    for (const [key, value] of this.recentMessages.entries()) {
      const cachedAt = Date.parse(value.cachedAt || value.messageAt || '');
      if (Number.isFinite(cachedAt) && now - cachedAt > this.maxCacheAgeMs) {
        this.recentMessages.delete(key);
        changed = true;
      }
    }

    while (this.recentMessages.size > this.maxCachedMessages) {
      const firstKey = this.recentMessages.keys().next().value;
      this.recentMessages.delete(firstKey);
      changed = true;
    }

    if (changed && persist) {
      this.scheduleCacheSave();
    }
  }

  scheduleCacheSave() {
    if (this.cacheSaveTimer) return;
    this.cacheSaveTimer = setTimeout(() => {
      this.cacheSaveTimer = null;
      this.saveMessageCache();
    }, 750);
    this.cacheSaveTimer.unref?.();
  }

  saveMessageCache() {
    if (this.cacheSaveTimer) {
      clearTimeout(this.cacheSaveTimer);
      this.cacheSaveTimer = null;
    }

    try {
      fs.mkdirSync(path.dirname(this.cachePath), { recursive: true });
      const payload = {
        savedAt: nowIso(),
        messages: Array.from(this.recentMessages.values()),
      };
      const tempPath = `${this.cachePath}.tmp`;
      fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`);
      fs.renameSync(tempPath, this.cachePath);
    } catch (error) {
      this.logWarn('Could not save WhatsApp message cache', { cachePath: this.cachePath, error: error.message });
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
    const cacheKey = messageCacheKey(message.key);
    const cached = {
      cacheKey,
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

    this.recentMessages.set(cacheKey, cached);
    this.trimCache();
    this.scheduleCacheSave();
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
    const latest = Array.isArray(response.data?.inbox) ? response.data.inbox[0] : null;
    this.logInfo('Posted incoming message to dashboard', {
      status: response.status,
      messageId: payload.external_message_id,
      contentType: response.headers?.['content-type'] || '',
      success: response.data?.success,
      responseKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : [],
      responsePreview: typeof response.data === 'string' ? response.data.slice(0, 120) : '',
      inboxCount: Array.isArray(response.data?.inbox) ? response.data.inbox.length : null,
      latestText: latest?.messageText ? `${latest.messageText}`.slice(0, 80) : '',
      latestCategory: latest?.suspectedCategory || '',
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

  async sendGroupSync(groups = []) {
    if (this.dryRun) {
      this.logInfo('Dry run group sync', { groupCount: groups.length, sample: groups.slice(0, 5) });
      return { dryRun: true, groups };
    }

    const response = await axios.post(this.webhookUrl, { mode: 'sync_groups', groups }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-firstchord-incoming-secret': this.webhookSecret,
      },
    });
    this.logInfo('Posted group sync to dashboard', {
      status: response.status,
      groupsSent: groups.length,
      summary: response.data?.groupSyncSummary || null,
    });
    return response.data;
  }

  // One-shot: connect, let chat history settle so we know last-active times,
  // enumerate every group the account is in (metadata only), and post them.
  // WhatsApp frequently closes the first connection ("restart required", 515)
  // or drops briefly, so this reconnects on any non-logout close and only
  // settles the promise once — on a successful sync or after max attempts.
  async runGroupSync({
    waitMs = Number(process.env.GROUP_SYNC_WAIT_MS || 8000) || 8000,
    maxAttempts = Number(process.env.GROUP_SYNC_MAX_ATTEMPTS || 6) || 6,
  } = {}) {
    this.validateConfig();
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();
    const chatTimestamps = new Map();
    let attempts = 0;
    let settled = false;

    return new Promise((resolve, reject) => {
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        fn(value);
      };

      const recordChats = (chats = []) => {
        for (const chat of chats) {
          const ts = Number(chat.conversationTimestamp || 0);
          if (chat.id && ts) chatTimestamps.set(chat.id, ts);
        }
      };

      const start = () => {
        attempts += 1;
        const sock = makeWASocket({
          version,
          auth: state,
          logger: P({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' }),
          browser: ['First Chord Incoming Bridge', 'Chrome', '121.0'],
          markOnlineOnConnect: false,
          keepAliveIntervalMs: 25000,
          connectTimeoutMs: 60000,
          defaultQueryTimeoutMs: 60000,
        });
        this.sock = sock;
        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('messaging-history.set', ({ chats = [] }) => recordChats(chats));
        sock.ev.on('chats.set', ({ chats = [] }) => recordChats(chats));
        sock.ev.on('chats.upsert', (chats = []) => recordChats(chats));

        sock.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr } = update;
          if (qr) {
            console.log('\nScan this QR code from WhatsApp Linked Devices:\n');
            qrcode.generate(qr, { small: true });
          }

          if (connection === 'close') {
            if (settled) return;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode === DisconnectReason.loggedOut) {
              finish(reject, new Error('WhatsApp session logged out — re-link the device and try again'));
              return;
            }
            if (attempts >= maxAttempts) {
              finish(reject, new Error(`WhatsApp connection kept closing (last status ${statusCode ?? 'unknown'}) after ${attempts} attempts`));
              return;
            }
            this.logWarn('Connection closed, reconnecting', { statusCode, attempt: attempts });
            setTimeout(() => {
              try { start(); } catch (error) { finish(reject, error); }
            }, 2000);
            return;
          }

          if (connection !== 'open') return;

          try {
            this.logInfo('Connected — letting chat history settle before syncing groups', { waitMs, attempt: attempts });
            await new Promise((done) => setTimeout(done, waitMs));

            const participating = await sock.groupFetchAllParticipating();
            const groups = Object.values(participating || {}).map((meta) => {
              const ts = chatTimestamps.get(meta.id);
              const participantPhones = (meta.participants || [])
                .filter((participant) => `${participant.id || ''}`.endsWith('@s.whatsapp.net'))
                .map((participant) => phoneFromJid(participant.id))
                .filter(Boolean);
              return {
                chatId: meta.id,
                chatName: meta.subject || '',
                participantPhones,
                lastActiveAt: ts ? new Date(ts * 1000).toISOString() : '',
              };
            });

            this.logInfo('Fetched participating groups', { groupCount: groups.length });
            const result = await this.sendGroupSync(groups);
            finish(resolve, result);
            try { sock.end(); } catch { /* ignore */ }
          } catch (error) {
            // A dropped connection surfaces here as a query error — let the
            // close handler reconnect and retry rather than failing outright.
            this.logWarn('Group fetch failed; will retry on reconnect', { error: error.message, attempt: attempts });
            try { sock.end(new Error('retry group sync')); } catch { /* ignore */ }
          }
        });
      };

      start();
    });
  }
}

async function main() {
  const bridge = new WhatsAppIncomingBridge();
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      bridge.saveMessageCache();
      process.exit(0);
    });
  }
  const testIndex = process.argv.indexOf('--send-test');
  if (testIndex !== -1) {
    const text = process.argv.slice(testIndex + 1).join(' ').trim() || 'Alex is away next Friday';
    await bridge.sendTestPayload(text);
    return;
  }
  if (process.argv.includes('--sync-groups')) {
    const result = await bridge.runGroupSync();
    console.log('Group sync complete:', JSON.stringify(result?.groupSyncSummary || result || {}, null, 2));
    process.exit(0);
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
