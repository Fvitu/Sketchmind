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

// ── Brand Colors ─────────────────────────────────────────────────────────────
const BRAND_BLUE = { r: 34, g: 211, b: 238 }; // #22d3ee (Matches primary brand cyan)
const DARK_BG    = { r: 10, g: 10, b: 10 };    // #0a0a0a (Matches app theme)

// ── Standard icons (Android Deck - NO BORDERS) ───────────────────────────────
const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

for (const size of sizes) {
  const outPath = path.join(iconsDir, `icon-${size}x${size}.png`);
  // Use 'cover' to ensure the logo fills the entire square and eliminates white borders
  await sharp(src)
    .resize(size, size, { fit: 'cover' })
    .flatten({ background: DARK_BG })
    .png()
    .toFile(outPath);
  console.log(`✓ icon-${size}x${size}.png`);
}

// ── Apple touch icons (Should have no transparency) ──────────────────────────
const appleSizes = [
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 152, name: 'apple-touch-icon-152x152.png' },
  { size: 120, name: 'apple-touch-icon-120x120.png' },
];
for (const { size, name } of appleSizes) {
  const outPath = path.join(iconsDir, name);
  await sharp(src)
    .resize(size, size, { fit: 'cover' })
    .flatten({ background: DARK_BG })
    .png()
    .toFile(outPath);
  console.log(`✓ ${name}`);
}

// ── Maskable icons (Home Screen - Full Brand Blue) ────────────────────────────
for (const size of [192, 512]) {
  const logoSize = Math.round(size * 0.85);
  const offset   = Math.round((size - logoSize) / 2);

  const logoBuffer = await sharp(src)
    .resize(logoSize, logoSize, { fit: 'contain', background: { ...BRAND_BLUE, alpha: 0 } })
    .png()
    .toBuffer();

  const outPath = path.join(iconsDir, `icon-maskable-${size}x${size}.png`);
  await sharp({
    create: { width: size, height: size, channels: 4, background: { ...BRAND_BLUE, alpha: 1 } },
  })
    .composite([{ input: logoBuffer, top: offset, left: offset }])
    .png()
    .toFile(outPath);
  console.log(`✓ icon-maskable-${size}x${size}.png`);
}

// ── Shortcut icons ────────────────────────────────────────────────────────────
for (const name of ['shortcut-new.png', 'shortcut-boards.png']) {
  await sharp(src).resize(96, 96, { fit: 'contain', background: { ...DARK_BG, alpha: 0 } }).flatten({ background: DARK_BG }).png().toFile(path.join(iconsDir, name));
  console.log(`✓ ${name}`);
}

// ── 32×32 favicon ─────────────────────────────────────────────────────────────
await sharp(src).resize(32, 32, { fit: 'contain', background: { ...DARK_BG, alpha: 0 } }).flatten({ background: DARK_BG }).png().toFile(path.join(iconsDir, 'favicon-32x32.png'));
console.log('✓ favicon-32x32.png');

console.log('\n🎉 All PWA icons generated with NO BORDERS for Android!');
