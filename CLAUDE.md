# CLAUDE.md

## README synchronization

This project has two README files: `README.md` (French) and `README-english.md` (English). When either file is updated, the other must be updated with the corresponding translation to keep both in sync.

## Project structure

- The **active deployment** uses root-level `worker.js` and `wrangler.toml`. The `naolib-worker/` directory is unused scaffolding — do not use it.
- `settings.yml` is documentation only — it does NOT sync to the TRMNL dashboard.

## Liquid templates

All 4 templates in `views/` share the same logic and only differ in CSS sizing classes. When updating one template, apply the same change to all four:
- `views/full.liquid`
- `views/half-horizontal.liquid`
- `views/half-vertical.liquid`
- `views/quadrant.liquid`

## Worker constraints (TRMNL integration)

- The worker response **must** be wrapped in `{ "merge_variables": { ... } }` for TRMNL to pick it up.
- Liquid templates access data via `{{ merge_variables.* }}`, never `{{ data.* }}`.
- Always return HTTP 200 even on errors (non-200 causes TRMNL to discard data). Include error info in the response body.
- All filtering and limiting of departures must be done **server-side** in `worker.js`. Liquid integer counters and comparisons are unreliable in TRMNL's Liquid engine.

## TRMNL API docs

TRMNL documentation is available at: https://docs.trmnl.com/go/llms.txt

## Naolib real-time API (SIRI)

`open.tan.fr` is dead. Departures come from Nantes Métropole's SIRI StopMonitoring service.

- Endpoint: `POST https://api.okina.fr/gateway/sem/realtime/anshar/services`, XML body, no API key.
- Anonymous access is **SIRI only, not SIRI Lite** — the REST/JSON endpoints (`/siri/2.0/*.json`) return `204` empty with `api-key=guest`, and only accept the key as a header, not a query param.
- Anonymous access is rate-limited to **1 request / 30s**; exceeding it returns `429`. One POST may carry several `StopMonitoringRequest` elements, so fetch every quay of a stop in a single request — never loop.
- `MonitoringRef` must be a **quay** (`FR_NAOLIB:Quay:95`). A `StopPlace` ref returns an empty delivery.
- Line number comes from `LineRef` (`FR_NAOLIB:Line:C2:LOC` → `C2`); `PublishedLineName` is the route name, not the number.

## Stop lookup

SIRI has no geographic search, so `stops.js` bundles a GTFS-derived index (`[name, lat, lon, [quayIds]]`). Regenerate it with `node build-stops.mjs` when the monthly GTFS feed changes. Run `node test.mjs` after touching `worker.js`.
