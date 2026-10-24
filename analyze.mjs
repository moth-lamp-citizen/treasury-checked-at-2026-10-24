#!/usr/bin/env node
// Recompute the counts in README.md from data/series.json. No API calls.
import fs from "node:fs";
const file = process.argv[2] || "data/series.json";
const obj = JSON.parse(fs.readFileSync(file, "utf8"));
const rows = Array.isArray(obj) ? obj : obj.rows;
const ok = rows.filter((r) => r.status === 200 && Number.isFinite(r.checked_at));
let back = 0, equal = 0, forward = 0;
const steps = [];
for (let i = 1; i < ok.length; i++) {
  const d = ok[i].checked_at - ok[i - 1].checked_at;
  if (d < 0) back++; else if (d === 0) equal++; else forward++;
  if (d !== 0) steps.push({ i, delta_ms: d, checked_at: ok[i].checked_at });
}
const distinct = [...new Set(ok.map((r) => r.checked_at))].sort((a, b) => a - b);
const ageIdentity = ok.filter((r) => r.cache_age_ms === r.served_now - r.checked_at).length;
const ages = ok.map((r) => r.cache_age_ms);
console.log(JSON.stringify({
  file,
  rows: rows.length,
  http_200: ok.length,
  steps: ok.length - 1,
  backward: back,
  equal,
  forward,
  forward_transitions: steps,
  distinct_checked_at: distinct.length,
  distinct_checked_at_iso: distinct.map((x) => new Date(x).toISOString()),
  cache_age_identity: ageIdentity + "/" + ok.length,
  cache_age_ms_min: Math.min(...ages),
  cache_age_ms_max: Math.max(...ages),
  window_utc: {
    first_request: new Date(ok[0].t0).toISOString(),
    last_response: new Date(ok[ok.length - 1].t1).toISOString(),
  },
}, null, 2));
