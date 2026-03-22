import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const BACKEND_PORT = 5178;
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 4173);

const VIEWPORT_W = Number(process.env.VIEWPORT_W || 1024);
const VIEWPORT_H = Number(process.env.VIEWPORT_H || 640);
const DEVICE_SCALE_FACTOR = Number(process.env.DEVICE_SCALE_FACTOR || 1);

const MOVES = Number(process.env.MOVES || 5);
const POV_COLOR = process.env.POV_COLOR || 'red';

const SCREEN_DIR = path.join(REPO_ROOT, 'tmp_screenshots');
fs.mkdirSync(SCREEN_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHttp(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const resp = await fetch(url, { method: 'GET' });
      if (resp && resp.ok) return;
    } catch {
      // ignore
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for ${url}`);
    }
    await sleep(250);
  }
}

async function main() {
  const backendProc = spawn('node', ['backend/server.js'], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
    env: { ...process.env, PORT: String(BACKEND_PORT) },
  });

  try {
    await waitForHttp(`http://localhost:${BACKEND_PORT}/api/roll`, 2500);
  } catch {
    // backend may not expose GET /api/roll; fall back to a short sleep
    await sleep(500);
  }

  // Frontend server for index.html + JS/CSS assets
  const frontendProc = spawn('python3', ['-m', 'http.server', String(FRONTEND_PORT)], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
  });

  try {
    await waitForHttp(`http://localhost:${FRONTEND_PORT}/`, 10000);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: VIEWPORT_W, height: VIEWPORT_H },
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });

    const useDebugControls = MOVES > 0;
    const url = `http://localhost:${FRONTEND_PORT}/index.html${useDebugControls ? '?debug=1' : ''}`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Choose POV color
    await page.waitForSelector('#playerColorSelect');
    await page.selectOption('#playerColorSelect', POV_COLOR);

    // Start game
    await page.click('#quickPlayBtn');
    await page.waitForSelector('#game-screen.active', { timeout: 15000 });
    await page.waitForTimeout(800);

    const shots = [];
    const canvasHandle = await page.$('#gameCanvas');
    if (!canvasHandle) throw new Error('Canvas not found');

    const canvasBox = await canvasHandle.boundingBox();
    if (!canvasBox) throw new Error('Canvas bounding box missing');
    const vp = page.viewportSize();
    const clipX = Math.max(0, canvasBox.x);
    const clipY = Math.max(0, canvasBox.y);
    const clipW = Math.max(0, Math.min(canvasBox.width, vp.width - clipX));
    const clipH = Math.max(0, Math.min(canvasBox.height, vp.height - clipY));

    if (clipW <= 0 || clipH <= 0) {
      throw new Error(
        `Canvas clip is empty/outside viewport: clip=${clipX},${clipY},${clipW}x${clipH} viewport=${vp.width}x${vp.height}`
      );
    }
    const canvasClip = { x: clipX, y: clipY, width: clipW, height: clipH };
    fs.writeFileSync(path.join(SCREEN_DIR, 'canvas_bbox.json'), JSON.stringify(canvasClip, null, 2));

    async function takeCanvasShot(label) {
      const file = path.join(SCREEN_DIR, `${label}_canvas.png`);
      await page.screenshot({
        path: file,
        clip: {
          x: canvasClip.x,
          y: canvasClip.y,
          width: canvasClip.width,
          height: canvasClip.height,
        },
      });
      shots.push(file);
      return file;
    }

    async function takeFullShot(label) {
      const file = path.join(SCREEN_DIR, `${label}_full.png`);
      await page.screenshot({ path: file });
      shots.push(file);
      return file;
    }

    await takeCanvasShot('0_initial');
    await takeFullShot('0_initial');

    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const avatarId = `avatar${cap(POV_COLOR)}`;
    const debugRollSelect = '#debugRollSelect';
    const diceId = `dice${cap(POV_COLOR)}`;

    // One real dice click to validate backend wiring.
    // We still use debug-based moving below to keep the smoke test stable.
    await page.waitForTimeout(350);
    // Debug panel can overlap dice when ?debug=1; force click through.
    await page.click(`#${diceId}`, { force: true });
    await page.waitForTimeout(900);
    const rollSource = await page.$eval(`#${diceId}`, (el) => el.dataset.rollSource || '');
    await takeCanvasShot('0_backendRoll');
    await takeFullShot('0_backendRoll');

    for (let i = 1; i <= MOVES; i++) {
      // Wait until it's the POV player's turn
      await page.waitForFunction(
        (avatar) => document.getElementById(avatar)?.classList.contains('active'),
        avatarId,
        { timeout: 30000 }
      );

      // Force roll 6 and move the first movable piece using the debug controls.
      await page.selectOption(debugRollSelect, '6');
      await page.click('#debugForceRollBtn');
      await page.waitForTimeout(350);
      await page.click('#debugMoveFirstBtn');
      await page.waitForTimeout(700);

      await takeCanvasShot(String(i));
      await takeFullShot(String(i));
    }

    await browser.close();
    console.log(JSON.stringify({ ok: true, shots, rollSource }, null, 2));
  } finally {
    frontendProc.kill('SIGTERM');
  }
} // main

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

