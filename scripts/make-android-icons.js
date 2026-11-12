const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/**
 * Generates legacy (pre-API-26) launcher PNGs for the DailyPlanner app.
 *
 * mipmap-anydpi-v26/ic_launcher.xml (adaptive icon) covers Android 8.0+, but
 * the app's minSdk is 24, so Android 7.0-7.1 need plain raster icons. This
 * writes a "DP" monogram on the brand gradient at every density, as both
 * ic_launcher (rounded square) and ic_launcher_round (circle).
 *
 * Usage: node scripts/make-android-icons.js
 */

const BRAND_TOP = { r: 0x6c, g: 0x5c, b: 0xe7 };
const BRAND_BOTTOM = { r: 0x4b, g: 0x3f, b: 0xa8 };
const WHITE = { r: 0xff, g: 0xff, b: 0xff };

// density bucket -> icon size in px (48dp base)
const DENSITIES = [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
];

function blend(buf, idx, color, a) {
  const da = buf[idx + 3] / 255;
  const oa = a + da * (1 - a);
  if (oa <= 0) return;
  buf[idx] = Math.round((color.r * a + buf[idx] * da * (1 - a)) / oa);
  buf[idx + 1] = Math.round((color.g * a + buf[idx + 1] * da * (1 - a)) / oa);
  buf[idx + 2] = Math.round((color.b * a + buf[idx + 2] * da * (1 - a)) / oa);
  buf[idx + 3] = Math.round(oa * 255);
}

// Union helper: draw a shape defined by an SDF into the buffer.
function fill(size, buf, sdf, color) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = Math.max(0, Math.min(1, 0.5 - sdf(x + 0.5, y + 0.5)));
      if (c > 0) blend(buf, (y * size + x) * 4, color, c);
    }
  }
}

const rectUnionSdf = (cx, cy, hw, hh, r) => (px, py) => {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
};

// ---- Drawing (size-relative, so every density matches) ----

function drawLetter(size, buf) {
  const s = size;
  const stroke = 0.085 * s;      // stroke thickness
  const hs = stroke / 2;
  const top = 0.30 * s;
  const bottom = 0.74 * s;
  const mid = (top + bottom) / 2;
  const vHalf = (bottom - top) / 2; // vertical half-height of bowls

  // ===== "D" =====
  const dX = 0.34 * s;
  fill(s, buf, rectUnionSdf(dX, mid, hs, vHalf, hs), WHITE); // stem
  // bowl: rounded-rect ring, drawn only on the right of the stem
  const dRingHw = 0.13 * s;
  const dRingR = Math.min(vHalf, dRingHw);
  fill(s, buf, (px, py) => {
    if (px < dX - hs) return 1;
    const outer = rectUnionSdf(dX, mid, dRingHw, vHalf, dRingR)(px, py);
    return Math.abs(outer) - hs; // hollow ring
  }, WHITE);

  // ===== "P" =====
  const pX = 0.60 * s;
  fill(s, buf, rectUnionSdf(pX, mid, hs, vHalf, hs), WHITE); // stem
  const pTop = top;
  const pBottom = top + (bottom - top) * 0.62;
  const pMid = (pTop + pBottom) / 2;
  const pVHalf = (pBottom - pTop) / 2;
  const pRingHw = 0.12 * s;
  const pRingR = Math.min(pVHalf, pRingHw);
  fill(s, buf, (px, py) => {
    if (px < pX - hs) return 1;
    const outer = rectUnionSdf(pX, pMid, pRingHw, pVHalf, pRingR)(px, py);
    return Math.abs(outer) - hs;
  }, WHITE);
}

function buildIcon(size, round) {
  const buf = Buffer.alloc(size * size * 4);
  const bg = round
    ? (px, py) => Math.hypot(px - size / 2, py - size / 2) - size / 2
    : rectUnionSdf(size / 2, size / 2, size / 2, size / 2, 0.16 * size);

  // gradient background clipped to shape
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const col = {
      r: Math.round(BRAND_TOP.r + (BRAND_BOTTOM.r - BRAND_TOP.r) * t),
      g: Math.round(BRAND_TOP.g + (BRAND_BOTTOM.g - BRAND_TOP.g) * t),
      b: Math.round(BRAND_TOP.b + (BRAND_BOTTOM.b - BRAND_TOP.b) * t),
    };
    for (let x = 0; x < size; x++) {
      const c = Math.max(0, Math.min(1, 0.5 - bg(x + 0.5, y + 0.5)));
      if (c > 0) blend(buf, (y * size + x) * 4, col, c);
    }
  }

  // glyph on its own layer, then clipped to the shape
  const glyph = Buffer.alloc(size * size * 4);
  drawLetter(size, glyph);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const a = glyph[idx + 3] / 255;
      if (a <= 0) continue;
      const inside = Math.max(0, Math.min(1, 0.5 - bg(x + 0.5, y + 0.5)));
      blend(buf, idx, { r: glyph[idx], g: glyph[idx + 1], b: glyph[idx + 2] }, a * inside);
    }
  }
  return buf;
}

// ---- PNG encoding ----

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, payload) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payload.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Main ----

function main() {
  const resDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
  let count = 0;
  for (const [bucket, size] of DENSITIES) {
    const dir = path.join(resDir, `mipmap-${bucket}`);
    fs.mkdirSync(dir, { recursive: true });

    const square = encodePng(buildIcon(size, false), size);
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), square);

    const round = encodePng(buildIcon(size, true), size);
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), round);

    count += 2;
    console.log(`mipmap-${bucket}: ic_launcher.png, ic_launcher_round.png (${size}px)`);
  }
  console.log(`Wrote ${count} launcher icons.`);
}

main();
