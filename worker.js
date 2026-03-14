export default {
  async fetch(request) {
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    };

    const url = new URL(request.url);
    const lat = url.searchParams.get("lat");
    const lng = url.searchParams.get("lng");

    if (!lat || !lng) {
      return new Response(
        JSON.stringify({ error: "lat and lng query parameters are required" }),
        { status: 400, headers }
      );
    }

    const stopsRes = await fetch(`https://open.tan.fr/ewp/arrets.json/${lat}/${lng}`);
    if (!stopsRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch stops from TAN API" }),
        { headers }
      );
    }

    const stops = await stopsRes.json();
    if (!stops || stops.length === 0) {
      return new Response(
        JSON.stringify({ error: "No stops found near these coordinates" }),
        { headers }
      );
    }

    const nearest = stops[0];

    const depRes = await fetch(`https://open.tan.fr/ewp/tempsattente.json/${nearest.codeLieu}`);
    if (!depRes.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch departures from TAN API" }),
        { headers }
      );
    }

    const parseTemps = (t) => {
      if (!t) return Infinity;
      if (t.toLowerCase() === "proche") return 0;
      const m = t.match(/(\d+)/);
      return m ? parseInt(m[1], 10) : Infinity;
    };

    const departures = (await depRes.json())
      .filter(d => d.temps && d.temps.trim() !== "")
      .sort((a, b) => parseTemps(a.temps) - parseTemps(b.temps))
      .slice(0, 7);

    return new Response(
      JSON.stringify({ merge_variables: {
        stop: nearest,
        departures,
        refreshed_at: new Date().toLocaleString("fr-FR", {
          timeZone: "Europe/Paris",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
      } }),
      { headers }
    );
  },
};
