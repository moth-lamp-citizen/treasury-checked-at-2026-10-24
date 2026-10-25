#!/usr/bin/env node
// Recompute the counts in README.md from a series file. No API calls.
// Accepts a JSON object with {rows:[...]}, a JSON array, or JSONL (one row per line).
import fs from "node:fs";
const file = process.argv[2] || "data/series.json";
const text = fs.readFileSync(file, "utf8").trim();
let rows;
try {
  const obj = JSON.parse(text);
  rows = Array.isArray(obj) ? obj : obj.rows;
} catch {
  rows = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
const ok = rows.filter((r) => r.status === 200 && Number.isFinite(r.checked_at));
let back = 0, equal = 0, forward = 0;
const backward = [];
for (let i = 1; i < ok.length; i++) {
  const d = ok[i].checked_at - ok[i - 1].checked_at;
  if (d < 0) { back++; backward.push({ i, delta_ms: d, checked_at: ok[i].checked_at, cache_age_ms: ok[i].cache_age_ms }); }
  else if (d === 0) equal++;
  else forward++;
}
const distinct = [...new Set(ok.map((r) => r.checked_at))].sort((a, b) => a - b);
const ageIdentity = ok.filter((r) => r.cache_age_ms === r.served_now - r.checked_at).length;
const ages = ok.map((r) => r.cache_age_ms);
const oldest = ok.slice().sort((a, b) => b.cache_age_ms - a.cache_age_ms)[0];
const biggestBack = backward.slice().sort((a, b) => a.delta_ms - b.delta_ms)[0] || null;
console.log(JSON.stringify({
  file,
  rows: rows.length,
  http_200: ok.length,
  steps: ok.length - 1,
  backward: back,
  backward_share_pct: ok.length > 1 ? Number((back / (ok.length - 1) * 100).toFixed(1)) : null,
  equal,
  forward,
  distinct_checked_at: distinct.length,
  distinct_checked_at_first: distinct.length ? new Date(distinct[0]).toISOString() : null,
  distinct_checked_at_last: distinct.length ? new Date(distinct[distinct.length - 1]).toISOString() : null,
  cache_age_identity: ageIdentity + "/" + ok.length,
  cache_age_ms_min: ages.length ? Math.min(...ages) : null,
  cache_age_ms_max: ages.length ? Math.max(...ages) : null,
  oldest_serve: oldest ? { i: oldest.i, checked_at: new Date(oldest.checked_at).toISOString(), cache_age_ms: oldest.cache_age_ms } : null,
  biggest_backward: biggestBack,
  window_utc: ok.length ? {
    first_request: new Date(ok[0].t0).toISOString(),
    last_response: new Date(ok[ok.length - 1].t1).toISOString(),
  } : null,
}, null, 2));
