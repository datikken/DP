import { nativeImage } from 'electron';
import * as zlib from 'zlib';

/**
 * Builds the tray icon in code, so the app needs no bundled image assets.
 *
 * The icon is a simple rounded "link" glyph (two interlocking chain rings)
 * drawn into an RGBA buffer and encoded as PNG via Electron's nativeImage.
 */

const SIZE = 32;

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, payload: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length, 0);
  const typeAndPayload = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndPayload), 0);
  return Buffer.concat([length, typeAndPayload, crc]);
}

function encodePng(rgba: Buffer, width: number, height: number): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Each scanline is prefixed with a filter byte (0 = none).
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Distance from point to a ring (annulus) centre, using squared distances. */
function ringAlpha(
  x: number,
  y: number,
  cx: number,
  cy: number,
  radius: number,
  thickness: number
): number {
  const dist = Math.hypot(x - cx, y - cy);
  const edge = Math.abs(dist - radius) - thickness / 2;
  // 1 px soft edge for anti-aliasing.
  return Math.max(0, Math.min(1, 0.5 - edge));
}

export function createTrayIcon(): Electron.NativeImage {
  const rgba = Buffer.alloc(SIZE * SIZE * 4);

  const r = 0x6c;
  const g = 0x5c;
  const b = 0xe7;

  const ringRadius = 6;
  const ringThickness = 3.5;
  const left = { cx: 11.5, cy: 16 };
  const right = { cx: 20.5, cy: 16 };

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Sample ring shapes on each pixel centre.
      const px = x + 0.5;
      const py = y + 0.5;
      const aLeft = ringAlpha(px, py, left.cx, left.cy, ringRadius, ringThickness);
      const aRight = ringAlpha(px, py, right.cx, right.cy, ringRadius, ringThickness);

      // Fill the hollow parts that overlap so the two rings look chained.
      const aBar =
        px >= left.cx && px <= right.cx && Math.abs(py - left.cy) <= ringThickness / 2
          ? 1
          : 0;

      const alpha = Math.min(1, Math.max(aLeft, aRight, aBar));
      const idx = (y * SIZE + x) * 4;
      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = Math.round(alpha * 255);
    }
  }

  const png = encodePng(rgba, SIZE, SIZE);
  const image = nativeImage.createFromBuffer(png);
  // Tray icons are expected to be ~16px logical on Windows/Linux.
  return image.resize({ width: 16, height: 16 });
}

