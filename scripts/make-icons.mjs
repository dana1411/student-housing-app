// Draws the app icon, Android launcher icons and the splash image from the key mark.
// Run: node scripts/make-icons.mjs   (uses Playwright's Chromium to render)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BG = '#1B2A6B', KEY = '#E6B85C';
const mark = (size, pad, round, bg = true) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  ${bg ? `<rect width="512" height="512" ${round ? 'rx="256"' : ''} fill="${BG}"/>` : ''}
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})"><g fill="none" stroke="${KEY}" stroke-width="44" stroke-linecap="round"><circle cx="186" cy="256" r="94"/><path d="M280 256h170M394 256v66M448 256v48"/></g></g></svg>`;
const browser = await chromium.launch();
const page = await browser.newPage();
async function png(svg, size, out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.locator('svg').screenshot({ path: out, omitBackground: true });
}
const res = path.join(root, 'android/app/src/main/res');
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  await png(mark(48 * k, 60, false), 48 * k, `${res}/mipmap-${d}/ic_launcher.png`);
  await png(mark(48 * k, 60, true), 48 * k, `${res}/mipmap-${d}/ic_launcher_round.png`);
  // adaptive icon foreground: 108dp with the mark inside the 66dp safe zone
  await png(mark(108 * k, 150, false, false), 108 * k, `${res}/mipmap-${d}/ic_launcher_foreground.png`);
}
fs.writeFileSync(`${res}/values/ic_launcher_background.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);
// splash: key mark centred on the brand colour
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="${BG}"/><g transform="translate(390 810) scale(0.5859)"><g fill="none" stroke="${KEY}" stroke-width="44" stroke-linecap="round"><circle cx="186" cy="256" r="94"/><path d="M280 256h170M394 256v66M448 256v48"/></g></g></svg>`;
await page.setViewportSize({ width: 1080, height: 1920 });
await page.setContent(`<html><body style="margin:0">${splash}</body></html>`);
await page.locator('svg').screenshot({ path: `${res}/drawable/splash.png` });
// iOS app icon (1024, no transparency)
const ios = path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
if (fs.existsSync(path.dirname(ios))) await png(mark(1024, 0, false).replace('rx="256"', ''), 1024, ios);
await browser.close();
console.log('icons written');
