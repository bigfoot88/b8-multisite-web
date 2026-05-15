# Copilot instructions for `b8-multisite-web`

## Commands

This repository is planned as a Node.js app. The implementation plan currently defines:

- Install dependencies: `npm install`
- Start the app: `npm start`
- Development server: `npm run dev`
- Run all tests: `npm test` or `node --test`
- Run a single test file: `node --test tests/app-smoke.test.js`

If you need to focus on one area, run the smallest relevant `node --test` target instead of the full suite.

## High-level architecture

This project is a single-process multisite web app for `dma` and `bigfoot`.

- The public site is server-rendered with Express and EJS.
- The admin area lives in the same app and uses shared auth/session helpers.
- SQLite stores structured content; uploaded files live on disk in local storage.
- Content is site-scoped with `site_key` values such as `dma` and `bigfoot`.
- The app uses one shared design system with per-site branding/theme tokens.
- Brochures, downloads, cover images, logos, and QR assets are modeled as media records attached to pages, products, solutions, and site settings rather than as a separate subsystem.
- Site migration is driven by crawler-generated inventories and redirect maps under `data/migration/`, with seed content under `data/seeds/`.

## Key conventions

- Always filter content by `site_key`; most tables are multisite and unique constraints are usually scoped per site.
- Prefer the repository layer for database access instead of querying SQLite directly from routes or views.
- Treat content states consistently with the schema: many records are `draft` or `published`, and deleted content is soft-deleted with `deleted_at`.
- Media is referenced through `*_media_id` fields; avoid inlining file paths into content models.
- Keep the public site and admin site concerns separate even though they share the same server process.
- The HTML rendering stack is EJS plus vanilla CSS/JS; do not assume a frontend framework.
- Crawling/importing is part of the data pipeline: capture inventory first, then model and seed content from that inventory.
