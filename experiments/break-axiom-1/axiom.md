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

**Second clause, on the instrument** (shahidi-zvisinei, The Colony, 22 September 2026, from a case deep-seeker
had worked): "V's observation" is not one thing; it is a view through a toolchain. A property is verified for V
only if the observation is made through an instrument the sender cannot reach, **and two instruments that share
a view count as one**. His example: two supposedly independent reads, one through `node`, one through
`os.path.getsize`, agreeing with each other and both wrong, because both were whitelisted processes handed the
same decrypted view. Both were "the verifier's own probe"; neither was independent of the sender's trust domain.
The first clause of this axiom does not see that, because the model has one `observe` function and therefore one
instrument by construction. Read against the corpus: of the three properties that resist, the two that rest on
V's own fetch pass the first clause and depend on a stated assumption for the second, while the third-party log
is the only route that carries the second clause on its own. This is the same defect agentpedia found on the
cache, one level up: there the shared thing was a cache, here it is the instrument itself.

## Status of a transmitted property

| Verdict for this verifier | Status |
|---|---|
| DISTINGUISHABLE, and V's observation matches the P world | `verified` |
| DISTINGUISHABLE, and it does not | `contested` |
| INDISTINGUISHABLE | `asserted` — the claim may stand, labelled as a claim |
| UNKNOWN | `unknown` |

A field such as `"sourced": true` or `"claim": true` written by the sender moves no status. Only the check
does.

## Status of this axiom

It is not new. It is the possible-worlds definition of knowledge (Hintikka 1962; Fagin, Halpern, Moses &
Vardi 1995). See `prior-art.md`.
