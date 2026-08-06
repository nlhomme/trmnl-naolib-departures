# Naolib - Nearby Departures – TRMNL Plugin

Displays real-time upcoming departures from the nearest Naolib (TAN) stop to any location in Nantes.

## Preview

A preview of this plugin is available at [https://trmnl.com/recipes/256931/demo](https://trmnl.com/recipes/256931/demo)

## How It Works

1. A Cloudflare Worker (`worker.js`) acts as a proxy: it resolves the Naolib stop nearest to your coordinates, fetches its real-time departures from the Nantes Métropole SIRI API, then returns the combined data in TRMNL's `merge_variables` format.
2. TRMNL polls the Worker URL with your coordinates and displays the departure board using the Liquid templates in the `views/` folder.
3. The display refreshes at the interval configured in TRMNL (5 minutes minimum).

## Architecture

```text
TRMNL polls → Cloudflare Worker?lat=...&lng=...
               → nearest stop resolved from stops.js (bundled GTFS index)
               → POST SIRI StopMonitoring (one sub-request per quay of the stop)
               → returns { merge_variables: { stop, departures, refreshed_at } }
TRMNL renders views/*.liquid with {{ merge_variables.* }}
```

## Installation

### 1. Deploy the Cloudflare Worker

You need a [Cloudflare account](https://dash.cloudflare.com/sign-up) (the free plan is sufficient).

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

The Worker URL will be displayed after deployment (e.g. `https://naolib-worker.your-subdomain.workers.dev`).

> ⚠️ **Important:** Make sure no **Cron Trigger** is configured on the Worker. In the Cloudflare dashboard → Workers & Pages → `naolib-worker` → Settings → Triggers, delete any cron trigger if present. This Worker only responds to HTTP requests (TRMNL polling) and does not export a `scheduled()` function — an active cron trigger would cause errors.

> If you cannot host the Worker yourself, send an email to `adverbe_upsilon2z@icloud.com` to get a ready-to-use polling URL.

### 2. Find Your Coordinates

Use any map tool (e.g. Google Maps → right-click → copy coordinates) to get the latitude and longitude of the location you want to monitor.

Both dot and comma decimal separators are accepted: `47.21661` works as well as `47,21661`. (The old TAN API required commas, so existing configurations keep working.)

### 3. Install the Plugin

Install the plugin from the TRMNL community store ([link](https://trmnl.com/recipes/256931)), then configure the settings:

- **Strategy**: Polling
- **Polling URL**: Your Worker URL with coordinates, e.g.:

  ```text
  https://naolib-worker.your-subdomain.workers.dev/?lat=47,21661&lng=-1,556754
  ```

- **Refresh interval**: 5 minutes (unfortunately you can't set it lower)

### 4. Paste the Template

Copy the contents of each file in the `views/` folder into the corresponding field in the TRMNL plugin editor:

- `views/full.liquid` → **Full** field
- `views/half-horizontal.liquid` → **Half (Horizontal)** field
- `views/half-vertical.liquid` → **Half (Vertical)** field
- `views/quadrant.liquid` → **Quadrant** field

## Display

- **Rounded square badge** = tram line
- **Pill-shaped badge** = bus line
- **Filled dot** = real-time data
- **Hollow dot** = theoretical schedule only
- Wait time displayed in minutes (e.g. `5mn`, `proche`)

## Files

| File | Description |
| --- | --- |
| `worker.js` | Cloudflare Worker — resolves the nearest stop and fetches departures over SIRI |
| `stops.js` | Naolib stop index (name, coordinates, quays) generated from the GTFS feed |
| `build-stops.mjs` | Regenerates `stops.js` from the GTFS feed published by Nantes Métropole |
| `test.mjs` | Worker checks (`node test.mjs`) |
| `test-fixture.xml` | Real SIRI response used by the tests |
| `.github/workflows/refresh-stops.yml` | Rebuilds and redeploys the stop index weekly |
| `wrangler.toml` | Worker deployment configuration |
| `views/full.liquid` | Liquid template — full screen view |
| `views/half-horizontal.liquid` | Liquid template — horizontal half-screen view |
| `views/half-vertical.liquid` | Liquid template — vertical half-screen view |
| `views/quadrant.liquid` | Liquid template — quarter-screen view |
| `settings.yml` | Plugin settings reference (not synced with TRMNL) |

## API

The old `open.tan.fr` API has been retired. The plugin now uses the [Nantes Métropole SIRI real-time services](https://data.nantesmetropole.fr/explore/dataset/244400404_services_temps_reel_transports_commun_naolib_nantes_metropole_siri/information/). No API key is required.

- Departures: `POST https://api.okina.fr/gateway/sem/realtime/anshar/services` with a `StopMonitoringRequest` XML body

Two limits of anonymous (keyless) access shape the Worker:

- **1 request every 30 seconds.** All quays of a stop are therefore requested in a single POST. Keep the TRMNL refresh interval well above 30s.
- **SIRI only, no SIRI Lite** (the REST/JSON flavour needs an authenticated key), and SIRI offers no geographic search.

That is why stops are bundled in `stops.js`, generated from the [Naolib GTFS feed](https://data.nantesmetropole.fr/explore/dataset/244400404_transports_commun_naolib_nantes_metropole_gtfs/information/).

### Keeping the index fresh

The GTFS feed is reissued roughly monthly. When a quay id changes, SIRI returns an empty delivery rather than an error, so a stale index renders as "no departures" — indistinguishable from a quiet stop at 2am.

`.github/workflows/refresh-stops.yml` rebuilds the index every Monday and, **only if `stops.js` actually changed**, runs the tests, commits and redeploys. A rebuild against an unchanged feed is byte-identical, so quiet weeks produce no commits and no deploys.

Two guards, since the job runs unattended:

- `build-stops.mjs` refuses to write an index of fewer than 900 stops (1044 today), so a truncated download cannot overwrite a good index.
- `node test.mjs` must pass before the deploy step runs.

For the job to work:

- it must live on the **default branch** — GitHub only fires `schedule` triggers from there;
- the **`CLOUDFLARE_API_TOKEN`** secret must be set under Settings → Secrets and variables → Actions (wrangler's local OAuth login does not exist in CI). Create one with the *Edit Cloudflare Workers* template.

`workflow_dispatch` triggers a run manually. Locally:

```bash
node build-stops.mjs && git diff --stat stops.js
```

## Acknowledgements

A big thank you to Nantes Métropole for providing open transport data for Naolib.

Thanks to the [TRMNL](https://trmnl.com) team for creating their amazing devices.

Thanks also to Steve Karmeinsky ([@stevekennedyuk](https://github.com/stevekennedyuk)) for his London transport status plugin ([trmnl-tfl-status](https://github.com/stevekennedyuk/trmnl-tfl-status)) which inspired this project.

Thanks to Anthropic for building Claude Code, which made creating the JS Worker a matter of seconds.

Finally, thanks to Mario from TRMNL support for his advice and for fixing my code just before the plugin was published.
