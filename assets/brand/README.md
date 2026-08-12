# ACKS Watermarker Brand Assets

Selected identity: **Crop Drop / 裁切水滴**.

## Masters

- `acks-crop-drop.svg`: standard transparent mark for light surfaces.
- `acks-crop-drop-inverse.svg`: inverse transparent mark for dark surfaces.
- `favicon.svg`: optically simplified, ivory-backed browser icon.

All SVG masters are font-free, self-contained, and use only solid fills.

## Raster exports

- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png` — 180 × 180, square ivory background.
- `icon-192.png` — 192 × 192, square ivory background.
- `icon-512.png` — 512 × 512, square ivory background.

Regenerate PNG assets from the SVG masters with:

```bash
npm run brand:export
```

Do not mechanically recolor the standard SVG for dark backgrounds. Use the inverse master so the droplet remains visible and the A-shaped counter keeps the intended contrast.
