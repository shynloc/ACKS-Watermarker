# ACKS Watermarker

ACKS Watermarker is a browser-based image watermark studio. It supports image and text watermarks, draggable editing, batch processing, local image repair, background removal, and privacy-friendly export.

Images are processed in the browser and are not uploaded to an application server. When an online font is selected, the included nginx configuration loads Google Fonts through a same-origin server proxy so the browser does not connect to Google directly.

## Features

- Add image, logo, and text watermarks.
- Drag, rotate, resize, reorder, recolor, and adjust watermark opacity.
- Use system fonts, general Google Fonts, and grouped Chinese or English handwriting fonts.
- Process multiple images with a shared template and export them as a ZIP archive.
- Export PNG or JPG at 1x, 2x, or 3x scale.
- Save the current single-image session in IndexedDB for refresh recovery.
- Apply a local repair brush to simple unwanted regions.
- Remove image backgrounds in the browser with a dynamically loaded model.
- Responsive layout for desktop and mobile browsers.

## Technology stack

- HTML5 and CSS3
- Vanilla JavaScript
- Canvas API and Pointer Events
- IndexedDB
- Docker
- nginx static hosting, reverse proxying, and font caching
- Google Fonts CSS API through a same-origin proxy
- `@imgly/background-removal` loaded from jsDelivr only when background removal is requested

No framework or application backend is required.

## Local deployment

### Full Docker preview

Docker is recommended because it includes the same-origin Google Fonts proxy.

```bash
git clone <repository-url>
cd ACKS-Watermarker
docker compose up -d --build
```

Open <http://127.0.0.1:8080/>.

Stop the local service with:

```bash
docker compose down
```

### Basic static preview

For interface development that does not require online fonts:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765/>.

The basic static server does not provide the Google Fonts proxy. System fonts and the rest of the editor remain available.

## Server deployment

Requirements:

- A Linux server with Docker and Docker Compose
- Outbound HTTPS access to `fonts.googleapis.com`, `fonts.gstatic.com`, and `cdn.jsdelivr.net`
- An optional host-level reverse proxy for HTTPS and a custom domain

Build and start the container:

```bash
git clone <repository-url>
cd ACKS-Watermarker
docker compose up -d --build
docker compose ps
```

The default Compose configuration listens only on `127.0.0.1:8080`.

Example host nginx configuration for publishing the app below `/watermark/`:

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

After updating the source, rebuild the image and recreate the service:

```bash
git pull --ff-only
docker compose up -d --build
docker compose ps
```

Before replacing an important deployment, keep a copy of the current source and record the currently running image ID so it can be restored if verification fails.

## Usage

1. Upload a base image.
2. Upload a logo or add a text watermark.
3. Select a watermark on the canvas to drag, resize, rotate, recolor, or change its font.
4. Choose PNG or JPG and the required export scale.
5. Select **Export image**. For multiple images, switch to batch mode, prepare a template, and export a ZIP archive.

Online fonts must finish loading before export. If a font cannot be loaded, the app stops the export instead of silently substituting a different font.

## Privacy and external network access

- Base images, watermark assets, and rendered exports stay in the browser.
- Online font CSS and font files are requested through the included nginx proxy.
- User cookies, referrers, and forwarded client IP headers are not sent to Google Fonts.
- The optional background-removal feature downloads its JavaScript module and model assets from jsDelivr when first used; the selected image is still processed locally in the browser.
- Export redraws the image and does not preserve original EXIF or C2PA metadata.

## Feedback

Please [open a GitHub issue](../../issues) for reproducible bugs and feature requests, or email [mail@jintao.uk](mailto:mail@jintao.uk).

When reporting a bug, include the browser version, operating system, steps to reproduce, and a screenshot when appropriate. Do not attach private or sensitive source images to a public issue.
