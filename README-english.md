# Naolib - Nearby Departures – TRMNL Plugin

Displays real-time upcoming departures from the nearest Naolib (TAN) stop to any location in Nantes.

## Preview

A preview of this plugin is available at [https://trmnl.com/recipes/256931/demo](https://trmnl.com/recipes/256931/demo)

## How It Works

1. A Cloudflare Worker (`worker.js`) acts as a proxy: it fetches nearby stops and their real-time departure times from the TAN API, then returns the combined data in TRMNL's `merge_variables` format.
2. TRMNL polls the Worker URL with your coordinates and displays the departure board using the Liquid templates in the `views/` folder.
3. The display refreshes every minute.

## Architecture

```text
TRMNL polls → Cloudflare Worker?lat=...&lng=...
               → TAN /arrets.json (nearby stops)
               → TAN /tempsattente.json (departures)
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

The TAN API uses a **comma** as the decimal separator (French format). Replace dots with commas:

| Standard format | TAN API format |
| --- | --- |
| `47.21661` | `47,21661` |
| `-1.556754` | `-1,556754` |

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
| `worker.js` | Cloudflare Worker — fetches stops and departures from the TAN API |
| `wrangler.toml` | Worker deployment configuration |
| `views/full.liquid` | Liquid template — full screen view |
| `views/half-horizontal.liquid` | Liquid template — horizontal half-screen view |
| `views/half-vertical.liquid` | Liquid template — vertical half-screen view |
| `views/quadrant.liquid` | Liquid template — quarter-screen view |
| `settings.yml` | Plugin settings reference (not synced with TRMNL) |

## API

This plugin uses the [TAN open data API](https://open.tan.fr/ewp/). No API key is required.

- Nearby stops: `https://open.tan.fr/ewp/arrets.json/{lat}/{lng}`
- Upcoming departures: `https://open.tan.fr/ewp/tempsattente.json/{codeLieu}`

## Acknowledgements

A big thank you to Nantes Métropole for providing open transport data for Naolib.

Thanks to the [TRMNL](https://trmnl.com) team for creating their amazing devices.

Thanks also to Steve Karmeinsky ([@stevekennedyuk](https://github.com/stevekennedyuk)) for his London transport status plugin ([trmnl-tfl-status](https://github.com/stevekennedyuk/trmnl-tfl-status)) which inspired this project.

Thanks to Anthropic for building Claude Code, which made creating the JS Worker a matter of seconds.

Finally, thanks to Mario from TRMNL support for his advice and for fixing my code just before the plugin was published.
