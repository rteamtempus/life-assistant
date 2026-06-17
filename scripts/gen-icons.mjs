// Regenerate all PWA icons + favicons from the master icon.
//   node scripts/gen-icons.mjs
// Source: design/assistant-icon.png (square master, >=512px; kept out of
// public/ so the multi-MB original isn't shipped in the build).
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'design/assistant-icon.png');
const iconsDir = join(root, 'public/icons');
const publicDir = join(root, 'public');

// PWA manifest sizes (kept in sync with manifest.webmanifest).
const pwaSizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of pwaSizes) {
  await sharp(src)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(join(iconsDir, `icon-${size}x${size}.png`));
}

// Favicons (PNG — modern browsers accept these).
for (const size of [16, 32, 48]) {
  await sharp(src)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(join(iconsDir, `favicon-${size}.png`));
}

// Apple touch icon (iOS home screen). iOS adds its own rounded corners, so a
// full-bleed square is correct.
await sharp(src)
  .resize(180, 180, { fit: 'cover' })
  .png()
  .toFile(join(publicDir, 'apple-touch-icon.png'));

console.log('Icons regenerated.');
