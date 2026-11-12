 const fs = require('fs');
const path = require('path');

/**
 * Writes the application icon used by electron-builder for the Windows
 * installer, shortcuts and the executable.
 *
 * The icon is generated in code so the repository needs no binary assets.
 * Windows requires a .ico file whose image entries are all in ICO format
 * (PNG-compressed ICO is commonly rejected by the shell), so this writes a
 * 256x256 32-bit BMP/DIB image - the maximum size Windows Explorer uses for
 * the large-icon view.
 */

const SIZE = 256;

/** The glyph is a "DP" monogram (DailyPlanner) drawn with rounded strokes. */
const BACKGROUND_TOP = { r: 0x6c, g: 0x5c, b: 0xe7 }; // brand
const BACKGROUND_BOTTOM = { r: 0x4b, g: 0x3f, b: 0xa8 }; // darker brand
const FOREGROUND = { r: 0xff, g: 0xff, b: 0xff };

/**
 * Source-over composite of one shape onto an RGBA buffer at a given coverage.
 * Colour is written straight; the alpha channel accumulates coverage.
 */
function compositePixel(buffer, idx, color, srcA) {
  const dstA = buffer[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;

  buffer[idx] = Math.round((color.r * srcA + buffer[idx] * dstA * (1 - srcA)) / outA);
  buffer[idx + 1] = Math.round((color.g * srcA + buffer[idx + 1] * dstA * (1 - srcA)) / outA);
  buffer[idx + 2] = Math.round((color.b * srcA + buffer[idx + 2] * dstA * (1 - srcA)) / outA);
  buffer[idx + 3] = Math.round(outA * 255);
}

/**
 * Draws one anti-aliased rounded rectangle onto an RGBA pixel buffer.
 * Coordinates are in pixels.
 */
function fillRoundedRect(buffer, x0, y0, x1, y1, radius, color) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;

      const px = x + 0.5;
      const py = y + 0.5;

      // Signed distance to the rounded rectangle, for anti-aliasing.
      const cx = Math.min(Math.max(px, x0 + radius), x1 - radius);
      const cy = Math.min(Math.max(py, y0 + radius), y1 - radius);
      const dist = Math.hypot(px - cx, py - cy) - radius;
      const insideBox =
        px >= x0 - 1 && px <= x1 + 1 && py >= y0 - 1 && py <= y1 + 1;
      if (!insideBox) continue;

      const coverage = Math.max(0, Math.min(1, 0.5 - dist));
      if (coverage <= 0) continue;

      compositePixel(buffer, (y * SIZE + x) * 4, color, coverage);
    }
  }
}

/**
 * Erases an anti-aliased rounded rectangle from an RGBA buffer by reducing the
 * alpha channel (destination-out). Used to hollow the bowls of the glyph so the
 * background gradient shows through the holes with no colour seams.
 */
function eraseRoundedRect(buffer, x0, y0, x1, y1, radius) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;

      const px = x + 0.5;
      const py = y + 0.5;
      const cx = Math.min(Math.max(px, x0 + radius), x1 - radius);
      const cy = Math.min(Math.max(py, y0 + radius), y1 - radius);
      const dist = Math.hypot(px - cx, py - cy) - radius;
      const insideBox =
        px >= x0 - 1 && px <= x1 + 1 && py >= y0 - 1 && py <= y1 + 1;
      if (!insideBox) continue;

      const coverage = Math.max(0, Math.min(1, 0.5 - dist));
      if (coverage <= 0) continue;

      const idx = (y * SIZE + x) * 4;
      buffer[idx + 3] = Math.round(buffer[idx + 3] * (1 - coverage));
    }
  }
}

/** Alpha-composites a glyph layer (premultiplied-free RGBA) over a base buffer. */
function compositeLayer(base, layer) {
  for (let i = 0; i < base.length; i += 4) {
    const srcA = layer[i + 3] / 255;
    if (srcA <= 0) continue;
    const dstA = base[i + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) continue;
    // Layer is solid white; blend its colour weighted by srcA.
    base[i] = Math.round((layer[i] * srcA + base[i] * dstA * (1 - srcA)) / outA);
    base[i + 1] = Math.round((layer[i + 1] * srcA + base[i + 1] * dstA * (1 - srcA)) / outA);
    base[i + 2] = Math.round((layer[i + 2] * srcA + base[i + 2] * dstA * (1 - srcA)) / outA);
    base[i + 3] = Math.round(outA * 255);
  }
}

function buildRgba() {
  // Background: rounded square with a subtle vertical gradient.
  const base = Buffer.alloc(SIZE * SIZE * 4);
  const pad = 8;
  const radius = 56;
  const x0 = pad;
  const y0 = pad;
  const x1 = SIZE - pad;
  const y1 = SIZE - pad;

  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / (y1 - y0);
    const color = {
      r: Math.round(BACKGROUND_TOP.r + (BACKGROUND_BOTTOM.r - BACKGROUND_TOP.r) * t),
      g: Math.round(BACKGROUND_TOP.g + (BACKGROUND_BOTTOM.g - BACKGROUND_TOP.g) * t),
      b: Math.round(BACKGROUND_TOP.b + (BACKGROUND_BOTTOM.b - BACKGROUND_TOP.b) * t),
    };
    fillRoundedRect(base, x0, y, x1, y + 1, radius, color);
  }

  // Glyph layer: draw "D" and "P" in white, then composite over the background
  // so the holes show the gradient.
  const glyph = Buffer.alloc(SIZE * SIZE * 4);
  drawGlyph(glyph);
  compositeLayer(base, glyph);

  return base;
}

/**
 * Draws a "DP" monogram into a (transparent) RGBA layer.
 *
 * "D" = vertical stem + a right-hand bowl carved into a ring.
 * "P" = vertical stem + an upper bowl carved into a ring.
 * Bowls are drawn as solid rounded rectangles and then hollowed with an
 * eraser, so they read as letter bowls regardless of the background.
 */
function drawGlyph(glyph) {
  const top = 70;
  const bottom = 186;
  const stemW = 22;
  const stroke = 20; // thickness of the curved bowls

  // ---- "D" (left half) ----
  const dStemX = 54;
  const dBowlRight = 150;
  fillRoundedRect(glyph, dStemX, top, dStemX + stemW, bottom, 7, FOREGROUND);
  // Solid bowl: square on the left, fully rounded on the right.
  fillRoundedRect(glyph, dStemX + stemW - 6, top, dBowlRight, bottom, (bottom - top) / 2, FOREGROUND);
  // Hollow it out, leaving only the stroke ring.
  eraseRoundedRect(
    glyph,
    dStemX + stemW,
    top + stroke,
    dBowlRight - stroke,
    bottom - stroke,
    (bottom - top) / 2 - stroke
  );

  // ---- "P" (right half) ----
  const pStemX = 160;
  const pBowlRight = 210;
  const pBowlTop = top;
  const pBowlBottom = top + (bottom - top) * 0.6; // upper ~60%
  const pBowlRadius = (pBowlBottom - pBowlTop) / 2;
  fillRoundedRect(glyph, pStemX, top, pStemX + stemW, bottom, 7, FOREGROUND);
  // Solid upper bowl, rounded on the right.
  fillRoundedRect(
    glyph,
    pStemX + stemW - 6,
    pBowlTop,
    pBowlRight,
    pBowlBottom,
    pBowlRadius,
    FOREGROUND
  );
  // Hollow it out.
  eraseRoundedRect(
    glyph,
    pStemX + stemW,
    pBowlTop + stroke,
    pBowlRight - stroke,
    pBowlBottom - stroke,
    Math.max(2, pBowlRadius - stroke)
  );
}

/**
 * Converts RGBA pixels into a 32-bit ICO image entry (BITMAPINFOHEADER +
 * bottom-up BGRA rows + 1-bit AND mask, as required by the ICO format).
 */
function rgbaToIcoImage(rgba, width, height) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(width, 4); // biWidth
  header.writeInt32LE(height * 2, 8); // biHeight: XOR + AND masks
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  header.writeUInt32LE(0, 16); // BI_RGB (no compression)
  header.writeUInt32LE(width * height * 4, 20); // biSizeImage

  // XOR mask: BGRA, bottom-up.
  const xor = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * width * 4;
    const dstRow = y * width * 4;
    for (let x = 0; x < width; x++) {
      const s = srcRow + x * 4;
      const d = dstRow + x * 4;
      xor[d] = rgba[s + 2]; // blue
      xor[d + 1] = rgba[s + 1]; // green
      xor[d + 2] = rgba[s]; // red
      xor[d + 3] = rgba[s + 3]; // alpha
    }
  }

  // AND mask: 1 bit per pixel, row-padded to 4 bytes. All zero because the
  // alpha channel above does the transparency work.
  const maskRowBytes = Math.ceil(width / 32) * 4;
  const and = Buffer.alloc(maskRowBytes * height, 0);

  return Buffer.concat([header, xor, and]);
}

function buildIco() {
  const rgba = buildRgba();
  const image = rgbaToIcoImage(rgba, SIZE, SIZE);

  const dir = Buffer.alloc(6);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type: icon
  dir.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry[0] = 0; // width 256 is encoded as 0
  entry[1] = 0; // height 256 is encoded as 0
  entry[2] = 0; // colour count
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bit count
  entry.writeUInt32LE(image.length, 8); // bytes in resource
  entry.writeUInt32LE(6 + 16, 12); // offset to image data

  return Buffer.concat([dir, entry, image]);
}

function main() {
  const outDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(outDir, { recursive: true });

  const ico = buildIco();
  const icoPath = path.join(outDir, 'icon.ico');
  fs.writeFileSync(icoPath, ico);

  // A PNG copy is convenient for documentation / other platforms.
  const png = require('zlib').deflateSync(buildRgbaPngRows());
  fs.writeFileSync(path.join(outDir, 'icon.png'), buildPng(png));

  console.log(`Wrote ${icoPath} (${ico.length} bytes)`);
}

/** Raw scanlines with the 0 filter byte that PNG expects. */
function buildRgbaPngRows() {
  const rgba = buildRgba();
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    const rowStart = y * (SIZE * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  return raw;
}

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
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function buildPng(deflatedRows) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflatedRows),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

main();
