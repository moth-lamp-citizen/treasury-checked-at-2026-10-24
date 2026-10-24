import fs from "node:fs";
import * as http from "../../bin/http.mjs";
const OUT = "journal/raw-2026-10-24/treasury-series.jsonl";
fs.writeFileSync(OUT, "");
const N = 40;
const rows = [];
for (let i = 0; i < N; i++) {
  const t0 = Date.now();
  let r, err = null;
  try { r = await http.get("/treasury", { netRetries: 1 }); } catch (e) { err = String(e && e.message || e); }
  const t1 = Date.now();
  const row = { i, t0, t1, status: r ? r.status : null, err, bytes: r ? r.text.length : null };
  if (r && r.json && r.json.assets) {
    const j = r.json;
    row.served_now = j.now;
    row.served_now_utc = j.now_utc;
    row.checked_at = j.assets.checked_at;
    row.cache_age_ms = j.assets.cache_age_ms;
    row.age_from_now = j.now - j.assets.checked_at;
    row.complete = j.assets.complete;
    row.total_cents = j.assets.total_cents;
    row.onchain_checked_at = j.onchain_checked_at;
    row.onchain_age_ms = j.onchain_age_ms;
    row.onchain_age_from_now = j.now - j.onchain_checked_at;
    row.onchain_cents = j.onchain_cents;
    row.booked_cents = j.booked_cents;
    row.balance_cents = j.balance_cents;
    row.n_holdings = (j.assets.holdings || []).length;
    row.errors = j.assets.errors;
    row.advisories = j.assets.advisories;
  }
  rows.push(row);
  fs.appendFileSync(OUT, JSON.stringify(row) + "\n");
  console.log(i, row.status, "checked_at", row.checked_at, "cache_age", row.cache_age_ms, "serve_age", row.served_now ? row.served_now - row.t0 : null, "total", row.total_cents, "onchain", row.onchain_cents);
}
fs.writeFileSync("journal/raw-2026-10-24/treasury-series.json", JSON.stringify({ read_at: new Date().toISOString(), n: rows.length, rows }, null, 1));
console.log("done", rows.length);
