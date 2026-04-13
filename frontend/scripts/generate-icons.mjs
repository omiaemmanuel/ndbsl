/**
 * Generates PWA icon PNGs from the NBSL logo using sharp.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dir, '..', 'public');

// Build SVG icon with given pixel size (viewBox 512x512)
function buildSvg(size) {
  const bg = '#1d4ed8'; // primary-700
  const fg = 'white';
  const cx = 256, cy = 272, r = 210;
  const angles = [90, 30, -30, -90, -150, 150];
  const pts = angles.map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return [+(cx + r * Math.cos(rad)).toFixed(2), +(cy - r * Math.sin(rad)).toFixed(2)];
  });
  const hexPath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';
  const spokes = pts.map(([x, y]) => `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`).join('');
  const r2 = size * 0.2; // corner radius

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r2}" ry="${r2}" fill="${bg}"/>
  <g transform="scale(${size / 512})" stroke="${fg}" stroke-width="38" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="${hexPath}"/>
    ${spokes}
  </g>
</svg>`;
}

async function generateIcon(size, filename) {
  const svg = Buffer.from(buildSvg(size));
  await sharp(svg).png().toFile(join(publicDir, filename));
  console.log(`✓ ${filename} (${size}×${size})`);
}

await generateIcon(192, 'icon-192.png');
await generateIcon(512, 'icon-512.png');
await generateIcon(180, 'apple-touch-icon.png');
console.log('Icons generated successfully.');
