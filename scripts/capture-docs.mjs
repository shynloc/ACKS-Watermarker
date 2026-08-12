import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseURL = process.env.ACKS_SCREENSHOT_URL || 'http://127.0.0.1:18080';
const outputDir = resolve('docs/screenshots');
await mkdir(outputDir, { recursive: true });

const landscape = {
  name: 'acks-demo-landscape.svg',
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1000" viewBox="0 0 1500 1000">
    <defs>
      <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#7fa9c0"/><stop offset=".62" stop-color="#d9c7a6"/><stop offset="1" stop-color="#efc990"/></linearGradient>
      <linearGradient id="rock" x2="1" y2="1"><stop stop-color="#bd6848"/><stop offset="1" stop-color="#7f3f33"/></linearGradient>
    </defs>
    <rect width="1500" height="1000" fill="url(#sky)"/>
    <circle cx="1170" cy="220" r="92" fill="#f3dfb1" opacity=".76"/>
    <path d="M0 690 280 430 475 620 760 330 1010 615 1280 420 1500 560V1000H0Z" fill="url(#rock)"/>
    <path d="M0 780 350 575 620 760 900 530 1180 720 1500 610V1000H0Z" fill="#d79a67" opacity=".9"/>
    <path d="M0 875C280 760 480 900 760 795s490 45 740-45v250H0Z" fill="#ead0a3" opacity=".72"/>
  </svg>`)
};

const logo = {
  name: 'acks-demo-mark.svg',
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="180" viewBox="0 0 500 180">
    <rect x="6" y="6" width="488" height="168" rx="10" fill="none" stroke="white" stroke-width="12"/>
    <text x="250" y="120" text-anchor="middle" fill="white" font-family="serif" font-size="92" letter-spacing="18">ACKS</text>
  </svg>`)
};

async function prepare(page, text) {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.locator('#imgInput').setInputFiles(landscape);
  await page.locator('#imgWrap').waitFor({ state: 'visible' });
  await page.locator('#assetInput').setInputFiles(logo);
  await page.locator('.asset-card').waitFor({ state: 'visible' });
  if ((await page.viewportSize()).width <= 1050) await page.locator('#mobileAssetBtn').click();
  await page.locator('.asset-card').click();
  await page.locator('#wmLayer').click({ position: { x: 8, y: 8 } });
  if ((await page.viewportSize()).width <= 1050) await page.locator('#mobileEditBtn').click();
  await page.locator('#textInput').fill(text);
  await page.locator('#textFont').selectOption('kai');
  await page.locator('#textSize').fill('120');
  await page.locator('#addTextBtn').click();
}

const browser = await chromium.launch();
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
  const desktopPage = await desktop.newPage();
  await prepare(desktopPage, '月光留痕');
  await desktopPage.screenshot({ path: resolve(outputDir, 'desktop.png') });
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobilePage = await mobile.newPage();
  await prepare(mobilePage, '月光留痕');
  await mobilePage.evaluate(() => {
    document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('open'));
    document.querySelector('#backdrop').classList.remove('show');
  });
  await mobilePage.waitForTimeout(2500);
  await mobilePage.screenshot({ path: resolve(outputDir, 'mobile.png') });
  await mobile.close();
} finally {
  await browser.close();
}
