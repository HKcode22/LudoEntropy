import fs from 'node:fs';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const REPO_ROOT = process.cwd();
const REFERENCE_PATH =
  process.env.REFERENCE_PATH ||
  '/Users/hk/.cursor/projects/Users-hk-Downloads-ludo/assets/Screenshot_2026-03-16_at_5.06.23_AM-5360396b-24f7-4daa-84aa-32175ca18ac8.png';

const ACTUAL_DIR = process.env.ACTUAL_DIR || path.join(REPO_ROOT, 'tmp_screenshots');
const LABELS = (process.env.LABELS || '0_initial').split(',').map((s) => s.trim()).filter(Boolean);

const THRESHOLD = Number(process.env.PIXELMATCH_THRESHOLD || 0.02);
const AUTO_CROP = process.env.AUTO_CROP === '1';
const DIFF_KIND = process.env.DIFF_KIND || 'full'; // 'full' | 'canvas_coords'

function readPngRGBA(p) {
  const buf = fs.readFileSync(p);
  const png = PNG.sync.read(buf);
  return { data: png.data, width: png.width, height: png.height };
}

function readJpegRGBA(p) {
  const buf = fs.readFileSync(p);
  const jpg = jpeg.decode(buf, { useTArray: true });
  return { data: jpg.data, width: jpg.width, height: jpg.height };
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function findNearWhiteBBox(rgba, width, height) {
  // Heuristic: board tiles are mostly white/very light, while the app background is purple/dark.
  // We look for pixels that are bright and low-saturation (channels close together).
  const min = { x: Infinity, y: Infinity };
  const max = { x: -Infinity, y: -Infinity };
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];
      const a = rgba[idx + 3];
      if (a === 0) continue;

      const lum = luminance(r, g, b);
      const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum > 210 && channelSpread < 35) {
        found = true;
        if (x < min.x) min.x = x;
        if (y < min.y) min.y = y;
        if (x > max.x) max.x = x;
        if (y > max.y) max.y = y;
      }
    }
  }

  if (!found) return null;

  const margin = 8;
  const x0 = Math.max(0, min.x - margin);
  const y0 = Math.max(0, min.y - margin);
  const x1 = Math.min(width - 1, max.x + margin);
  const y1 = Math.min(height - 1, max.y + margin);

  return { x0, y0, x1, y1 };
}

function cropRgba(rgba, width, height, bbox) {
  const { x0, y0, x1, y1 } = bbox;
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out = new Uint8Array(cw * ch * 4);

  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const srcX = x0 + x;
      const srcY = y0 + y;
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * cw + x) * 4;
      out[dstIdx] = rgba[srcIdx];
      out[dstIdx + 1] = rgba[srcIdx + 1];
      out[dstIdx + 2] = rgba[srcIdx + 2];
      out[dstIdx + 3] = rgba[srcIdx + 3];
    }
  }
  return { data: out, width: cw, height: ch };
}

for (const label of LABELS) {
  const actualPath =
    DIFF_KIND === 'canvas_coords' ? path.join(ACTUAL_DIR, `${label}_canvas.png`) : path.join(ACTUAL_DIR, `${label}_full.png`);
  if (!fs.existsSync(actualPath)) {
    console.error(`[visual_diff] Missing actual file: ${actualPath}`);
    process.exitCode = 1;
    continue;
  }

  if (!fs.existsSync(REFERENCE_PATH)) {
    console.error(`[visual_diff] Missing reference file: ${REFERENCE_PATH}`);
    process.exitCode = 1;
    continue;
  }

  const refFull = readJpegRGBA(REFERENCE_PATH);
  const act = readPngRGBA(actualPath);

  let ref = refFull;
  if (DIFF_KIND === 'canvas_coords') {
    const bboxPath = path.join(ACTUAL_DIR, 'canvas_bbox.json');
    if (!fs.existsSync(bboxPath)) {
      console.error(`[visual_diff] Missing canvas bbox: ${bboxPath}`);
      process.exitCode = 1;
      continue;
    }
    const canvasBBox = JSON.parse(fs.readFileSync(bboxPath, 'utf8'));
    const x0 = Math.round(canvasBBox.x);
    const y0 = Math.round(canvasBBox.y);
    const x1 = Math.round(canvasBBox.x + canvasBBox.width - 1);
    const y1 = Math.round(canvasBBox.y + canvasBBox.height - 1);
    const bbox = { x0, y0, x1, y1 };
    ref = cropRgba(refFull.data, refFull.width, refFull.height, bbox);
  }

  if (ref.width !== act.width || ref.height !== act.height) {
    console.error(
      `[visual_diff] Dimension mismatch for ${label}: ref=${ref.width}x${ref.height}, act=${act.width}x${act.height}`
    );
    process.exitCode = 1;
    continue;
  }

  let actR = act;
  let refR = ref;
  let bboxUsed = null;
  if (AUTO_CROP) {
    const actBBox = findNearWhiteBBox(act.data, act.width, act.height);
    const refBBox = findNearWhiteBBox(ref.data, ref.width, ref.height);
    if (actBBox && refBBox) {
      // Use intersection so both crops align spatially.
      const x0 = Math.max(actBBox.x0, refBBox.x0);
      const y0 = Math.max(actBBox.y0, refBBox.y0);
      const x1 = Math.min(actBBox.x1, refBBox.x1);
      const y1 = Math.min(actBBox.y1, refBBox.y1);
      if (x1 >= x0 && y1 >= y0) {
        bboxUsed = { x0, y0, x1, y1, actBBox, refBBox };
        actR = cropRgba(act.data, act.width, act.height, { x0, y0, x1, y1 });
        refR = cropRgba(ref.data, ref.width, ref.height, { x0, y0, x1, y1 });
      }
    }
  }

  const { width, height } = actR;
  const diffPng = new PNG({ width, height });

  const diffPixels = pixelmatch(refR.data, actR.data, diffPng.data, width, height, {
    threshold: THRESHOLD,
    includeAA: false,
  });

  const totalPixels = width * height;
  const ratio = diffPixels / totalPixels;

  const outPath = path.join(ACTUAL_DIR, `${label}_diff.png`);
  fs.writeFileSync(outPath, PNG.sync.write(diffPng));

  console.log(
    JSON.stringify(
      {
        label,
        actualPath,
        referencePath: REFERENCE_PATH,
        outPath,
        diffPixels,
        totalPixels,
        mismatchRatio: Number(ratio.toFixed(6)),
        threshold: THRESHOLD,
        autoCrop: AUTO_CROP,
        bboxUsed,
      },
      null,
      2
    )
  );
}

