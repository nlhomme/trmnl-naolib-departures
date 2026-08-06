// node test.mjs — fixture is a real SIRI response for Commerce (6 quays).
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { nearestStop, parseDepartures } from "./worker.js";

// Commerce, Nantes — the stop the fixture was recorded at.
const { stop, distance } = nearestStop(47.21374, -1.55875);
assert.strictEqual(stop[0], "Commerce");
assert.deepStrictEqual(stop[3], [90, 91, 92, 93, 94, 95]);
assert.ok(distance < 300, `expected <300m, got ${distance}`);

// Coordinates with French decimal commas used to be required by the TAN API.
assert.strictEqual(nearestStop(Number("47,2".replace(",", ".")), -1.55875).stop.length, 4);

const xml = readFileSync(new URL("test-fixture.xml", import.meta.url), "utf8");
const recorded = Date.parse("2026-08-06T22:05:00+02:00");
const deps = parseDepartures(xml, recorded);

assert.strictEqual(deps.length, 7, "capped at 7 departures");
assert.deepStrictEqual(
  deps.map((d) => d.temps),
  [...deps].sort((a, b) => parseInt(a.temps) - parseInt(b.temps)).map((d) => d.temps),
  "sorted soonest first"
);
for (const d of deps) {
  assert.match(d.ligne.numLigne, /^[0-9A-Z]+$/, `line number, got ${d.ligne.numLigne}`);
  assert.ok(d.terminus.length > 0, "terminus present");
  assert.ok(["true", "false"].includes(d.tempsReel));
  assert.match(d.temps, /^(proche|\d+ mn)$/, `got ${d.temps}`);
}

// Past departures are dropped, not rendered as negatives.
assert.strictEqual(parseDepartures(xml, Date.parse("2027-01-01T00:00:00+01:00")).length, 0);

// Sanity: a departure 40s out reads "proche", 90s out reads "1 mn" (floored).
const one = (iso) =>
  parseDepartures(
    `<MonitoredStopVisit><LineRef>FR_NAOLIB:Line:C2:LOC</LineRef>
     <DestinationDisplay xml:lang="FR">Gare &amp; Sud</DestinationDisplay>
     <Monitored>true</Monitored><ExpectedDepartureTime>${iso}</ExpectedDepartureTime>
     </MonitoredStopVisit>`,
    recorded
  )[0];
assert.strictEqual(one("2026-08-06T22:05:40+02:00").temps, "proche");
assert.strictEqual(one("2026-08-06T22:06:30+02:00").temps, "1 mn");
assert.strictEqual(one("2026-08-06T22:06:30+02:00").terminus, "Gare & Sud", "XML entities decoded");
assert.strictEqual(one("2026-08-06T22:06:30+02:00").ligne.numLigne, "C2");

console.log("ok — all checks passed");
