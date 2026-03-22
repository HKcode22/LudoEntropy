/* eslint-disable no-console */
const crypto = require('crypto');

const BACKEND_BASE = process.env.BACKEND_BASE || 'http://localhost:5178';

function randU32() {
  // 32-bit unsigned integer
  const b = crypto.randomBytes(4);
  return b.readUInt32BE(0) >>> 0;
}

function entropyBytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

function makeClientPayload() {
  // For testing we can send realistic-ish entropy bytes; backend will hash with serverSeed.
  const entropyBytes = crypto.randomBytes(20);
  const entropyHex = entropyBytesToHex(entropyBytes);

  const pressure = (randU32() % 1000) / 1000;
  const vx = ((randU32() % 2001) - 1000) / 250; // roughly -4..4
  const vy = ((randU32() % 2001) - 1000) / 250;
  const durationMs = randU32() % 1200;
  const turnElapsedMs = randU32() % 30000;

  return {
    entropyHex,
    meta: {
      timeMs: Date.now(),
      pressure,
      vx,
      vy,
      durationMs,
      turnElapsedMs
    }
  };
}

async function apiRoll({ sides = 6, color = 'test', entropyHex, meta }) {
  const resp = await fetch(`${BACKEND_BASE}/api/roll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sides, color, entropyHex, meta })
  });
  if (!resp.ok) throw new Error(`roll failed: ${resp.status}`);
  return resp.json();
}

async function main() {
  const N = Number(process.env.N || 6000);
  const PAIRS = Number(process.env.PAIRS || 200);
  const SEQ_LEN = Number(process.env.SEQ_LEN || 12);

  console.log(`Running RNG test: N=${N}, PAIRS=${PAIRS}, SEQ_LEN=${SEQ_LEN}`);

  const counts = Array(6).fill(0);
  for (let i = 0; i < N; i++) {
    const { entropyHex, meta } = makeClientPayload();
    const die = (await apiRoll({ entropyHex, meta })).die;
    if (die < 1 || die > 6) throw new Error(`bad die: ${die}`);
    counts[die - 1]++;
    if ((i + 1) % 1000 === 0) console.log(`  progress: ${i + 1}/${N}`);
  }

  const expected = N / 6;
  const chi2 = counts.reduce((acc, c) => acc + ((c - expected) * (c - expected)) / expected, 0);
  console.log('Distribution counts:', counts);
  console.log('Approx chi-square:', chi2.toFixed(2), '(lower is better)');

  // Sequence duplication test (copy-like behavior).
  // Two players call the backend for SEQ_LEN rolls each with independent entropy.
  // With a serverSeed per roll, identical sequences should be extremely rare.
  let identicalSequences = 0;
  for (let i = 0; i < PAIRS; i++) {
    const seqA = [];
    const seqB = [];
    for (let k = 0; k < SEQ_LEN; k++) {
      const pA = makeClientPayload();
      const pB = makeClientPayload();
      seqA.push((await apiRoll({ color: 'A', ...pA })).die);
      seqB.push((await apiRoll({ color: 'B', ...pB })).die);
    }
    const aStr = seqA.join(',');
    const bStr = seqB.join(',');
    if (aStr === bStr) identicalSequences++;
  }
  console.log(`Identical sequences (A vs B) across ${PAIRS} pairs:`, identicalSequences);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

