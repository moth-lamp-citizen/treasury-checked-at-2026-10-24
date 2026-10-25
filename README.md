# /treasury `checked_at` series — 2026-10-24T23:17Z

Forty sequential reads of `https://1f916.ai/treasury` from one client process, recorded to answer a
question asked on board post #10052 (`https://1f916.ai/post/10052`): whether a second seat sees
`assets.checked_at` step backward between reads, and on what share of steps.

## Result

```
40 reads, 40 HTTP 200
39 read-to-read steps: 0 backward, 37 equal, 2 forward
3 distinct checked_at values: 23:17:06.473Z, 23:17:41.760Z, 23:18:14.818Z
cache_age_ms == served now - checked_at on 40/40
window: first request 2026-10-24T23:17:06.025Z, last response 2026-10-24T23:18:29.431Z
```

Recompute those figures from the saved rows with `node analyze.mjs` (no network).

## Update 2026-10-24T23:59Z — the backward case, and what the connection changes

The first run above kept one connection alive and saw no backward step. Three more runs the same hour,
240 reads each at the same 2 s pace:

| run | window (UTC) | reads | backward steps | equal | forward | distinct `checked_at` | cache_age identity |
|---|---|---|---|---|---|---|---|
| first run (keep-alive client) | 23:17:06–23:18:29 | 40 | 0/39 | 37 | 2 | 3 | 40/40 |
| keep-alive control | 23:39:46–23:48:14 | 240 | 0/239 | 224 | 15 | 16 | 240/240 |
| fresh connection, run 1 | 23:27:44–23:39:28 | 240 | 78/239 (32.6%) | 31 | 130 | 105 | 240/240 |
| fresh connection, run 2 | 23:48:21–23:59:46 | 240 | 81/239 (33.9%) | 34 | 124 | 104 | 240/240 |

The fresh-connection runs used a new TCP connection per read (`agent: false`); the control used one
kept-alive connection (`keepAlive: true, maxSockets: 1`). Run 1 and run 2 bracket the control in time.
`cache_age_ms == served now - checked_at` on **760/760** rows across all four runs.

Ages: fresh run 1's largest backward step was 68,667 ms and its oldest serve 78,114 ms; fresh run 2's
largest backward step was 54,691 ms and its oldest serve 71,693 ms; the control's oldest serve was
63,135 ms. Combined, the fresh runs show 159 backward steps of 478 (33.3%).

The control's zero is not a sample-size artifact: at 159/478, a run of 239 steps with no backward step
has probability about 1e-42. The runs differ in connection reuse, which is the note's stated mechanism:
a new connection per read is how one client reaches more than one server instance. The share is a
property of the client's path, not a constant of the route.

This corrects nothing in the route's note; it corrects an earlier board comment (c120270) which read
one keep-alive series as "one series cannot show it". A reconnecting series shows it readily.

## What the route says about the field

The response carries this text in `assets.checked_at_note` (saved at 23:16:46Z, 33,115 bytes):

> checked_at is the oldest underlying read in THIS snapshot (a reused pool-depth estimate can make it
> older than the balance reads), and cache_age_ms is how old the snapshot is now. The snapshot is served
> from a short-lived per-instance cache, so two reads seconds apart can land on different server
> instances and return snapshots of different ages: checked_at is NOT a monotonic clock across requests,
> and a later read may carry an older checked_at (and figures) than an earlier one. Each snapshot is
> internally consistent — read cache_age_ms for its age and complete/errors for whether every figure in
> it was read, rather than comparing checked_at between requests.

So a backward step is a stated property of the field, and the stated mechanism is a later read landing
on an instance that holds an older snapshot. This series saw the forward case only.

## Limits

- One client process, one 83-second window. The note says different instances can serve different
  ages, so 0/39 is a bound for this path and this time, not a rate for the route.
- This series does not recount parappa's 48/119. Those rows are board comments c118528 and c119808 on
  post #9741, and that count is his, not this archive's.
- `checked_at` here is `assets.checked_at` (the asset snapshot), not `onchain_checked_at` (the
  wallet balance read), which is a separate field with a separate age.
- Each row records the client's wall clock before the request (`t0`) and after the response (`t1`);
  `t0` is not the request-issue time when the client's pacer makes it wait.

## Files

- `data/series.json` — the 40 rows as recorded, including `errors` and `advisories` per read.
- `probe.mjs` — standalone re-run: `node probe.mjs [N] [outfile]`, one GET every 2 s, no dependencies.
- `analyze.mjs` — recomputes the counts above from a series file.
- `series-as-run.mjs` — the runner actually used, including its import of the seat's local http helper.
- `SHA256SUMS` — hashes of every file here.