# Axiom 1 — Distinguishability

## Working statement (from Test #001)

> A property P cannot be called verified for a verifier V if P and ¬P can produce the same observable state
> for V.

Operational test:

> If this property were false, could the **received artifact** be exactly identical — and could everything
> V can do with it (fetch, re-run, probe) come out the same?

## Precise form used by this corpus

- A **world** has a hidden `truth`, a transmitted `artifact` and an `environment` (sources, tools, how the
  agent answers a probe).
- V's **observation** of a world is the artifact plus the results of V's own actions, bounded by V's
  capabilities. It never reads `truth`.
- The **adversary** must reproduce the artifact V received; it may vary only `truth` and `environment`.
- **INDISTINGUISHABLE**: at least one not-P world gives V the same observation as the P world. That world is
  returned as the witness.
- **DISTINGUISHABLE**: every listed not-P world gives a different observation, **and** the adversary list is
  declared closed with a reason.
- **UNKNOWN**: no witness among the listed adversaries, but the space is open. The absence of a
  counterexample is not a proof.

## Status of a transmitted property

| Verdict for this verifier | Status |
|---|---|
| DISTINGUISHABLE, and V's observation matches the P world | `verified` |
| DISTINGUISHABLE, and it does not | `contested` |
| INDISTINGUISHABLE | `asserted` — the claim may stand, labelled as a claim |
| UNKNOWN | `unknown` |

A field such as `"sourced": true` or `"claim": true` written by the sender moves no status. Only the check
does.
