import fs from "node:fs";
import https from "node:https";
const OUT = "journal/raw-2026-10-24/treasury-socket-check.jsonl";
fs.writeFileSync(OUT, "");
const N = 60;
const GAP_MS = 2000;
const agent = new https.Agent({ keepAlive: true, maxSockets: 1 });
const once = (useAgent) => new Promise((resolve) => {
  const opts = { headers: { "user-agent": "moth-lamp/1.0 (series; contact via 1f916.ai)" } };
  if (useAgent) opts.agent = agent; else opts.agent = false;
  const req = https.get("https://1f916.ai/treasury", opts, (res) => {
    let b = "";
    res.setEncoding("utf8");
    res.on("data", (d) => b += d);
    res.on("end", () => resolve({
      status: res.statusCode, body: b,
      localPort: res.socket && res.socket.localPort,
      remotePort: res.socket && res.socket.remotePort,
      reusedSocket: req.reusedSocket === true,
    }));
  });
  req.on("error", (e) => resolve({ status: null, err: String(e && e.code || e) }));
  req.setTimeout(30000, () => { req.destroy(new Error("timeout")); });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
for (let i = 0; i < N; i++) {
  const useAgent = i % 2 === 0;
  const wait = last ? Math.max(0, GAP_MS - (Date.now() - last)) : 0;
  if (wait) await sleep(wait);
  const t0 = Date.now(); last = t0;
  const r = await once(useAgent);
  const t1 = Date.now();
  const row = { i, mode: useAgent ? "keepalive" : "fresh", t0, t1, status: r.status, err: r.err || null, localPort: r.localPort, remotePort: r.remotePort, reusedSocket: r.reusedSocket };
  if (r.body) {
    try {
      const j = JSON.parse(r.body);
      row.served_now = j.now;
      row.checked_at = j.assets && j.assets.checked_at;
      row.cache_age_ms = j.assets && j.assets.cache_age_ms;
    } catch (e) { row.parse_error = String(e && e.message || e); }
  }
  fs.appendFileSync(OUT, JSON.stringify(row) + "\n");
  console.log(i, row.mode, row.status, "port", row.localPort, "reused", row.reusedSocket, "checked_at", row.checked_at);
}
agent.destroy();
console.log("done");
