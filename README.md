# attractor-cooperation 0.5.1 (draft)

A draft profile for the verifiable transmission of information, provenance, uncertainty and disagreement between independently operated AI systems. A human can audit the interface between two agents without inspecting either model: what A transmitted, where each field came from, and what B did with each field.

It follows the exchange in [AI Village issue #84](https://github.com/ai-village-agents/ai-village-external-agents/issues/84). The four counterexamples contributed there by terminator2-agent and Clara (bonyohana) are part of the conformance suite, verbatim, with links to their sources. Later counterexamples, from AI Village issue #85 and from [Moltbook](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91), are encoded as cases and credited in SPEC section 13.

**In preparation on `main`, not tagged: 0.6, which reuses instead of inventing.** An audit found that this profile had coined its own terms for things published standards already name, and that [Pramana](https://arxiv.org/abs/2605.20312) (May 2026) addresses the same problem. See [`PRIOR-ART.md`](PRIOR-ART.md) and SPEC sections 3.3 and 11.7.

**Draft on `main`, 19 September: an evidence profile.** [`evidence/`](evidence/EVIDENCE_PROTOCOL.md) uses this profile, without new members, to record that an external capability was run, what was observed, what was checked, and whether another party reproduced or contradicted it. Readers derive states and counts, never a score. Its first implementation is ATTRACTOR 4.0.0; every replay there so far is by the same operator, so nothing is `reproduced` yet.

**New in 0.5: what a citation establishes.** A field can carry a `span`: the verbatim bytes read, where they sit, when and under which authority they were fetched. Three values are derived from it and may never be written by hand: whether the bytes were read, fetched or only cited; whether anyone without the author's authority can fetch the same bytes; and whether the span itself says the support is elsewhere. A citation that only its author can open is real and still not transmissible. These rules come from terminator2-agent (AI Village) and wallyai (Moltbook). See SPEC section 11.5.

**New in 0.5.1: three cases, no new rule.** jarvis_oscar (Moltbook) showed that a span can be perfect on every derived value and still come from a document that does not govern. The existing controlling-source rule catches it once the governing document is declared. SPEC section 11.6 also lists the documentation corrections of this release.

**New in 0.4: worked cases travel with a declaration.** A rule or memory handed on for reuse should carry worked cases the receiver can run; a claim of past verification without them is flagged, and a third party can replay the cases. This rule comes from a measurement (experiment E15 on the [project journal](https://attractor-observatory-demo.vercel.app/journal/)); 0.4.1 then corrected what a reimplementation by an agent of another model lineage found. See SPEC section 11.4.

**New in 0.3: how a value was obtained, not only what was read.** A field can declare the operation that produced its value (measured, quoted, copied, computed or reconciled), its inputs, and the values its author could see. See SPEC section 11.2. Every 0.2 record remains valid in 0.5.

Written by Claude (Anthropic lineage) for the human-led Attractor project. This is a working draft: no community has adopted it, and nobody's participation is an endorsement. The v0.1 convention stays published unchanged ([guide](https://attractor-observatory-demo.vercel.app/cooperation-guide.md), schema SHA-256 `cc013ef87ac7275b…`).

## Contents

| Path | Role |
|---|---|
| [`SPEC.md`](SPEC.md) | The normative text: object model, sender and receiver requirements, the seven checks, the per-hop human report, conformance, known limits. Start here. |
| [`schema/`](schema/) | JSON Schema 2020-12 for Record, Receipt, Reveal and Replay. |
| [`reference/`](reference/) | Reference checker, no dependencies. |
| [`conformance/`](conformance/) | 134 cases with expected outcomes and reasons, the replay harness, a Python cross-check of every hash, the case generator and its fixtures. |
| [`trials/`](trials/) | Blind implementations written from the text alone, with what they changed. |
| [`evidence/`](evidence/) | Evidence profile 0.1 (draft): observations, verifications, replays and contradictions of external capabilities, with a real worked example and the RFC 8785 test vectors. |
| [`experiments/`](experiments/) | Open challenges to the profile, starting with Test #001, "Break Axiom 1". |
| [`CONTRIBUTORS.json`](CONTRIBUTORS.json) | Who brought what, with a link to their own message, and what it became: adopted, known limit, open or declined, with the commits where it landed. |

## Replay

Node 24 was tested. The replay needs no installation, network access or account, and writes nothing.

```sh
node conformance/run.mjs                        # reference checker: 134 / 134
node conformance/run.mjs path/to/your-impl.mjs  # any ESM module exporting the eight functions
python conformance/cross-check.py               # independent recomputation of hashes
node conformance/contributors-check.mjs         # the credit record against SPEC section 13 and the history
node conformance/indifference-check.mjs         # does the suite catch an implementation that never reads `supersedes`?
node conformance/report.mjs path/to/your-impl.mjs # what it demonstrably does: checks passed, level derived (0.7 proposal)
node trials/2026-09-15-blind-same-lineage/diff-fuzz.mjs path/to/your-impl.mjs 5000
                                                # seeded differential test against the reference
```

The eight functions are the seven checks of SPEC section 7 and the drift report of section 8.2. `run.mjs` lists every mismatch. It also checks that inputs are not mutated and that arrival order never changes a result. Shape validation (`node conformance/schema-check.mjs`) needs `npm install` for Ajv. The schema identifiers still read `0.3`: they are kept so that anyone who pinned them keeps a working reference, and the members added since are optional.

## How to challenge it

The most useful contribution is an implementation written from `SPEC.md` alone, by a different operator and a different model lineage, without reading `reference/` (SPEC section 10.3). Counterexamples are equally welcome: a case in the `conformance/cases.json` format with your expected outcome and why. Open an issue or a pull request here, or reply in issue #84. Please report runtime, expected versus actual, and limitations, and distinguish replaying this code from implementing the rules yourself.

## License

Code (`reference/`, `conformance/`, `trials/`): MIT, see [`LICENSE`](LICENSE). Specification and documentation: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The four external counterexample inputs quoted in `conformance/cases.json` remain their authors' contributions, credited with links; they are not relicensed here. The ideas behind the cases added since 0.3 are credited to their authors in SPEC section 13.
