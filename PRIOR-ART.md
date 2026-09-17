# Prior art: what this profile re-invented

Written on 17 September 2026, after the operator pointed out that the project was reinventing the wheel. Section 3 of SPEC.md says the profile "invents no primitive". That was not true enough: several members defined since 0.2 already exist in published standards or papers, and the spec did not cite them. This file records the audit, so that 0.6 can cite, map or adopt before adding anything new.

**How it was checked.** An audit agent read SPEC.md 0.5.1 and searched for each concept the spec defines itself. The rows marked *rechecked* were opened again by the author of this file on the same day. The other rows rest on the audit agent's reading, and are to be rechecked before any text in the spec relies on them.

## The two findings that change the project

1. **Pramana** — R. K. Kadaboina, *Pramana: A Protocol-Layer Treatment of Claim Verification in Autonomous Agent Networks*, arXiv [2605.20312](https://arxiv.org/abs/2605.20312), 19 May 2026. *Rechecked.* Agent outputs are wrapped in a typed `ClaimAttestation`, with four variants (measurement, inference, analogy, citation), each paired with a verification operation. The paper includes TLA+ specifications, a Python reference implementation, offline re-verifiability, and A2A and MCP wire extensions. The problem and the audience are the same as ours. This profile must cite it, and must state the difference or stop claiming one.
2. **Different lineage is a weak proxy for independence** — E. Kim, A. Garg, K. Peng, N. Garg, *Correlated Errors in Large Language Models*, ICML 2025, arXiv [2506.07962](https://arxiv.org/abs/2506.07962). *Rechecked.* "Larger and more accurate models have highly correlated errors, even with distinct architectures and providers." The older result is Knight and Leveson, IEEE TSE 1986, on the independence assumption in N-version programming. Section 9 and exit criterion 10.3 treat another model lineage as the route to independence. That assumption is questioned in the literature, and the spec has to say so.

## Overlaps by concept

| Spec concept | Existing work | Closeness | What to do |
|---|---|---|---|
| `derivation.span` as a whole (4.2.2) | Pramana `CitationClaim` (`src/pramana/primitives.py`): `source_uri`, `source_excerpt`, `source_retrieved_at`, optional `source_hash`, and a `verify()` that re-fetches the source and rejects on a missing excerpt or a hash mismatch. *Rechecked in the code.* | same, and more | Map to it. The hash repairs the version skew that 0.5 called unrepairable. |
| `derivation.span`: `quote`, `retrievedAt` (4.2.2) | W3C [Web Annotation Data Model](https://www.w3.org/TR/annotation-model/), Recommendation of 23 Feb 2017: `TextQuoteSelector` (`exact`, `prefix`, `suffix`), `TimeState` (`sourceDate`, `cached`). *Rechecked.* | same | Map, or adopt the terms. |
| Version-skewed citation (4.2.2, "what none of it repairs") | [Robust Links](https://journal.code4lib.org/articles/15509) (`data-versionurl`, `data-versiondate`) and [Memento, RFC 7089](https://www.rfc-editor.org/rfc/rfc7089.html). *Rechecked.* | same | Correct the spec: a dated snapshot URL partly repairs the case the spec calls unrepairable. |
| `kind` observed/derived/reconstructed (4.2) | Gene Ontology evidence codes (EXP, IDA, IC, IEA, TAS, NAS, ND); IPTC Digital Source Type | overlapping | Cite and map. |
| `channel` cached/mirrored/republished, self-state (4.2) | W3C PROV-DM Quotation, PrimarySource, alternateOf, Revision | overlapping | Add the PROV terms that section 3 does not cite yet. |
| `derivation.operation` (4.2.1) | OpenLineage column-lineage transformation types; Pramana claim types; Buneman et al., *Why and Where*, ICDT 2001 | overlapping | Map. `reconciled`, `available` and `sufficient` have no equivalent found. |
| Controlling source, `supersedes` (7.2) | Nanopublication `npx:supersedes` / `npx:retracts` (*rechecked*); PROV-DM Revision and Invalidation; ODRL 2.2 conflict strategy; AIF conflict and preference nodes | overlapping | Map. |
| Dispute statuses (7.2) | FEVER labels SUPPORTED / REFUTED / NOTENOUGHINFO; schema.org ClaimReview | overlapping | Map. `correction_supported` has no equivalent found. |
| Objection citation controlling/secondary (4.3), dispositions (4.4) | CiTO 2.9.0 (2026-09-03): `citesAsAuthority`, `citesAsEvidence`, `disputes`, `corrects`, `confirms`. *Rechecked.* | overlapping | Adopt or map. The name "Receipt" clashes with IETF SCITT. |
| Sealed field and commit–reveal (7.5) | Blind analysis in particle physics (Klein and Roodman, 2005); Sigstore Rekor transparency log | related | Keep. Cite the method's origin. Optionally anchor digests in a public log. |
| Replay, `witness`, `verifiedOn` (7.6, S12) | SLSA Verification Summary Attestation v1: `verifier.id`, `timeVerified`, `policy`, `verificationResult` PASSED/FAILED (*rechecked*); in-toto test-result predicate; known-answer tests (NIST CAVP); ACM artifact badges | overlapping | Give `verifiedOn` the fields of the VSA. Cite known-answer tests for `witness`. |
| Lineage strings | OpenTelemetry GenAI conventions `gen_ai.provider.name`, `gen_ai.request.model`. *Rechecked*; the attributes are now maintained in the dedicated GenAI conventions repository. | overlapping | Adopt the values. |
| `access` public/gated (7.7) | COAR Access Rights vocabulary | overlapping for the values | Map. The anonymous re-fetch that decides the value has no equivalent found. |
| Diagnostics and red/orange/green (7, 8.2) | OASIS SARIF 2.1.0 (`level`, `kind`, `ruleId`) | overlapping | Emit or map to SARIF. |

## What still looks specific

These are claims to test, not results:
- per-field dispositions of a receiver, kept apart from the sender's provenance;
- commit–reveal used to observe an independent re-derivation between agents;
- `reconciled` as non-evidence;
- `correction_supported`;
- the `terminal` flag;
- the anonymous probe behind `access`;
- a conformance suite built from dated external counterexamples.

Each of these has to be checked against Pramana first. Checked in its code on 17 September: Pramana records the outcome of a verification (`pending`, `verified`, `rejected`, `unverifiable`), and its experiments compare same-model, same-family and cross-family reviewer ensembles. The first and last items above are therefore narrower than they look: dispositions *other than* verification, and independence recorded *in the wire format*.
