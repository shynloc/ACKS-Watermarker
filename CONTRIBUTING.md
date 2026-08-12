# Contributing

Thank you for improving ACKS Watermarker.

1. Open an issue for significant behavior or interface changes before implementation.
2. Create a focused branch and keep each commit scoped.
3. Run `npm ci` and `npm test` before submitting a pull request.
4. Verify the Docker image with `docker compose up -d --build` when changing runtime files or nginx configuration.
5. Do not commit private images, credentials, deployment addresses, local absolute paths, or generated browser profiles.

Bug reports should include the operating system, browser version, exact reproduction steps, expected behavior, actual behavior, and a sanitized screenshot when useful.
