import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const brandDirectory = path.join(projectDirectory, 'assets', 'brand');
const standardSvg = path.join(brandDirectory, 'acks-crop-drop.svg');
const faviconSvg = path.join(brandDirectory, 'favicon.svg');

const exports = [
  { source: faviconSvg, name: 'favicon-16x16.png', size: 16 },
  { source: faviconSvg, name: 'favicon-32x32.png', size: 32 },
  { source: standardSvg, name: 'apple-touch-icon.png', size: 180, background: '#f4eddf', padding: 18 },
  { source: standardSvg, name: 'icon-192.png', size: 192, background: '#f4eddf', padding: 20 },
  { source: standardSvg, name: 'icon-512.png', size: 512, background: '#f4eddf', padding: 54 }
];

await fs.mkdir(brandDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

for (const item of exports) {
  const svg = await fs.readFile(item.source, 'utf8');
  const inset = item.padding ?? 0;
  const contentSize = item.size - inset * 2;
  await page.setViewportSize({ width: item.size, height: item.size });
  await page.setContent(`
    <style>
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: ${item.background ?? 'transparent'}; }
      main { width: 100%; height: 100%; display: grid; place-items: center; }
      svg { display: block; width: ${contentSize}px; height: ${contentSize}px; }
    </style>
    <main>${svg}</main>
  `);
  await page.screenshot({
    path: path.join(brandDirectory, item.name),
    omitBackground: !item.background
  });
}

await browser.close();
