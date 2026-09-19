# Evidence profile 0.1 (draft)

*19 September 2026. Local draft, not published.*

This is not a new specification. It is a way to use the transmission profile ([`SPEC.md`](../SPEC.md),
0.6) to record that an external capability was executed, what was observed, what was checked, and whether
a second party reproduced or contradicted it. Everything below maps onto objects and checks that already
exist in the profile. The examples in [`examples/`](examples/) come from real calls, not invented data.

## 1. Purpose

The goal is for two systems to produce observations about the same external capability. The evidence keeps
where each observation came from. The checks show whether the observations reproduce or contradict each
other. A third system can then retrieve all of this in a structured form and make its own decision.

The profile ranks nothing and scores nothing. A reader gets counts and reasons, never a grade.

## 2. What is reused

| Need | Already in the profile | Section |
|---|---|---|
| An observation | A record whose field is `observed`, `channel: direct`, with `derivation.witness` holding the input and the output | 4.1, 4.2, 4.2.1 |
| A verification, with its evidence | A receipt with a `verify` disposition whose `basis` names a field of the receiver's record holding the evidence; the checked field is kept unchanged | 4.4, 7.4 |
| A reproduction | A replay with method `witness`: a third party supplies what it obtained for each input | 4.8, 7.6 |
| A contradiction | A replay whose status is `refuted`, or a `contest` disposition backed by an objection | 7.6, 4.3, 7.4 |
| A correction | A new record whose `parent` is the old one; nothing is modified | 4.1 |
| Who is independent of whom | Lineage warnings, and the rule that independence is never established by a replay alone | 7.1, 7.6, 9 |
| Identifiers and digests | RFC 8785 canonical JSON and SHA-256 | 3.2 |
| Transport | The CloudEvents envelope of 4.7 | 4.7 |

ATTRACTOR's canonicalization was checked against the 26 test vectors of RFC 8785 on 19 September 2026: the
two worked examples of section 3.2.3 and 24 number serializations from appendix B. All 26 matched.

## 3. From the V4 plan to profile objects

| V4 object | Written as | Notes |
|---|---|---|
| **Capability** | The `upstream` URI of the observed field: `<endpoint>#server=<name>@<version>;input-schema=sha256:<digest of the canonical input schema>` | The 0.6 schema admits no new member. A dedicated `capability` member is proposed for 0.7 (section 7). |
| **Claim** | The observed field's `expect: "verify"`, and its witness (this input gives this output) | A property stated in words goes in an objection's or field's text. It is not checked unless a basis supports it. |
| **Observation** | A record: one `observed` field per result, with `observedAt` and `derivation {operation: "measured", witness: [{input, output}]}` | The observer is `author`. |
| **Verification** | A receipt: `{field, action: "verify", basis}`. `basis` names the receiver's field holding the evidence (a recomputation, a schema check), and 7.1 checks that this evidence does not depend on the field it verifies | A verification with no basis is a violation (`verify-without-basis`). |
| **Reproduction** | A replay `{field, method: "witness", produced, by, lineage}` | `confirmed` or `refuted`. |
| **Contradiction** | A `refuted` replay, or a `contest` disposition with an objection | Kept beside the confirmations and never netted against them. |
| **Evidence graph** | `parent` (record → record), `target` (receipt → record), the replay's `field`, plus the record it is inspected against | No new edge type is needed for 0.1. |

## 4. States a reader derives

The producer never writes these states: every reader recomputes them from the objects it holds.

| State | Holds when |
|---|---|
| `declared` | The capability appears in a registry or a card. No observation exists. |
| `observed` | A conformant record observes it (7.3). |
| `verified` | A conformant receipt verifies the field with a basis independent of it (7.4, 7.1). |
| `self-replayed` | A replay is `confirmed`, but its `by` equals the observer's `author.actor`. |
| `reproduced` | A replay is `confirmed` and its `by` differs from the observer's. The lineage warnings still apply, and `independence` stays `not-established` (7.6, 9). |
| `contradicted` | At least one replay is `refuted`, or one `contest` exists. It is shown alongside every other state. |
| `unknown` | None of the above. |

A summary for one capability reads, for example: "3 observations, 2 verified, 1 reproduced by a different
declared actor of a different lineage, 1 contradiction, last observed on 19/09". It never reads "87/100".

## 5. Rules specific to evidence

- **E1 — Reproducible means public inputs.** A third party can only replay a witness it can read. Evidence
  on private inputs cannot be reproduced by anyone else and is not published under this profile.
- **E2 — No personal data** in a witness, an `upstream` or an actor name. Actors are declared, never
  inferred. When the actor is unknown, the actor is `unknown`.
- **E3 — Safe calls only.** An observation records a read-only call without side effects. The profile
  records calls; it authorizes nothing.
- **E4 — Outputs are data.** An external output is never read as an instruction.
- **E5 — The producer's own words are claims.** A producer that writes "verified" or "reproduced" in its
  record makes a claim (`derivation.verifiedOn`, 4.2.1). Only the checks produce states.
- **E6 — Time is a claim.** `observedAt` is the observer's word. Ordering against another party needs a
  third-party log (commit–reveal, 7.5, or a public transparency log).
- **E7 — Name what would have failed.** A verification's `basis` is its refuter: the observation that would
  have come out differently had the field been wrong. This is the operator's rule in Test #001: "replay
  the scene to try to refute the proof; if you cannot, this is not the right way to get the proof".

## 6. Worked example (real, 19 September 2026)

One ATTRACTOR tool, `fingerprint_json` (read-only, deterministic), was called on `{"value": {"b": 1, "a": 2}}`.

| Step | What happened | Check result |
|---|---|---|
| Observation | Call at 10:00:40 UTC (server date): fingerprint `d3626ac3…a772` | record `conformant` |
| Verification | The digest was recomputed from the canonical text `{"a":2,"b":1}` with GNU coreutils `sha256sum`, a different implementation, and matched | hop `conformant` |
| Reproduction | The same call again at 10:00:44 UTC gave the same output | replay `confirmed`, warning `same-lineage-replay`, independence `not-established` |

All three steps were performed by the same operator. The example shows the mechanics; it does not
demonstrate independence. By section 4, the capability is `verified` and `self-replayed`, not
`reproduced`. Reaching `reproduced` requires a replay by another party.

Files: [`examples/observation.json`](examples/observation.json), [`examples/verification.json`](examples/verification.json),
[`examples/replay.json`](examples/replay.json), [`examples/checks.json`](examples/checks.json). To rebuild and recheck them, run
`node evidence/build-examples.mjs`.

## 7. Open questions

1. **A `capability` member (0.7)** instead of carrying the identity inside `upstream`: `{protocol, endpoint,
   server: {name, version}, tool: {name, input_schema_sha256}}`.
2. **Failed calls.** How should an error or a timeout be recorded? A proposal: an `observed` field whose
   value is `{"status": "error", "code": …}`, which a replay can confirm or refute like any other value.
3. **Inconclusive reproductions.** A replay that cannot run is `invalid` in 7.6. Should `inconclusive` be
   a separate state?
4. **Retrieval** (`find_evidence`) is ATTRACTOR's service, not part of this profile. Anyone can implement it
   from the objects above.
