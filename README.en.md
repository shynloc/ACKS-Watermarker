# ACKS Watermarker

[中文](README.md) · [English](README.en.md)

![Version](https://img.shields.io/badge/version-v2.0.0-a72c26) ![License](https://img.shields.io/badge/license-MIT-282722) ![Runtime](https://img.shields.io/badge/runtime-browser%20only-c98716) [![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

ACKS Watermarker is a privacy-minded browser watermark studio. It supports image and text watermarks, direct manipulation, handwriting fonts, batch workflows, lightweight local background removal, local repair, and PNG, JPG, or ZIP export. Image processing and export happen in the current browser without an application backend.

![ACKS Watermarker desktop interface](docs/screenshots/desktop.png)

## Design and workflow

Version 2 uses a warm paper, archival red, and black-metal visual language. Desktop keeps the complete canvas, asset strip, and property panel visible. Mobile follows the real task order with four clear steps: **Import image → Assets → Edit → Export**.

<p align="center">
  <img src="docs/screenshots/mobile.png" width="390" alt="ACKS Watermarker mobile interface" />
</p>

## Features

- **Image and text watermarks** using logos, PNG, JPG, WebP, SVG, or editable text.
- **Direct editing** with drag, pinch, rotation, four-corner proportional resize, opacity, layer ordering, and alignment controls.
- **Rich typography** with system fonts, common Google Fonts, Chinese and English handwriting faces, and multiple weights.
- **Same-origin font gateway** so browsers contact only the current site while nginx fetches and caches Google Fonts.
- **Batch workflow** with shared templates, per-image adjustment, global controls, and ZIP export.
- **Local image tools** for lightweight background removal and neighboring-pixel repair.
- **PNG and JPG export** at 1x, 2x, or 3x. Export redraws the image and does not preserve source EXIF or C2PA metadata.
- **Session recovery** through IndexedDB, with a usable in-memory fallback when persistent storage is unavailable.
- **Responsive resource budgets** that reduce pixel limits on mobile and memory-constrained devices.
- **Accessibility basics** including keyboard movement and deletion, visible focus, ARIA state, and reduced-motion support.

## Technology stack

| Layer | Technology |
| --- | --- |
| Interface | HTML5, CSS3, vanilla JavaScript |
| Imaging | Canvas API, Blob/Object URL, Pointer Events |
| Local storage | IndexedDB |
| Fonts | Google Fonts CSS API through a same-origin nginx cache |
| Batch export | Built-in dependency-free ZIP Store encoder |
| Web service | nginx Alpine, Docker, Docker Compose |
| Testing | Playwright, GitHub Actions |

There is no runtime framework, database, or application backend. Node.js is used only for development tests and reproducible documentation screenshots.

## Project structure

```text
.
├── index.html                 # Document structure and styles
├── app.js                     # Editor state, interactions, and export logic
├── assets/                    # Local interface textures
├── nginx.conf                 # Static serving, security headers, font gateway
├── Dockerfile
├── compose.yaml
├── tests/                     # Playwright regressions
├── scripts/capture-docs.mjs   # Reproducible documentation screenshots
└── docs/screenshots/          # README interface screenshots
```

## Local deployment

### Recommended: Docker Compose

Docker includes the same-origin Google Fonts gateway and production security headers.

```bash
git clone <repository-url>
cd ACKS-Watermarker
docker compose up -d --build
docker compose ps
```

Open <http://127.0.0.1:8080/>.

Choose another loopback port if 8080 is already occupied:

```bash
ACKS_PORT=8765 docker compose up -d --build
```

Stop the service with `docker compose down`.

### Basic static preview

For interface work that only needs system fonts:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765/>. A basic static server does not provide the Google Fonts gateway, so online fonts are unavailable.

### Development and tests

Node.js 22 or a compatible version is required:

```bash
npm ci
npx playwright install chromium
npm test
```

To regenerate the README screenshots, start the Docker service and run:

```bash
ACKS_SCREENSHOT_URL=http://127.0.0.1:8080 npm run docs:screenshots
```

## Server deployment

The server needs Docker, Docker Compose, and outbound HTTPS access to `fonts.googleapis.com` and `fonts.gstatic.com`.

```bash
git clone <repository-url>
cd ACKS-Watermarker
ACKS_PORT=8080 docker compose up -d --build
docker compose ps
```

Compose binds only to `127.0.0.1` by default. Publish it through a host nginx, Caddy, or another HTTPS reverse proxy.

### nginx subpath example

```nginx
location = /watermark {
    return 301 /watermark/;
}

location /watermark/ {
    proxy_pass http://127.0.0.1:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

The application uses relative paths, so the page, textures, script, and font gateway continue to work under a subpath.

### Updating and rollback

Record the current commit and image ID and retain a source backup before upgrading:

```bash
git pull --ff-only
docker compose build
docker compose up -d
docker compose ps
docker compose exec watermarker nginx -t
```

After deployment, verify the page, `app.js`, both textures, font CSS, font files, and a real export. Keep the previous image under a rollback tag for important deployments.

## Usage

### Single image

1. Import a PNG, JPG, or WebP image.
2. Upload a logo/watermark asset or add text and choose its font, weight, and color.
3. Select the watermark on the canvas and adjust position, handles, sliders, or alignment.
4. Choose format, scale, and JPG quality.
5. Export and inspect the result.

### Batch

1. Switch to Batch and add multiple images.
2. Choose one or more watermark assets and a layout preset.
3. Open an image for individual adjustment or promote its layout to the shared template.
4. Set global opacity, scale, and rotation.
5. Choose format and resolution, then export a ZIP archive.

Online fonts must finish loading before export. If a font fails, export stops instead of silently substituting another face.

## Privacy and security

- Source images, watermark assets, repair strokes, and exports remain in browser memory or IndexedDB and are not sent to the application server.
- Google Fonts requests use the same-origin nginx gateway. It removes cookies, referrers, forwarded client IP headers, and upstream preconnect headers.
- Font requests contain only family and weight; watermark text is not included in the network query.
- CSP blocks third-party script execution and restricts image, font, and network sources.
- The container binds to loopback by default and uses a read-only root filesystem with `no-new-privileges`.
- Never attach private source images, credentials, or unsanitized screenshots to public issues.

## Browser support

Use a current stable Chrome, Edge, Safari, or Firefox. Very large images, 3x export, and repair are memory intensive. The application adapts pixel budgets to the device, but 1x is still recommended on mobile.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Run `npm test` before submitting changes and ensure no private images, credentials, server addresses, or local absolute paths are committed.

## Feedback and security reports

- Reproducible bugs and feature requests: [open an issue](../../issues)
- General feedback: <mail@jintao.uk>
- Vulnerabilities: follow [SECURITY.md](SECURITY.md) and do not disclose them publicly.

## License

Released under the [MIT License](LICENSE). Mobile navigation icons come from Tabler Icons; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

See [CHANGELOG.md](CHANGELOG.md) for release history.
