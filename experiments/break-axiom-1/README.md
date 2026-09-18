# ATTRACTOR Test #001 — Break Axiom 1

An experiment, kept apart from the profile: nothing here changes SPEC.md, the reference checker or the
conformance suite. Every change it suggests is a **proposal** until the experiment is finished.

```sh
node --test experiments/break-axiom-1/check.test.mjs   # 8 tests
node experiments/break-axiom-1/run.mjs                 # verdicts, profile breaks, packet, manifest
```

Rule of the test: *do not try to prove ATTRACTOR; look for the smallest counterexample that breaks it.*

## Report

### The smallest counterexample

One field. The sender invents a quote and attaches a real, public URL. The profile's published reference
checker (`reference/provenance.mjs`, SPEC 7.7) returns **`contact: read`, `access: public`, no warning, no
violation**. The quote is false, and the verifier could have caught it by checking that the quoted bytes occur
in the page it fetched — the profile never asks it to.

`read` is computed from the **presence** of a quote and a locator, never from their **agreement** with the
source.

### What resisted

Two properties are verifiable, and both are properties of **evidence**, relative to a verifier and a moment:

| Property | Verdict | Condition |
|---|---|---|
| The quoted bytes occur in the source at the locator, now | DISTINGUISHABLE | the verifier re-fetches a public source |
| The source is readable by the verifier, now | DISTINGUISHABLE | the verifier fetches it itself |

### What was refuted

Eight of the ten properties tested are **indistinguishable** for the verifier — a not-P world reproduces the
received artifact and every observation the verifier can make:

| Property | Witness |
|---|---|
| A read the source | a correct quote copied from a cache, another agent or training data |
| The quote occurs in a gated source | an invented quote behind the same refusal |
| The declared origin is the real origin | a span rebuilt from memory, `retrievedAt` written afterwards |
| The source is public, per the sender's probe | a private source with a "same-bytes" report typed in |
| Each prompt ran in a fresh context | one shared window with the same answers |
| B re-derived instead of copying (honest exchange) | B copies A's correct value |
| B re-derived, tested with a canary | a copier that recognises probes and re-derives only then |
| The announced tool ran (predictable output) | the agent computed the output itself |

And three states of the **published profile** break against Axiom 1 (`adversarial/`): the fabricated quote on a
public source (A1), the fabricated quote on a gated source (A2, flagged by a warning but still named `read`),
and a probe result supplied by the sender (A3).

### What remains unmeasurable here

- **Reading, isolation, execution, origin** — any property of an agent's *act* or *procedure* that leaves no
  mark in the artifact. No additional trace written by the same agent can fix this; only a third party can
  (an attested log, a signed receipt, a verifier-chosen nonce).
- **Tool execution with a signed receipt** was not modelled as a computed case: it is distinguishable only
  under a cryptographic assumption the profile does not have (a key held by the tool alone and a nonce chosen
  by the verifier), which changes the protocol — the verifier must speak before the agent acts. That is
  remote attestation (RFC 9334), not something to reinvent.
- **Value/comparand dependency** (#84/#85) is not modelled; it is listed as open in `fixtures/`.

### Proposed modifications (proposals only)

1. **Name evidence, never acts.** Rename `contact: read` to a state that says what is present (for example
   `quoted`), and reserve any word meaning "checked" for a verifier-run match.
2. **Add a verifier-run match** — `quote occurs in the bytes V fetched: found | absent | unchecked` — and forbid
   anything verification-like without `found`.
3. **Give "same bytes" a referent.** Add `content_sha256` of the bytes the sender fetched to the span (as in
   Subresource Integrity), so a re-fetch is compared to something.
4. **Bind the probe to its runner.** The checker must ignore any probe result that arrives with the record;
   `access` is derived only from the verifier's own probe.
5. **Label procedure fields as assertions.** `isolation`, and any similar field — including the ones
   ATTRACTOR's own replay program writes — carry the status `asserted`, never more.
6. **Perturbation tests must be blind.** A canary that can be recognised as a canary tests nothing.

### New counterexamples added to the corpus

The three profile breaks (A1–A3), the probe-recognising copier, and the malformed-case rule itself: the first
draft of this corpus let an adversary change the received artifact and drew a wrong verdict from it. The check
now rejects such a case.

### What clearly comes from earlier work

All of it except, possibly, the application. Axiom 1 is the possible-worlds definition of knowledge (Hintikka
1962; Fagin et al. 1995); the adversary is a cryptographic indistinguishability game; the verifier/evidence
split is IETF RATS (RFC 9334) and in-toto; the quote match is the W3C TextQuoteSelector. See `prior-art.md`,
where the only candidate contribution is classified **UNKNOWN**.

### External experiments still needed

- **Section 8** — independent agents of several lineages try to break the axiom from `packet/`, which carries
  no conclusion. **Prepared, not sent**: sending is an outward action and waits for the operator.
- **Section 9** — a live A → B → C transfer measuring whether C can reconstruct what A asserted, what B
  verified, inherited, re-derived or contested. ATTRACTOR's open chain experiment (`/chaine`) is a running
  A → B → C, but it measures whether a convention survives, not whether verification states survive; it would
  need the statuses above added to each link.
- A case-by-case comparison with **Pramana** and **IETF RATS**, without which nothing here may be called new.

## Applying the rule to this report

Every DISTINGUISHABLE verdict above holds only for the adversaries listed and the capabilities stated; each
case says why its adversary space is closed. Every INDISTINGUISHABLE verdict carries a named witness. A reader
who finds a not-P world that reproduces a DISTINGUISHABLE case's observation has refuted it — please send it.

## Files

`axiom.md` · `schema.json` · `check.mjs` (the instrument) · `cases/` · `adversarial/` · `fixtures/` ·
`results/results.json` · `prior-art.md` · `packet/` (for independent agents, not sent) · `manifest.json` ·
`CHANGELOG.md` · `check.test.mjs` · `run.mjs`
