const fs = require('node:fs');
const path = require('node:path');
const { Writable } = require('node:stream');

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_FILES = 4;
const DEFAULT_MAX_AGE_DAYS = 14;

function boundedInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function safeRawMetadata(payload = {}) {
  try {
    const parsed = JSON.parse(`${payload.raw_json || ''}`);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function buildSafePayloadLog(payload = {}) {
  const raw = safeRawMetadata(payload);
  return {
    source: `${payload.source || ''}`,
    messageType: `${raw.messageType || ''}`,
    textLength: `${payload.message_text || ''}`.length,
    fromMe: Boolean(payload.from_me ?? raw.fromMe),
  };
}

function buildSafeDashboardResponseLog(response = {}) {
  const data = response.data;
  return {
    status: Number(response.status) || 0,
    contentType: `${response.headers?.['content-type'] || ''}`,
    success: data?.success === true,
    responseKeys: data && typeof data === 'object' && !Array.isArray(data)
      ? Object.keys(data).sort()
      : [],
  };
}

class RotatingLogStream extends Writable {
  constructor({
    filePath,
    maxBytes = DEFAULT_MAX_BYTES,
    maxFiles = DEFAULT_MAX_FILES,
    maxAgeDays = DEFAULT_MAX_AGE_DAYS,
    now = () => Date.now(),
  } = {}) {
    super();
    if (!filePath) throw new Error('filePath is required for bridge logging');

    this.filePath = filePath;
    this.maxBytes = boundedInteger(maxBytes, DEFAULT_MAX_BYTES, { min: 1024 });
    this.maxFiles = boundedInteger(maxFiles, DEFAULT_MAX_FILES, { min: 1, max: 20 });
    this.maxAgeMs = boundedInteger(maxAgeDays, DEFAULT_MAX_AGE_DAYS, { min: 1, max: 365 })
      * 24 * 60 * 60 * 1000;
    this.now = now;

    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.pruneExpired();
    this.currentBytes = fs.existsSync(this.filePath) ? fs.statSync(this.filePath).size : 0;
  }

  rotatedPath(index) {
    return `${this.filePath}.${index}`;
  }

  pruneExpired() {
    const cutoff = this.now() - this.maxAgeMs;
    for (let index = 1; index <= this.maxFiles; index += 1) {
      const candidate = this.rotatedPath(index);
      if (!fs.existsSync(candidate)) continue;
      if (fs.statSync(candidate).mtimeMs < cutoff) {
        fs.unlinkSync(candidate);
      }
    }
  }

  rotate() {
    const oldest = this.rotatedPath(this.maxFiles);
    if (fs.existsSync(oldest)) fs.unlinkSync(oldest);

    for (let index = this.maxFiles - 1; index >= 1; index -= 1) {
      const source = this.rotatedPath(index);
      if (fs.existsSync(source)) fs.renameSync(source, this.rotatedPath(index + 1));
    }

    if (fs.existsSync(this.filePath)) {
      fs.renameSync(this.filePath, this.rotatedPath(1));
    }
    this.pruneExpired();
    this.currentBytes = 0;
  }

  _write(chunk, encoding, callback) {
    try {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
      if (this.currentBytes > 0 && this.currentBytes + buffer.length > this.maxBytes) {
        this.rotate();
      }
      fs.appendFileSync(this.filePath, buffer);
      this.currentBytes += buffer.length;
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

function createBridgeLogStream({ env = process.env, baseDir = __dirname, now } = {}) {
  const configuredPath = `${env.BRIDGE_LOG_PATH || ''}`.trim();
  const filePath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(baseDir, configuredPath || 'logs/bridge.log');

  return new RotatingLogStream({
    filePath,
    maxBytes: env.BRIDGE_LOG_MAX_BYTES,
    maxFiles: env.BRIDGE_LOG_MAX_FILES,
    maxAgeDays: env.BRIDGE_LOG_MAX_AGE_DAYS,
    now,
  });
}

module.exports = {
  DEFAULT_MAX_AGE_DAYS,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_FILES,
  RotatingLogStream,
  buildSafeDashboardResponseLog,
  buildSafePayloadLog,
  createBridgeLogStream,
};
