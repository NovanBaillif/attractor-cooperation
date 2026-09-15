# Trial of 15 September 2026 — blind implementation, same lineage

**What it measures:** whether SPEC.md alone lets another agent implement the six checks. **What it does not measure:** independence. The implementer is a Claude Sonnet subagent, the same lineage as the author (SPEC section 9). It counts as a `same-lineage` hop.

## Protocol

- The implementer received two files only: SPEC.md as it stood then (kept here as `SPEC-as-read.md`, SHA-256 `ebf467fd6fcd083bd75d6c471fba064e663874ca5643f6de5e71fb797e699bf0`) and the schema. The reference checker and the cases were withheld.
- It declared that it read nothing else. That is a declaration, not an enforced isolation.
- It wrote `impl.mjs` (SHA-256 `612e95d1bdcdee2162b3f246aa481dfe649395e86d2f221402cca70ce0803876`) and `AMBIGUITIES.md`, both kept here unchanged.

## Results

| Step | Result |
|---|---|
| Suite of that moment, 74 cases | 74 / 74 |
| Ambiguities reported | 12 |
| Differential test against the reference, 18,000 seeded random inputs | 1 divergence |
| Cases added in response | 6 |
| Same implementation on the revised suite, 80 cases | 76 / 80 |
| Differential test after the revision, 30,000 inputs | 3 divergences, all on one point now pinned by a case |
| Same implementation on the 0.2.1 suite, 81 cases | 73 / 81: it predates the 0.2.1 warning |

The 4 failures on the revised suite are exactly the cases that pin rules rewritten after the implementation was written (`run-after-text-fixes.json`). This is the intended outcome: the new cases detect the old reading.

## What each ambiguity changed

| # | Ambiguity | Outcome |
|---|---|---|
| 1 | "Order never matters" contradicted "the first duplicate counts" | Rule changed: a repeated disposition or reveal is reported and none counts. |
| 2 | Which duplicate id is indexed | Rule clarified: no occurrence is indexed (the implementer's reading). |
| 3 | Scope of "any problem" in 7.1 | Clarified: steps 1 to 3, any field. |
| 4 | Free-text `interpretation` and `reason` | Clarified: never compared. |
| 5 | "equals" versus "JSON-equal" | Defined: identical strings for ids, domains, versions. |
| 6 | JSON-equality of values without canonical form | Defined: equal to nothing. |
| 7 | Transitive sources over cycles and missing ids | Defined as reachability; missing ids included. The differential divergence came from here: the old text said to ignore them and the reference did not. |
| 8 | `invalid-channel` only on observed fields | Kept: `channel` only means something on observed fields. |
| 9 | Malformed top-level collections | Defined: missing arrays are empty. |
| 10 | When a reveal is "given" to the report | Defined: present and not null. |
| 11 | Whether step 6 includes rejected dispositions | Clarified: yes. |
| 12 | Reveal reads dispositions independently of the hop check | Kept as written. |

The pattern is the one the profile describes: A transmits, B contests with a basis, A publishes a new version and B's objections stay on file here verbatim.

## Replay

```sh
node ../../conformance/run.mjs ./impl.mjs          # 76 / 80 on the revised suite
node ./diff-fuzz.mjs ./impl.mjs 5000              # seeded differential test
```
