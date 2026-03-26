const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT ? Number(process.env.PORT) : 5179;

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function sha256Bytes(data) {
  return crypto.createHash('sha256').update(data).digest();
}

function bytesToHex(buf) {
  return Buffer.from(buf).toString('hex');
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function readRequestBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      // Hard cap to avoid abuse in this local prototype.
      if (raw.length > 2_000_000) {
        raw = '';
      }
    });
    req.on('end', () => resolve(raw));
  });
}

// Unbiased die roll from 32-bit randomness.
function rollDieFromU32(u32, sides = 6) {
  const max = 0xFFFFFFFF; // 2^32 - 1
  const range = (max + 1) - ((max + 1) % sides); // largest multiple of sides <= 2^32
  if (u32 < range) {
    return (u32 % sides) + 1;
  }

  // Rejection sampling: rehash once more by mutating input.
  // For local prototype, two attempts is enough.
  const rehashed = sha256Bytes(Buffer.from(u32.toString(16), 'utf8'));
  const u32b = rehashed.readUInt32BE(0) >>> 0;
  return rollDieFromU32(u32b, sides);
}

async function handleApiRoll(req, res, body) {
  const payload = safeJsonParse(body);
  if (!payload) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const sides = Number(payload.sides || 6);
  const color = String(payload.color || 'unknown');

  const entropyHex = String(payload.entropyHex || '');
  const entropyBytes = entropyHex ? Buffer.from(entropyHex, 'hex') : Buffer.alloc(0);

  const meta = payload.meta || {};
  const timeMs = Number(meta.timeMs || meta.tNow || Date.now());
  const pressure = Number(meta.pressure || 0);
  const vx = Number(meta.vx || 0);
  const vy = Number(meta.vy || 0);
  const durationMs = Number(meta.durationMs || meta.duration || 0);
  const turnElapsedMs = Number(meta.turnElapsedMs || meta.turnElapsed || 0);

  // Server-side CSPRNG seed (unique per roll request).
  const serverSeed = crypto.randomBytes(32);
  const commit = sha256Hex(serverSeed);

  // Incorporate frontend entropy + click factors + server receive time.
  const receiveTime = Date.now();

  // Normalize meta so the hash is stable and not affected by key order.
  const metaStr = JSON.stringify({
    color,
    timeMs: timeMs >>> 0,
    pressure: Math.round(pressure * 1000) / 1000,
    vx: Math.round(vx * 1000) / 1000,
    vy: Math.round(vy * 1000) / 1000,
    durationMs: durationMs >>> 0,
    turnElapsedMs: turnElapsedMs >>> 0,
    receiveTime
  });

  const input = Buffer.concat([
    serverSeed,
    Buffer.from(entropyBytes),
    Buffer.from(metaStr, 'utf8')
  ]);

  const digest = sha256Bytes(input);
  const u32 = digest.readUInt32BE(0) >>> 0;
  const die = rollDieFromU32(u32, sides);

  res.writeHead(200, {
    'Content-Type': 'application/json',
    // Local prototype: allow browser access without CORS hassle.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  });

  res.end(JSON.stringify({
    die,
    sides,
    commit,
    serverSeed: bytesToHex(serverSeed) // revealed immediately (single-call prototype)
  }));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (url.pathname === '/api/roll' && req.method === 'POST') {
    const body = await readRequestBody(req);
    await handleApiRoll(req, res, body);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[dice-server] listening on http://localhost:${PORT}`);
});

