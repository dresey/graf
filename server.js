const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const HOST = '127.0.0.1';
const PASSWORD = process.env.TEAM_PASSWORD || '';
const ALLOWED_ORIGINS = new Set((process.env.ALLOWED_ORIGINS || 'https://dresey.github.io').split(',').map(value => value.trim().replace(/\/$/, '')).filter(Boolean));
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'schedule.json');
const MAX_BODY = 1024 * 1024;
const SESSION_MS = 12 * 60 * 60 * 1000;
const sessions = new Map();
const failedLogins = new Map();
let store = { revision: 0, state: null };
let writeQueue = Promise.resolve();
let dirty = false;

function send(response, status, body, extraHeaders = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  response.end(JSON.stringify(body));
}

function corsHeaders(origin) {
  return ALLOWED_ORIGINS.has(origin) ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin'
  } : {};
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new Error('BODY_TOO_LARGE')); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (_) { reject(new Error('INVALID_JSON')); }
    });
    request.on('error', reject);
  });
}

function sessionKey(token) { return crypto.createHash('sha256').update(token).digest('hex'); }

function getSessionRecord(request) {
  const token = (request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const key = sessionKey(token);
  const session = sessions.get(key);
  if (!session || session.expiresAt <= Date.now()) { sessions.delete(key); return null; }
  session.expiresAt = Date.now() + SESSION_MS;
  return session;
}

function validState(value) {
  return value && typeof value === 'object' && Array.isArray(value.employees) && value.employees.length === 8 && value.weeks && typeof value.weeks === 'object' && value.history && typeof value.history === 'object';
}

async function saveStore() {
  const snapshot = JSON.stringify(store, null, 2);
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const temporaryFile = `${DATA_FILE}.${process.pid}.tmp`;
    await fs.writeFile(temporaryFile, snapshot, 'utf8');
    await fs.rename(temporaryFile, DATA_FILE);
  });
  return writeQueue;
}

async function handle(request, response) {
  const origin = request.headers.origin;
  const headers = corsHeaders(origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return send(response, 403, { error: 'ORIGIN_NOT_ALLOWED' });
  if (request.method === 'OPTIONS') {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return send(response, 403, { error: 'ORIGIN_NOT_ALLOWED' });
    response.writeHead(204, headers);
    return response.end();
  }
  const url = new URL(request.url, `http://${HOST}:${PORT}`);
  if (request.method === 'GET' && url.pathname === '/api/health') return send(response, 200, { ok: true }, headers);
  if ((url.pathname === '/api/login' || url.pathname === '/api/state') && !ALLOWED_ORIGINS.has(origin)) return send(response, 403, { error: 'ORIGIN_NOT_ALLOWED' });

  if (request.method === 'POST' && url.pathname === '/api/login') {
    const ip = request.socket.remoteAddress || 'unknown';
    const attempts = failedLogins.get(ip) || { count: 0, until: Date.now() + 15 * 60 * 1000 };
    if (attempts.until < Date.now()) { attempts.count = 0; attempts.until = Date.now() + 15 * 60 * 1000; }
    if (attempts.count >= 8) return send(response, 429, { error: 'TOO_MANY_ATTEMPTS', message: 'Слишком много попыток. Подождите 15 минут.' }, headers);
    let body;
    try { body = await readBody(request); } catch (error) { return send(response, error.message === 'BODY_TOO_LARGE' ? 413 : 400, { error: 'INVALID_REQUEST' }, headers); }
    const supplied = typeof body.password === 'string' ? body.password : '';
    const actualBuffer = Buffer.from(PASSWORD);
    const suppliedBuffer = Buffer.from(supplied);
    const matches = actualBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(actualBuffer, suppliedBuffer);
    if (!PASSWORD || !matches) {
      attempts.count++;
      failedLogins.set(ip, attempts);
      return send(response, 401, { error: 'INVALID_PASSWORD', message: 'Неверный пароль команды.' }, headers);
    }
    failedLogins.delete(ip);
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(sessionKey(token), { expiresAt: Date.now() + SESSION_MS });
    return send(response, 200, { token }, headers);
  }

  if (url.pathname.startsWith('/api/')) {
    if (!getSessionRecord(request)) return send(response, 401, { error: 'UNAUTHORIZED', message: 'Войдите снова.' }, headers);
    if (request.method === 'GET' && url.pathname === '/api/state') return send(response, 200, store, headers);
    if (request.method === 'PUT' && url.pathname === '/api/state') {
      let body;
      try { body = await readBody(request); } catch (error) { return send(response, error.message === 'BODY_TOO_LARGE' ? 413 : 400, { error: 'INVALID_REQUEST' }, headers); }
      if (!validState(body.state) || !Number.isInteger(body.revision)) return send(response, 400, { error: 'INVALID_STATE' }, headers);
      if (body.revision !== store.revision) return send(response, 409, { error: 'REVISION_CONFLICT', revision: store.revision, message: 'Данные обновились на другом устройстве. Обновите страницу и повторите изменение.' }, headers);
      store = { revision: store.revision + 1, state: body.state };
      dirty = true;
      try { await saveStore(); dirty = false; } catch (error) { console.error('Could not persist shared state:', error); return send(response, 500, { error: 'PERSIST_FAILED', message: 'Не удалось записать базу на диск ноутбука.' }, headers); }
      return send(response, 200, { revision: store.revision }, headers);
    }
    return send(response, 404, { error: 'NOT_FOUND' }, headers);
  }
  return send(response, 404, { error: 'NOT_FOUND' }, headers);
}

async function start() {
  if (PASSWORD.length < 12) {
    console.error('TEAM_PASSWORD is missing or shorter than 12 characters. Set it before starting the server.');
    process.exitCode = 1;
    return;
  }
  try {
    store = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    if (!Number.isInteger(store.revision) || !(store.state === null || validState(store.state))) throw new Error('Invalid data file format');
  } catch (error) {
    if (error.code !== 'ENOENT') { console.error(`Cannot load ${DATA_FILE}:`, error); process.exitCode = 1; return; }
  }
  const server = http.createServer((request, response) => { handle(request, response).catch(error => { console.error(error); if (!response.headersSent) send(response, 500, { error: 'SERVER_ERROR' }); else response.end(); }); });
  const shutdown = signal => {
    server.close(async () => {
      try { if (dirty) await saveStore(); process.exit(0); }
      catch (error) { console.error(`Save failed during ${signal}:`, error); process.exit(1); }
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  server.listen(PORT, HOST, () => console.log(`Schedule API listening on http://${HOST}:${PORT}; allowed website origins: ${[...ALLOWED_ORIGINS].join(', ')}`));
}

start();
