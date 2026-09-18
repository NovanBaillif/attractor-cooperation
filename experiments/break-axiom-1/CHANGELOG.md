# Changelog — Test #001, Break Axiom 1

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
