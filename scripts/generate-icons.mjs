/**
 * generate-icons.mjs
 * Generates all required PWA icons from public/Sketchmind.png using sharp.
 * Run once: npm run generate-icons
 */

import sharp from 'sharp';
import { mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'public', 'Sketchmind.png');
const iconsDir = path.join(root, 'public', 'icons');

mkdirSync(iconsDir, { recursive: true });

// ── Standard icons (logo fills the full canvas) ──────────────────────────────
const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

for (const size of sizes) {
  const outPath = path.join(iconsDir, `icon-${size}x${size}.png`);
  await sharp(src).resize(size, size, { fit: 'contain', background: { r: 10, g: 10, b: 10, alpha: 1 } }).png().toFile(outPath);
  console.log(`✓ icon-${size}x${size}.png`);
}

// ── Apple touch icons ─────────────────────────────────────────────────────────
const appleSizes = [
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 152, name: 'apple-touch-icon-152x152.png' },
  { size: 120, name: 'apple-touch-icon-120x120.png' },
];
for (const { size, name } of appleSizes) {
  const outPath = path.join(iconsDir, name);
  await sharp(src).resize(size, size, { fit: 'contain', background: { r: 10, g: 10, b: 10, alpha: 1 } }).png().toFile(outPath);
  console.log(`✓ ${name}`);
}

// ── Maskable icons (logo at 80%, brand bg fills safe-zone padding) ────────────
for (const size of [192, 512]) {
  const logoSize = Math.round(size * 0.8);
  const padding  = Math.round(size * 0.1);

  const logoBuffer = await sharp(src)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 10, g: 10, b: 10, alpha: 0 } })
    .png()
    .toBuffer();

  const outPath = path.join(iconsDir, `icon-maskable-${size}x${size}.png`);
  await sharp({
    create: { width: size, height: size, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 1 } },
  })
    .composite([{ input: logoBuffer, top: padding, left: padding }])
    .png()
    .toFile(outPath);
  console.log(`✓ icon-maskable-${size}x${size}.png`);
}

// ── Shortcut icons ────────────────────────────────────────────────────────────
for (const name of ['shortcut-new.png', 'shortcut-boards.png']) {
  await sharp(src).resize(96, 96, { fit: 'contain', background: { r: 10, g: 10, b: 10, alpha: 1 } }).png().toFile(path.join(iconsDir, name));
  console.log(`✓ ${name}`);
}

// ── 32×32 favicon ─────────────────────────────────────────────────────────────
await sharp(src).resize(32, 32, { fit: 'contain', background: { r: 10, g: 10, b: 10, alpha: 1 } }).png().toFile(path.join(iconsDir, 'favicon-32x32.png'));
console.log('✓ favicon-32x32.png');

console.log('\n🎉 All PWA icons generated from Sketchmind.png!');
