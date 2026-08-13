/**
 * FarmBond PWA icon generator.
 *
 * Rasterizes the existing brand mark (public/logo.svg — black squircle with
 * white ring, leaf and horizon bar) into the four PNG icons referenced by
 * public/manifest.webmanifest and index.html:
 *
 *   /icons/icon-192.png          192x192  purpose: any
 *   /icons/icon-512.png          512x512  purpose: any
 *   /icons/icon-maskable-192.png 192x192  purpose: maskable
 *   /icons/icon-maskable-512.png 512x512  purpose: maskable
 *
 * Maskable icons sit on a solid FarmBond-green background (#2d6a4f, the
 * manifest theme_color) with the logo scaled to ~62% so it stays well inside
 * the 80% safe zone that Android applies when cropping maskable icons.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = path.join(root, "public", "logo.svg");
const outDir = path.join(root, "public", "icons");

// FarmBond brand green (#2d6a4f) — matches manifest theme_color.
const BRAND_GREEN = { r: 45, g: 106, b: 79, alpha: 1 };

async function main() {
  await mkdir(outDir, { recursive: true });

  // --- purpose: "any" — the full-bleed brand mark (has its own rounded corners) ---
  for (const size of [192, 512]) {
    await sharp(logoPath)
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, `icon-${size}.png`));
    console.log(`wrote icon-${size}.png (${size}x${size})`);
  }

  // --- purpose: "maskable" — solid brand background + logo scaled into the safe zone ---
  for (const size of [192, 512]) {
    const logoSize = Math.round(size * 0.62);
    const logo = await sharp(logoPath).resize(logoSize, logoSize).png().toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 4, background: BRAND_GREEN },
    })
      .composite([{ input: logo, gravity: "centre" }])
      .png()
      .toFile(path.join(outDir, `icon-maskable-${size}.png`));
    console.log(`wrote icon-maskable-${size}.png (${size}x${size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
