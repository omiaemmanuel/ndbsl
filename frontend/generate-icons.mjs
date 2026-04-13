// Generates minimal PNG icons for PWA using pure Node.js (no canvas needed)
// Creates a solid blue square with "NB" text encoded as pixel data
import { createWriteStream } from 'fs';
import zlib from 'zlib';

function createPNG(size) {
  // Colors: bg = #1d4ed8 (blue), text pixels hand-crafted as a simple "N" shape
  const bg = [0x1d, 0x4e, 0xd8];    // primary blue
  const fg = [0xff, 0xff, 0xff];    // white

  // Build raw RGBA pixel data
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Rounded corners mask
      const r = size * 0.2;
      const cx = size / 2, cy = size / 2;
      const dx = Math.abs(x - cx) - (cx - r);
      const dy = Math.abs(y - cy) - (cy - r);
      const outside = (dx > 0 && dy > 0) ? Math.sqrt(dx * dx + dy * dy) > r : Math.max(dx, dy) > 0;
      if (outside) {
        pixels[idx] = 0; pixels[idx+1] = 0; pixels[idx+2] = 0; pixels[idx+3] = 0;
        continue;
      }
      // Draw simple "NB" text in center using scaled grid
      const col = bg;
      const scale = size / 64;
      const tx = Math.floor(x / scale);
      const ty = Math.floor(y / scale);
      // "N" at columns 12-20, rows 20-44
      // "B" at columns 24-35, rows 20-44
      let lit = false;
      // N shape
      if (tx >= 12 && tx <= 20 && ty >= 20 && ty <= 44) {
        if (tx === 12 || tx === 13 || tx === 19 || tx === 20) lit = true;
        if (ty - 20 >= (tx - 12) * 2 && ty - 20 <= (tx - 12) * 2 + 3) lit = true;
      }
      // B shape
      if (tx >= 24 && tx <= 35 && ty >= 20 && ty <= 44) {
        if (tx === 24 || tx === 25) lit = true;
        if ((ty === 20 || ty === 21) && tx <= 33) lit = true;
        if ((ty === 31 || ty === 32) && tx <= 33) lit = true;
        if ((ty === 43 || ty === 44) && tx <= 33) lit = true;
        if ((tx === 33 || tx === 34) && ty >= 20 && ty <= 32) lit = true;
        if ((tx === 33 || tx === 34) && ty >= 32 && ty <= 44) lit = true;
      }
      const c = lit ? fg : col;
      pixels[idx] = c[0]; pixels[idx+1] = c[1]; pixels[idx+2] = c[2]; pixels[idx+3] = 255;
    }
  }

  // Build PNG file
  const chunks = [];

  // PNG signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  chunks.push(makeChunk('IHDR', ihdr));

  // IDAT chunk - compress scanlines
  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    scanlines[y * (size * 4 + 1)] = 0; // filter type None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * (size * 4 + 1) + 1 + x * 4;
      scanlines[dst] = pixels[src];
      scanlines[dst+1] = pixels[src+1];
      scanlines[dst+2] = pixels[src+2];
      scanlines[dst+3] = pixels[src+3];
    }
  }
  const compressed = zlib.deflateSync(scanlines);
  chunks.push(makeChunk('IDAT', compressed));

  // IEND chunk
  chunks.push(makeChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeB, data]));
  const crcB = Buffer.alloc(4);
  crcB.writeInt32BE(crc);
  return Buffer.concat([len, typeB, data, crcB]);
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  const table = makeCRCTable();
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) | 0;
}

function makeCRCTable() {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
}

import { writeFileSync } from 'fs';
writeFileSync('public/icon-192.png', createPNG(192));
writeFileSync('public/icon-512.png', createPNG(512));
writeFileSync('public/apple-touch-icon.png', createPNG(180));
console.log('Icons generated: icon-192.png, icon-512.png, apple-touch-icon.png');
