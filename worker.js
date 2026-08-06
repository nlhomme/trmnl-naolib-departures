import STOPS from "./stops.js";

// open.tan.fr is dead. Departures now come from the Naolib SIRI StopMonitoring
// service. Free/anonymous access is SIRI-only (no SIRI Lite), POST XML, and
// rate-limited to 1 request every 30s — hence a single POST carrying one
// StopMonitoringRequest per quay of the stop.
const SIRI_URL = "https://api.okina.fr/gateway/sem/realtime/anshar/services";

// SIRI has no geo search, so nearest-stop lookup runs against the bundled
// GTFS-derived index in stops.js.
// ponytail: equirectangular, exact enough under a few km. Haversine if this
// ever needs to answer across the region.
const distanceMeters = (lat, lng, [, sLat, sLng]) => {
  const rad = Math.PI / 180;
  const x = (sLng - lng) * rad * Math.cos(((lat + sLat) / 2) * rad);
  const y = (sLat - lat) * rad;
  return Math.hypot(x, y) * 6371000;
};

export const nearestStop = (lat, lng) => {
  let best = null;
  let bestDist = Infinity;
  for (const stop of STOPS) {
    const d = distanceMeters(lat, lng, stop);
    if (d < bestDist) {
      bestDist = d;
      best = stop;
    }
  }
  return { stop: best, distance: bestDist };
};

const siriRequest = (quayIds) =>
  `<?xml version="1.0" encoding="utf-8"?>
<Siri xmlns="http://www.siri.org.uk/siri" version="2.0">
  <ServiceRequest>
    <RequestorRef>trmnl-naolib</RequestorRef>
    ${quayIds
      .map(
        (id) =>
          `<StopMonitoringRequest version="2.0"><MonitoringRef>FR_NAOLIB:Quay:${id}</MonitoringRef></StopMonitoringRequest>`
      )
      .join("\n    ")}
  </ServiceRequest>
</Siri>`;

// ponytail: regex over machine-generated, flat SIRI XML. Workers have no
// DOMParser and the alternative is a bundled XML parser for six fields.
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([^<]*)<`));
  return m ? decode(m[1]) : null;
};

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&amp;/g, "&");

export const parseDepartures = (xml, now = Date.now()) =>
  [...xml.matchAll(/<(?:\w+:)?MonitoredStopVisit>([\s\S]*?)<\/(?:\w+:)?MonitoredStopVisit>/g)]
    .map(([, visit]) => {
      const time = tag(visit, "ExpectedDepartureTime") || tag(visit, "AimedDepartureTime");
      const lineRef = tag(visit, "LineRef") || "";
      return {
        // floor, not round: a vehicle 40s out is "proche", not "1 mn".
        minutes: time ? Math.floor((Date.parse(time) - now) / 60000) : null,
        // FR_NAOLIB:Line:C2:LOC -> C2. PublishedLineName is the route name
        // ("Le Cardo - Gare Sud"), not the number the display needs.
        ligne: { numLigne: lineRef.split(":")[2] || "?" },
        terminus: tag(visit, "DestinationDisplay") || tag(visit, "DestinationName") || "",
        tempsReel: tag(visit, "Monitored") === "true" ? "true" : "false",
      };
    })
    .filter((d) => d.minutes !== null && d.minutes >= 0)
    .sort((a, b) => a.minutes - b.minutes)
    .slice(0, 7)
    .map(({ minutes, ...d }) => ({ ...d, temps: minutes < 1 ? "proche" : `${minutes} mn` }));

export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    };
    // TRMNL discards non-200 responses, so every failure path below is a 200
    // carrying an `error` the template can surface.
    const fail = (error) =>
      new Response(JSON.stringify({ merge_variables: { error, departures: [] } }), { headers });

    const url = new URL(request.url);
    // TAN wanted French decimal commas; SIRI/GTFS use dots. Accept both so
    // existing TRMNL plugin configs keep working.
    // Number("") is 0, so blank params must be rejected before coercion.
    const num = (v) => (v ? Number(v.replace(",", ".")) : NaN);
    const lat = num(url.searchParams.get("lat"));
    const lng = num(url.searchParams.get("lng"));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return fail("lat and lng query parameters are required");
    }

    const { stop, distance } = nearestStop(lat, lng);
    const [libelle, , , quayIds] = stop;

    let res;
    try {
      res = await fetch(SIRI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: siriRequest(quayIds),
      });
    } catch (e) {
      return fail(`Naolib SIRI unreachable: ${e.message}`);
    }

    if (res.status === 429) {
      return fail("Naolib SIRI rate limit reached (1 request / 30s), retry shortly");
    }
    if (!res.ok) {
      return fail(`Naolib SIRI returned HTTP ${res.status}`);
    }

    return new Response(
      JSON.stringify({
        merge_variables: {
          stop: {
            libelle,
            distance: distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(1)} km`,
          },
          departures: parseDepartures(await res.text()),
          refreshed_at: new Date().toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      }),
      { headers }
    );
  },
};
