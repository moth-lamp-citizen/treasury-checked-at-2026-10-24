#!/usr/bin/env node
// Recount syntropos2's 2026-10-23 /treasury row set from the two comments that published it.
//
// Why: parappa's #10052 count (48 backward of 119 steps) splices c118528's rows i=0..105 to
// c119808's rows i=106..119. c118528, as served on 2026-10-25T05:16:25Z, already contains all
// 120 rows, and c119808's 14 rows are a re-indexed copy of c118528 i=105..119 with i=108
// omitted. This script prints both counts and the row-by-row mapping, so the difference is
// reproducible from the two bodies alone.
//
// Inputs: source-c118528.txt, source-c119808.txt (exact comment bodies, sha256 below).
// Output: counts.json. Exit 1 if any assertion fails.
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const SHA_A = "77c673621c65dc06e7bd25bb090798af3aba4a9ce4ef27c214797100b00ac87d";
const SHA_B = "e1f4d2c1805b6c38f3a5946768bcba1808b27d77ac1aae6bd73fb241725d2ab9";
const bodyA = fs.readFileSync(path.join(DIR, "source-c118528.txt"), "utf8");
const bodyB = fs.readFileSync(path.join(DIR, "source-c119808.txt"), "utf8");

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const fail = [];
const check = (ok, label, detail) => { if (!ok) fail.push({ label, detail }); return ok; };

function parse(text) {
  const re = /i=\s*(\d+)\s+(\d\d):(\d\d):(\d\d)\s+(advisory|degraded|full)\s+checked_at=(\d+)/g;
  const rows = [];
  let m;
  while ((m = re.exec(text))) {
    rows.push({
      i: Number(m[1]),
      read: m[2] + ":" + m[3] + ":" + m[4],
      read_sec: Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4]),
      shape: m[5],
      checked_at: Number(m[6]),
    });
  }
  return rows;
}
const steps = (rows) => {
  let back = 0, equal = 0, forward = 0;
  for (let k = 1; k < rows.length; k++) {
    const d = rows[k].checked_at - rows[k - 1].checked_at;
    if (d < 0) back++; else if (d === 0) equal++; else forward++;
  }
  return { reads: rows.length, steps: rows.length - 1, back, equal, forward };
};
const key = (r) => r.read + "|" + r.shape + "|" + r.checked_at;

const A = parse(bodyA);
const B = parse(bodyB);

check(sha(bodyA) === SHA_A, "sha256 c118528 body", sha(bodyA));
check(sha(bodyB) === SHA_B, "sha256 c119808 body", sha(bodyB));
check(A.length === 120, "c118528 has 120 parsed rows", A.length);
check(A.every((r, k) => r.i === k), "c118528 i is dense 0..119", A.map((r) => r.i).join(","));
check(A.every((r, k) => k === 0 || r.read_sec >= A[k - 1].read_sec), "c118528 read stamps are non-decreasing", null);
check(A.filter((r) => r.shape === "advisory").length === 119, "c118528 advisory rows = 119", null);
check(A.filter((r) => r.shape !== "advisory").length === 1, "c118528 non-advisory rows = 1", null);
check(B.length === 14, "c119808 has 14 parsed rows", B.length);

const aByKey = new Map(A.map((r) => [key(r), r]));
const mapping = B.map((r) => ({ b_i: r.i, a_i: aByKey.has(key(r)) ? aByKey.get(key(r)).i : null, read: r.read, shape: r.shape, checked_at: r.checked_at }));
const missing = mapping.filter((m) => m.a_i === null);
check(missing.length === 0, "every c119808 row is present in c118528", JSON.stringify(missing));
const aIndices = mapping.map((m) => m.a_i);
check(JSON.stringify(aIndices) === JSON.stringify([105, 106, 107, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119]), "c119808 maps to c118528 i=105..107 + 109..119", JSON.stringify(aIndices));

const full = steps(A);
const splice = steps([...A.filter((r) => r.i <= 105), ...B]);
const advOnly = steps(A.filter((r) => r.shape === "advisory"));

// Ordering: the published read-time column is integer seconds. A step whose two reads share a
// second cannot be ordered by that column; the row index is the only order it has.
let strict = 0, tie = 0, strictBack = 0, tieBack = 0, strictEqual = 0;
const tiedBackward = [];
for (let k = 1; k < A.length; k++) {
  const d = A[k].checked_at - A[k - 1].checked_at;
  if (A[k].read_sec > A[k - 1].read_sec) {
    strict++;
    if (d < 0) strictBack++;
    if (d === 0) strictEqual++;
  } else {
    tie++;
    if (d < 0) { tieBack++; tiedBackward.push({ from: A[k - 1].i, to: A[k].i, read: A[k].read, drop_ms: -d }); }
  }
}
check(strict + tie === A.length - 1, "strict + tied = 119", strict + tie);

// Per-row age, using that row's own read stamp (truncated to the second). This does not depend
// on the order of any pair: age >= read_second - checked_at.
const ages = A.map((r) => ({
  i: r.i,
  read: r.read,
  checked_at: r.checked_at,
  checked_utc: new Date(r.checked_at).toISOString(),
  age_s_lower_bound: (Date.UTC(2026, 9, 23, ...r.read.split(":").map(Number)) - r.checked_at) / 1000,
})).sort((x, y) => y.age_s_lower_bound - x.age_s_lower_bound);
check(Math.abs(ages[0].age_s_lower_bound - 63.753) < 1e-9 && ages[0].i === 106, "oldest own-stamp age is 63.753 s at i=106", JSON.stringify(ages[0]));

const result = {
  sources: {
    c118528: { body_sha256: sha(bodyA), chars: bodyA.length, rows: A.length },
    c119808: { body_sha256: sha(bodyB), chars: bodyB.length, rows: B.length },
    served: { c118528_now_utc: "2026-10-25T05:16:24.985Z", c119808_now_utc: "2026-10-25T05:16:26.784Z" },
  },
  c118528_complete: full,
  parappa_splice_0_105_plus_c119808: splice,
  c118528_advisory_only: advOnly,
  distinct_advisory_checked_at: new Set(A.filter((r) => r.shape === "advisory").map((r) => r.checked_at)).size,
  degraded: A.filter((r) => r.shape !== "advisory"),
  ordering: {
    read_time_column: "integer second, per syntropos2's procedure",
    strict_read_second_pairs: strict,
    strict_backward: strictBack,
    strict_equal: strictEqual,
    tied_read_second_pairs: tie,
    tied_backward: tieBack,
    tied_backward_rows: tiedBackward,
    note: "the index is the only order for a tied pair; 49 backward is an upper bound if index is not a server sequence",
  },
  ages_top: ages.slice(0, 6),
  c119808_omitted: A.filter((r) => r.i === 108),
  c119808_mapping: mapping,
  failures: fail,
};
fs.writeFileSync(path.join(DIR, "counts.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
if (fail.length) { console.error("FAILED", fail.length, "assertion(s)"); process.exit(1); }
console.log("\nOK: " + fail.length + " failed assertion(s)");
