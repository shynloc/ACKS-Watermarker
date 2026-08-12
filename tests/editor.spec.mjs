import { expect, test } from '@playwright/test';

const demoImage = {
  name: 'demo-landscape.svg',
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#89aec4"/><stop offset="1" stop-color="#e7d5b5"/></linearGradient></defs>
    <rect width="1200" height="800" fill="url(#sky)"/><path d="M0 630 260 400 430 570 670 310 900 560 1200 370V800H0Z" fill="#b96845"/>
    <path d="M0 705 330 520 580 680 830 470 1200 640V800H0Z" fill="#e0aa73" opacity=".88"/>
  </svg>`)
};

async function uploadBase(page) {
  await page.locator('#imgInput').setInputFiles(demoImage);
  await expect(page.locator('#imgWrap')).toBeVisible();
  await expect(page.locator('#mobileExportBtn')).toBeEnabled();
}

async function dragBy(page, locator, dx, dy) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}

test('the selected brand mark and icons load across desktop and mobile', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto('/');

  await expect(page).toHaveTitle('ACKS Watermarker · 水印工坊');
  const brand = page.locator('.brand-mark');
  await expect(brand).toBeVisible();
  await expect(brand).toHaveAttribute('alt', 'ACKS Watermarker');
  expect(await brand.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);

  const iconLinks = await page.locator('link[rel~="icon"], link[rel="apple-touch-icon"]').evaluateAll(links =>
    links.map(link => link.getAttribute('href'))
  );
  expect(iconLinks).toEqual([
    'assets/brand/favicon.svg?v=3',
    'assets/brand/favicon-32x32.png?v=3',
    'assets/brand/favicon-16x16.png?v=3',
    'assets/brand/apple-touch-icon.png?v=3'
  ]);
  expect(iconLinks.every(href => href && !href.startsWith('/'))).toBe(true);

  for (const href of iconLinks) {
    const response = await request.get(`/${href}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^image\/(svg\+xml|png)/);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const layout = await page.evaluate(() => {
    const header = document.querySelector('.center-head').getBoundingClientRect();
    const mark = document.querySelector('.brand-mark').getBoundingClientRect();
    const mode = document.querySelector('#modeSeg').getBoundingClientRect();
    return {
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      markInsideHeader: mark.left >= header.left && mark.right <= header.right && mark.top >= header.top && mark.bottom <= header.bottom,
      markBeforeMode: mark.right <= mode.left
    };
  });
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.markInsideHeader).toBe(true);
  expect(layout.markBeforeMode).toBe(true);
});

test('a watermark remains draggable across consecutive gestures and exports', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

  await page.goto('/');
  await uploadBase(page);
  await page.locator('#textInput').fill('ACKS WATERMARKER');
  await page.locator('#addTextBtn').click();

  const watermark = page.locator('.wm.selected');
  await expect(watermark).toBeVisible();
  const startLeft = await watermark.evaluate(node => Number.parseFloat(node.style.left));
  await dragBy(page, watermark, 80, 10);
  const firstLeft = await watermark.evaluate(node => Number.parseFloat(node.style.left));
  await dragBy(page, watermark, -45, 30);
  const secondLeft = await watermark.evaluate(node => Number.parseFloat(node.style.left));

  expect(Math.abs(firstLeft - startLeft)).toBeGreaterThan(1);
  expect(Math.abs(secondLeft - firstLeft)).toBeGreaterThan(1);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^watermarked_.+\.png$/);
  expect(consoleErrors).toEqual([]);
});

test('mobile workflow fits the viewport and keeps four clear steps', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await uploadBase(page);

  const actions = page.locator('.mobile-actions > button');
  await expect(actions).toHaveCount(4);
  await expect(page.locator('#mobileAssetBtn')).toHaveClass(/is-current/);

  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    body: document.body.scrollWidth,
    app: document.querySelector('.app').scrollWidth,
    nav: document.querySelector('.mobile-actions').getBoundingClientRect().width
  }));
  expect(metrics.body).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.app).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.nav).toBeLessThanOrEqual(metrics.viewport);

  await page.locator('#mobileEditBtn').click();
  await expect(page.locator('#rightPanel')).toHaveClass(/open/);
  await expect(page.locator('#backdrop')).toHaveClass(/show/);
});

test('online font requests never include watermark text', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto('/');
  await uploadBase(page);
  await page.locator('#textInput').fill('PRIVATE WATERMARK TEXT');
  const requestPromise = page.waitForRequest(request => request.url().includes('/google-fonts/css2'));
  await page.locator('#textFont').selectOption('maShanZheng');
  const request = await requestPromise;
  const url = new URL(request.url());
  expect(url.searchParams.get('family')).toContain('Ma Shan Zheng');
  expect(url.searchParams.has('text')).toBe(false);
  expect(request.url()).not.toContain('PRIVATE');
});

test('editing remains usable when IndexedDB is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: { open() { throw new Error('storage disabled for test'); } }
    });
  });
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto('/');
  await uploadBase(page);
  await page.locator('#textInput').fill('MEMORY MODE');
  await page.locator('#addTextBtn').click();
  await expect(page.locator('.wm.selected')).toContainText('MEMORY MODE');
  await expect(page.locator('#toastWrap')).toContainText('刷新后不会自动恢复');
});

test('unknown static resources return 404 instead of the application HTML', async ({ request }) => {
  const response = await request.get('/assets/not-present.png');
  expect(response.status()).toBe(404);
});
