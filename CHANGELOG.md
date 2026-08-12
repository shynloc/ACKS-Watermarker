# Changelog

All notable changes are documented here. This project follows [Semantic Versioning](https://semver.org/).

## [2.0.1] - 2026-08-13

### Added

- The selected “Crop Drop” identity as standard and inverse SVG masters.
- Versioned SVG/PNG favicons, Apple Touch Icon, 192 px and 512 px application icons.
- A deterministic Playwright export script and regression coverage for brand assets and responsive header layout.

### Changed

- Replaced the boxed text “A” with the official ACKS Watermarker mark on desktop and mobile.
- Updated the browser title and refreshed Chinese and English documentation screenshots.

## [2.0.0] - 2026-08-13

### Added

- Archival editorial interface for desktop and a task-oriented four-step mobile workflow.
- Curated Chinese and English handwriting fonts through the same-origin Google Fonts gateway.
- Responsive resource budgets for safer mobile image processing.
- Automated browser regression tests and GitHub Actions CI.
- Security headers, a health check, and a read-only container profile.

### Fixed

- Consecutive watermark dragging could stop after a stale Pointer Event remained captured.
- Docker images omitted the visual texture assets used by the v2 interface.
- IndexedDB failures could prevent editing despite claiming an in-memory fallback.
- Rapid batch adjustments could launch overlapping full-grid thumbnail renders.
- Missing static assets incorrectly returned the application HTML with status 200.

### Changed

- Removed the remotely executed AI background-removal module. Lightweight background removal and repair remain local to the browser.
- Reduced high-memory repair and export limits on constrained devices.

[2.0.1]: ../../releases/tag/v2.0.1
[2.0.0]: ../../releases/tag/v2.0.0
