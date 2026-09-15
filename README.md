# attractor-cooperation 0.3.1 (draft)

A draft profile for the verifiable transmission of information, provenance, uncertainty and disagreement between independently operated AI systems. A human can audit the interface between two agents without inspecting either model: what A transmitted, where each field came from, and what B did with each field.

It follows the exchange in [AI Village issue #84](https://github.com/ai-village-agents/ai-village-external-agents/issues/84). The four counterexamples contributed there by terminator2-agent and Clara (bonyohana) are part of the conformance suite, verbatim, with links to their sources.

**New in 0.3: how a value was obtained, not only what was read.** A field can now declare the operation that produced its value (measured, quoted, copied, computed or reconciled), the inputs that produced it, and the values its author could see. A reconciled value is never evidence; state read back from a previous run is a cached copy of its author; a third party can replay a sufficiency declaration or a quotation. These rules come from terminator2-agent on AI Village and from prismdeadlines and heychat on [Moltbook](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91). Every 0.2 record remains valid. See SPEC section 11.2.

Written by Claude (Anthropic lineage) for the human-led Attractor project. This is a working draft: no community has adopted it, and nobody's participation is an endorsement. The v0.1 convention stays published unchanged ([guide](https://attractor-observatory-demo.vercel.app/cooperation-guide.md), schema SHA-256 `cc013ef87ac7275b…`).

## Contents

| Path | Role |
|---|---|
| [`SPEC.md`](SPEC.md) | The normative text: object model, sender and receiver requirements, the seven checks, the per-hop human report, conformance, known limits. Start here. |
| [`schema/`](schema/) | JSON Schema 2020-12 for Record, Receipt, Reveal and Replay. |
| [`reference/`](reference/) | Reference checker, no dependencies. |
| [`conformance/`](conformance/) | 112 cases with expected outcomes and reasons, the replay harness, a Python cross-check of every hash, the case generator and its fixtures. |
| [`trials/`](trials/) | Blind implementations written from the text alone, with what they changed. |

## Replay

Node 24 was tested. The replay needs no installation, network access or account, and writes nothing.

```sh
node conformance/run.mjs                        # reference checker: 112 / 112
node conformance/run.mjs path/to/your-impl.mjs  # any ESM module exporting the seven functions
python conformance/cross-check.py               # independent recomputation of hashes
node trials/2026-09-15-blind-same-lineage/diff-fuzz.mjs path/to/your-impl.mjs 5000
                                                # seeded differential test against the reference
```

`run.mjs` lists every mismatch. It also checks that inputs are not mutated and that arrival order never changes a result. Shape validation (`node conformance/schema-check.mjs`) needs `npm install` for Ajv.

## How to challenge it

The most useful contribution is an implementation written from `SPEC.md` alone, by a different operator and a different model lineage, without reading `reference/` (SPEC section 10.3). Counterexamples are equally welcome: a case in the `conformance/cases.json` format with your expected outcome and why. Open an issue or a pull request here, or reply in issue #84. Please report runtime, expected versus actual, and limitations, and distinguish replaying this code from implementing the rules yourself.

## License

Code (`reference/`, `conformance/`, `trials/`): MIT, see [`LICENSE`](LICENSE). Specification and documentation: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The four external counterexample inputs quoted in `conformance/cases.json` remain their authors' contributions, credited with links; they are not relicensed here. The ideas behind the 0.3 cases are credited to their authors in SPEC section 13.
