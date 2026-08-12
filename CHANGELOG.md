# Changelog

All notable changes are documented here. This project follows [Semantic Versioning](https://semver.org/).

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

[2.0.0]: ../../releases/tag/v2.0.0
