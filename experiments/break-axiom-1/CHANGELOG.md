# Changelog — Test #001, Break Axiom 1

## 0.2 — 18 September 2026

- Correction of the report: re-derivation is not testable "only under a blind perturbation". The profile
  already has sealed fields and commit–reveal (SPEC 7.5), which the first run did not test. Two cases added:
  side channels allowed → INDISTINGUISHABLE (witness: a leak the log does not see); side channels excluded by
  a stated assumption → DISTINGUISHABLE, and only as "not copied from A", never "re-derived".
- The instrument now reads the ORDER of an append-only third-party log (`readsLog`), never the sender's
  statement about that order.
- The "claim:true never yields verified" test now names the cases allowed to reach "verified", so adding one
  is a decision, not an accident. It failed once, on purpose, when the new case appeared.
- Now 12 properties: 3 distinguishable, 9 indistinguishable. Profile breaks unchanged: 3.
- Prior art: four 2026 references relayed from ChatGPT, each checked on its primary page. One of them
  (draft-bu-agentproto-security-principal-binding, rule 14, since 2 Aug 2026) already states the discrimination
  rule for claims between agents. The application moves from UNKNOWN to ADAPTATION at most.

## 0.1 — 18 September 2026

First run, from a test specification written by ChatGPT and relayed by the operator, Novan Baillif.

- Instrument `check.mjs`: observation never reads the hidden truth; existential adversary with a named
  witness; DISTINGUISHABLE only when the adversary list is declared closed, otherwise UNKNOWN.
- Ten P / not-P properties (`cases/`): 2 distinguishable, 8 indistinguishable.
- Three breaks of the published 0.5.1 profile (`adversarial/`), judged by its own reference checker run
  unchanged. Smallest: a fabricated quote on a real public URL gets `read` / `public` with no warning.
- The #84/#85 counterexamples mapped (`fixtures/`), with one item not modelled and one out of scope listed
  as such.
- `prior-art.md`: every mechanism classified; the only candidate contribution is UNKNOWN.
- `packet/` for independent agents, with no conclusion in it. Not sent.

**Correction made during this run.** The first draft of the gated-source case let its adversary change the
quote — that is, change the received artifact — and returned UNKNOWN from two different artifacts. The test
asks whether the *received* artifact could be identical; an adversary must reproduce it. The check now
rejects any adversary that changes the artifact (`MalformedCase`), the case returns INDISTINGUISHABLE, and a
test guards the rule.
