// Codex — Copyright (C) 2026 David Ambrozio
// SPDX-License-Identifier: GPL-3.0-or-later

// Draws Codex's mark (CodexMark in packages/ui/src/components/icons.tsx)
// into the files packaging needs, with no image tools: build/icon.png,
// build/icon.ico and the installer wizard's bitmaps. Run it again only if
// the mark changes: `node scripts/icons.mjs` in apps/desktop.

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [0x05, 0x12, 0x1a]; // --visor-bg
const MARK = [0x6f, 0xe2, 0xf2]; // --visor-text
const PAGE = [0x0d, 0x11, 0x15]; // --color-bg, behind the mark on the wizard
const SAMPLES = 4; // per axis, for anti-aliasing

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const OUTLINE = [
  [32, 9],
  [52, 32],
  [32, 55],
  [12, 32],
];

/** The colour at a point of the 64-unit mark, or null outside its rounded square. */
function markAt(x, y) {
  const r = 14;
  const cx = Math.max(r, Math.min(64 - r, x));
  const cy = Math.max(r, Math.min(64 - r, y));
  if (x < 0 || y < 0 || x > 64 || y > 64 || Math.hypot(x - cx, y - cy) > r) return null;
  if (Math.abs(x - 32) / 9 + Math.abs(y - 32) / 10 <= 1) return MARK;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = OUTLINE[i];
    const [bx, by] = OUTLINE[(i + 1) % 4];
    if (segmentDistance(x, y, ax, ay, bx, by) <= 2.5) return MARK;
  }
  return BG;
}

/** RGBA pixels of the mark at `size` px, transparent around the rounded square. */
function renderMark(size) {
  const pixels = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const color = markAt(((px + (sx + 0.5) / SAMPLES) * 64) / size, ((py + (sy + 0.5) / SAMPLES) * 64) / size);
          if (!color) continue;
          r += color[0];
          g += color[1];
          b += color[2];
          a++;
        }
      }
      const i = (py * size + px) * 4;
      if (a > 0) {
        pixels[i] = Math.round(r / a);
        pixels[i + 1] = Math.round(g / a);
        pixels[i + 2] = Math.round(b / a);
        pixels[i + 3] = Math.round((a / (SAMPLES * SAMPLES)) * 255);
      }
    }
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function png(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) Buffer.from(rgba.subarray(y * size * 4, (y + 1) * size * 4)).copy(raw, y * (size * 4 + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** An .ico of PNG entries (Windows Vista and later read those at every size). */
function ico(sizes) {
  const images = sizes.map((size) => png(size, renderMark(size)));
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const entry = 6 + 16 * i;
    header[entry] = size >= 256 ? 0 : size;
    header[entry + 1] = size >= 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[i].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[i].length;
  });
  return Buffer.concat([header, ...images]);
}

/** A 24-bit .bmp of `width`×`height` on the page colour, the mark centred at `markSize`. */
function bmp(width, height, markSize) {
  const mark = renderMark(markSize);
  const left = Math.floor((width - markSize) / 2);
  const top = Math.floor((height - markSize) / 2);
  const stride = Math.ceil((width * 3) / 4) * 4;
  const out = Buffer.alloc(54 + stride * height);
  out.write("BM", 0, "ascii");
  out.writeUInt32LE(out.length, 2);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22); // bottom-up
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(stride * height, 34);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let color = PAGE;
      const mx = x - left;
      const my = y - top;
      if (mx >= 0 && my >= 0 && mx < markSize && my < markSize) {
        const i = (my * markSize + mx) * 4;
        const alpha = mark[i + 3] / 255;
        color = [0, 1, 2].map((c) => Math.round(mark[i + c] * alpha + PAGE[c] * (1 - alpha)));
      }
      const at = 54 + (height - 1 - y) * stride + x * 3;
      out[at] = color[2];
      out[at + 1] = color[1];
      out[at + 2] = color[0];
    }
  }
  return out;
}

mkdirSync("build", { recursive: true });
writeFileSync("build/icon.png", png(512, renderMark(512)));
writeFileSync("build/icon.ico", ico([16, 20, 24, 32, 40, 48, 64, 128, 256]));
mkdirSync("installer", { recursive: true });
// Inno Setup's modern wizard: the side picture and the small one in the corner.
writeFileSync("installer/wizard-image.bmp", bmp(164, 314, 112));
writeFileSync("installer/wizard-small.bmp", bmp(55, 58, 46));
console.log("Wrote build/icon.png, build/icon.ico and installer/wizard-*.bmp");
