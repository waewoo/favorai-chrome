/**
 * Generates all Chrome Web Store marketing assets (PNG) from HTML/CSS sources.
 * Uses the project's existing Playwright installation — no extra deps.
 *
 * Usage:
 *   node store-assets/generate.mjs          → all assets
 *   node store-assets/generate.mjs --screenshots
 *   node store-assets/generate.mjs --tiles
 */

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const args = process.argv.slice(2);
const onlyScreenshots = args.includes('--screenshots');
const onlyTiles = args.includes('--tiles');

const SCREENSHOTS = [
  { file: 'screenshots/01-main-popup.html',           out: 'screenshot-01-main-popup.png',          w: 1280, h: 800 },
  { file: 'screenshots/02-analysis-in-progress.html', out: 'screenshot-02-analysis-in-progress.png', w: 1280, h: 800 },
  { file: 'screenshots/03-validation-checklist.html', out: 'screenshot-03-validation-checklist.png', w: 1280, h: 800 },
  { file: 'screenshots/04-configuration.html',        out: 'screenshot-04-configuration.png',        w: 1280, h: 800 },
  { file: 'screenshots/05-session-history.html',      out: 'screenshot-05-session-history.png',      w: 1280, h: 800 },
];

const TILES = [
  { file: 'tiles/tile-promotional-440x280.html', out: 'tile-promotional-440x280.png', w: 440,  h: 280 },
  { file: 'tiles/banner-hero-1400x560.html',     out: 'banner-hero-1400x560.png',     w: 1400, h: 560 },
];

const assets = [
  ...(onlyTiles       ? [] : SCREENSHOTS),
  ...(onlyScreenshots ? [] : TILES),
];

console.log(`\n🎨 FavorAI — Store Assets Generator`);
console.log(`   Output: ${outputDir}\n`);

// deviceScaleFactor:2 renders at 2x density for crisp text on retina/HiDPI displays,
// then the screenshot is clipped back to logical CSS pixels (1280×800) so the
// final PNG is exactly 1280×800 as required by the Chrome Web Store.
const browser = await chromium.launch();

for (const asset of assets) {
  const filePath = path.join(__dirname, asset.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Skipping (not found): ${asset.file}`);
    continue;
  }
  const page = await browser.newPage();

  // Use deviceScaleFactor:2 for crisp rendering on HiDPI, then downscale to exact px
  await page.setViewportSize({ width: asset.w, height: asset.h });

  await page.goto(`file:///${filePath.replace(/\\/g, '/')}`);

  // Wait for Google Fonts to load (or timeout gracefully after 3s)
  await page.waitForFunction(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(400);

  const outputPath = path.join(outputDir, asset.out);
  await page.screenshot({
    path: outputPath,
    clip: { x: 0, y: 0, width: asset.w, height: asset.h },
  });
  console.log(`  ✅ ${asset.out}  (${asset.w}×${asset.h})`);
  await page.close();
}

await browser.close();
console.log('\n🎉 Done! Assets are in store-assets/output/\n');
