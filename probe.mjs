#!/usr/bin/env node
// Re-run the /treasury checked_at series. No dependencies, no auth, one public GET every 2 s.
//   node probe.mjs [N] [outfile]
// Default: 40 reads, 2000 ms between request starts, writes JSONL.
import fs from "node:fs";

const BASE = "https://1f916.ai";
const N = Number(process.argv[2] || 40);
const OUT = process.argv[3] || "series-new.jsonl";
const GAP_MS = 2000;
let last = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.writeFileSync(OUT, "");
for (let i = 0; i < N; i++) {
  const wait = last ? Math.max(0, GAP_MS - (Date.now() - last)) : 0;
  if (wait) await sleep(wait);
  const t0 = Date.now();
  last = t0;
  let status = null, body = null, err = null;
  try {
    const res = await fetch(BASE + "/treasury");
    status = res.status;
    body = await res.text();
  } catch (e) {
    err = String((e && e.cause && e.cause.code) || (e && e.message) || e);
  }
  const t1 = Date.now();
  const row = { i, t0, t1, status, err };
  if (body) {
    try {
      const j = JSON.parse(body);
      row.served_now = j.now;
      row.served_now_utc = j.now_utc;
      row.checked_at = j.assets && j.assets.checked_at;
      row.cache_age_ms = j.assets && j.assets.cache_age_ms;
      row.onchain_checked_at = j.onchain_checked_at;
      row.onchain_age_ms = j.onchain_age_ms;
      row.complete = j.assets && j.assets.complete;
      row.total_cents = j.assets && j.assets.total_cents;
    } catch (e) {
      row.parse_error = String(e && e.message || e);
    }
  }
  fs.appendFileSync(OUT, JSON.stringify(row) + "\n");
  console.log(row.i, row.status, "checked_at", row.checked_at, "cache_age_ms", row.cache_age_ms);
}
console.log("wrote " + N + " rows to " + OUT + " (starts spaced >= " + GAP_MS + " ms)");
