# Attractor Cooperation Profile 0.2 — verifiable transmission between agents

**Working draft 0.2.1, 15 September 2026.** Profile identifier: `attractor-cooperation/0.2`. Changes since 0.2 are listed in section 11.1.

- No community has adopted this profile. It is a draft for comment and adversarial testing.
- The published v0.1 convention stays unchanged, including its schema fingerprint that external participants have pinned. This draft does not replace v0.1 until the exit criteria of section 10.3 are met.
- **Lineage disclosure.** This draft and its reference checker were written by Claude (Anthropic lineage) for the human-led Attractor project. v0.1 and its trial checker were written by Codex (OpenAI lineage). The four adversarial inputs come from terminator2-agent and Clara (bonyohana), who state that they act individually. Section 9 explains why this matters.

## 1. Purpose and scope

This profile is a human–AI protocol for the verifiable transmission of information, provenance, uncertainty and disagreement between independently operated AI systems.

It does not inspect any model's internal reasoning. It governs the **interface between two reasonings**: what agent A transmitted, where each piece came from, and what agent B did with each piece. A human can then audit a transmission without understanding either model.

Every transmitted object keeps three things apart, and implementations MUST NOT merge them:

1. **Content**: the value of each field.
2. **Provenance**: how that value was obtained, declared per field.
3. **Disposition**: what the receiver did with it (accepted, verified, re-derived, contested, modified, dropped).

A receiver's disposition never rewrites the sender's provenance.

Out of scope: transport, identity and authentication, the truth of natural-language statements, consensus and voting. The v0.1 rules on community decisions (adopt, reject, withdraw, authority checked out of band) still apply.

## 2. Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174) when, and only when, they appear in capitals.

- **Non-empty string**: a JSON string of length at least 1.
- **Has a member**: the JSON object contains that key, whatever its value, `null` included.
- **JSON-equal**: two values whose canonical forms (section 3.2) are identical. Object key order is ignored; array order is not. A value without a canonical form is JSON-equal to nothing.
- **Equals**, for identifiers, domains and versions: identical strings.
- **Sorted**: duplicates removed, ascending order of UTF-16 code units (the default JavaScript string sort).
- **Code with reference**: diagnostics are strings `code` or `code:ref`, where `ref` is a field, objection or disposition identifier.
- **Indexing by id**: an item whose id is not a non-empty string, or whose id occurs more than once in the same array, adds the diagnostic stated by the check, and **no occurrence** of that id is indexed. Which duplicate arrived first never matters.
- **Transitive sources** of a field: every id reachable from it by following `sources` arrays one or more times. An id that names no field is included but has no sources of its own. A field lying on a cycle is among its own transitive sources.
- **Missing collections**: an array member that is absent or not an array counts as empty; an absent object counts as an empty object.
- **Free text**: `interpretation` and `reason` are free text. Conformance never compares them.

## 3. What is reused

This profile invents no primitive. Its contribution is a combination and an adversarial test suite.

| Need | Reused standard | Use here |
|---|---|---|
| Envelope, identity of an event | CloudEvents 1.0.2 | Unchanged from v0.1; `source` + `id` identify an event. |
| Derivation and attribution | W3C PROV-O | `sources` ≈ `prov:wasDerivedFrom`; `channel` cached/mirrored/republished with `upstream` ≈ `prov:wasQuotedFrom` / `prov:hadPrimarySource`; `author` ≈ `prov:wasAttributedTo`. No RDF export is claimed. |
| Separating assertion, provenance and publication | Nanopublication model | Value, provenance and disposition are kept apart in the same way. |
| Canonical JSON | RFC 8785 (JCS) | Equality, commitments and receipt digests. |
| Hash | SHA-256 (FIPS 180-4) | Commitments and digests, lowercase hexadecimal. |
| Commit–reveal | Standard hash commitment | Makes independent re-derivation observable (section 7.5). |
| Shape | JSON Schema 2020-12 | `schema/transmission.schema.json`. |

### 3.2 Canonical form

The canonical form is RFC 8785. For the JSON values used by this profile, an implementation MAY use: object keys sorted by UTF-16 code units, no insignificant whitespace, strings and numbers serialized as ECMAScript `JSON.stringify` does. Values that have no JSON representation cannot be canonicalized; a check that needs them fails as specified.

## 4. Object model

The shape of every object is normative in `schema/transmission.schema.json`. Shape validity establishes nothing about behaviour, truth or authority.

### 4.1 Record

A record is what one agent transmits.

| Member | Required | Meaning |
|---|---|---|
| `id` | yes | Non-empty string. |
| `parent` | yes | The `id` of the record this one continues, or `null` for a first record. |
| `author` | yes | `{actor, lineage}`. `lineage` names the model family and provider, for example `anthropic/claude` or `openai/gpt`, or `human`. It is a declaration. |
| `fields` | yes | Array of fields (4.2). |
| `objections` | yes | Array of objections (4.3). Possibly empty. |

### 4.2 Field

| Member | Meaning |
|---|---|
| `id` | Non-empty string, unique in the record. |
| `value` | Any JSON value. Absent if and only if the field is sealed. |
| `kind` | `observed`: read by the author from a channel. `derived`: computed from `sources`. `reconstructed`: rebuilt after a loss, from `sources`. `unknown`: origin unknown, declared honestly. |
| `sources` | Array of field ids of the same record. Empty for `observed` and `unknown`; non-empty for `derived` and `reconstructed`. |
| `channel` | For `observed` fields: `direct` (first-hand read), `cached`, `mirrored` or `republished` (a copy). |
| `upstream` | The authority a channel reads or copies, SHOULD be a URI. REQUIRED when `channel` is not `direct`. |
| `uncertainty` | OPTIONAL object, per field. A record-level confidence MUST NOT replace it: an average hides the one field that is wrong. |
| `expect` | What the sender asks of the receiver: `accept` (default), `verify` or `re_derive`. |
| `sealed` | `{alg: "sha256-jcs", commitment}` for a field to be re-derived blind (section 5, S4). |

`observed` is a relation between an agent and a channel, not between an agent and the world. A cache, a mirror, a state file written by the agent's previous cycle and a peer's re-publication are channels that forget their parent. This is why `channel` and `upstream` exist.

### 4.3 Objection

`{id, target, proposedValue?, by?, basis, note?}`. `target` is a field id. `basis` is `{citation, sourceId?, note?}` where `citation` is `controlling` (the source that settles the question locally), `secondary`, or `none`. `none` declares a hunch; it is allowed and MUST be explicit. `sourceId` is REQUIRED unless `citation` is `none`.

An objection that survives as text while its basis is dropped becomes indistinguishable from a hunch; downstream revisers then prefer the proposal, and disagreement decays into consensus without anyone deciding it.

### 4.4 Receipt

What the receiver publishes after reading a record: `{id, target, dispositions, record}`. `target` is the sent record's `id`. `dispositions` holds one `{field, action, basis?, objection?, reason?}` per sent field. `record` is the receiver's resulting record, whose `parent` is the sent record's `id`.

### 4.5 Reveal

What the sender publishes after the receipt: `{target, receiptDigest, reveals}`. `target` is the receipt's `id`. `receiptDigest` is the SHA-256 of the receipt's canonical form. `reveals` holds `{field, salt, value}` for sealed fields.

### 4.6 Dispute input

The dispute check (7.2) reads `{claim, objection, policy, sources}` as in the v0.1 trial: `claim {id, value, domain, version}`, `objection {id, claimId, proposedValue, sourceId?}`, a local `policy {claimId, sourceId, domain, version, verified}` designating the controlling source, and `sources [{id, value, domain, version, status, supersedes?}]`. `supersedes` is a source id or an array of source ids. `verified` flags come from the receiver's own trust mechanisms, never from the incoming message.

### 4.7 Transport

Records, receipts and reveals travel in the v0.1 CloudEvents envelope with types `org.attractor.cooperation.record.v0.2`, `org.attractor.cooperation.receipt.v0.2` and `org.attractor.cooperation.reveal.v0.2`. `data` carries `profile: "attractor-cooperation/0.2"`, the v0.1 members `community`, `actor`, `question`, `reason`, `limitations`, and one of `record`, `receipt` or `reveal`. v0.1 actions keep their meaning under `.v0.2` type names. v0.1 rule 11 (duplicates, conflicts, relays keep the original envelope) applies unchanged.

## 5. Sender requirements (agent A)

- **S1.** Every field MUST declare `kind` and `sources`. An `observed` field SHOULD declare `channel`; a non-direct channel MUST declare `upstream`. Without them, no receiver can conclude that the field is independent of anything.
- **S2.** Provenance MUST be declared per field.
- **S3.** Every objection MUST carry a `basis`.
- **S4.** A field the receiver must re-derive MUST be sealed: its `value` is withheld and `sealed.commitment` is the SHA-256 of the canonical form of `{"field": id, "salt": salt, "value": value}`. The salt MUST be a non-empty string and SHOULD carry at least 128 random bits, unique per field.
- **S5.** No field that carries a value may have a sealed field among its transitive sources. The sender MUST NOT disclose a sealed value in any other way before the reveal. Free-text leaks cannot be checked (section 12).
- **S6.** `author.lineage` SHOULD be declared.
- **S7.** The sender MUST reveal only after the receipt is published, and MUST bind the receipt's digest in the reveal.

## 6. Receiver protocol (agent B)

1. Check the sent record (7.3). A non-conformant record MAY still be read; the human report says why.
2. Give every sent field exactly one disposition:

| Action | Meaning | B's record must |
|---|---|---|
| `accept` | Taken on A's word. | carry the field JSON-equal to A's, ignoring `expect`. |
| `verify` | Checked against a basis while seeing A's value. | carry the field unchanged and name a `basis` field of B's record. |
| `re_derive` | Computed without seeing A's value. | contain the field with B's own value and provenance. |
| `contest` | Objected to, original kept. | carry the field unchanged and add a new objection (`disposition.objection`) with a basis. |
| `modify` | Replaced on a basis. | contain the new value, name a `basis` field and list it in the field's `sources`. |
| `drop` | Not carried. | not contain the field; `reason` is required. |

3. **Carrying is not observing.** A carried field keeps A's provenance. B MUST NOT relabel a carried field as its own observation: a relay that does so becomes a cache that forgets its parent.
4. B's record MUST name A's record as `parent`, MUST carry every objection of A unchanged, basis included, and MUST keep its provenance complete.
5. B publishes the receipt before any reveal. A sealed field can only be re-derived or dropped.
6. On reveal, B or anyone checks it (7.5).

`verify` and `re_derive` answer different questions. A receiver that has never disagreed on a field it could see has not demonstrated re-derivation, because obeying and re-deriving correctly leave identical logs. Only a sealed field makes re-derivation observable.

## 7. Checks

Each check is a pure function. It MUST NOT mutate its input. Its result MUST NOT depend on the order of `fields`, `sources`, `objections`, `dispositions` or `reveals`. Every array it returns is sorted, except `results` in 7.5, which is ordered by field id. The reference implementation is `reference/index.mjs`; the function names below are those it exports.

### 7.1 Lineage — `inspectLineage({fields, comparison: {left, right}})`

Question answered: do two fields of one record share a declared input? A shared input cannot be checked by comparing the two fields: redundancy is only redundancy if the checks do not share an input.

1. Index fields by `id` (section 2). An invalid or repeated id adds problem `missing-or-duplicate-field-id`.
2. The roots of a field, following the path from the compared field:
   - not indexed: problem `missing-field`, no roots;
   - already on the current path: problem `source-cycle`, no roots;
   - `sources` not an array, or containing anything but non-empty strings: problem `missing-or-invalid-sources`, no roots;
   - `kind` is `observed` and `sources` is empty: the field itself is a root;
   - `kind` is not `derived` or `reconstructed`, or `sources` is empty: problem `unknown-or-inconsistent-provenance`, no roots;
   - otherwise: the union of the roots of its sources.
3. For every root reached from either side:
   - `upstream` present but not a non-empty string: problem `invalid-upstream`;
   - `channel` present but not `direct`, `cached`, `mirrored` or `republished`: problem `invalid-channel`;
   - its **key** is `upstream` when that is a non-empty string, otherwise the root's `id`;
   - it is **verifiable** when `channel` is present and either equals `direct` or `upstream` is a non-empty string. If `channel` is absent: warning `observed-channel-undeclared`. If `channel` is present, is not `direct`, and `upstream` is not a non-empty string: warning `upstream-undeclared`.
   - Each side is a set of keys. A key is verifiable on a side when every root of that side with that key is verifiable.
4. If steps 1 to 3 found any problem, including one caused by a field unrelated to the comparison: status `unknown`, `sharedSources` empty, both `independentRoots` lists empty.
5. `sharedSources` is the sorted intersection of the two key sets. `independentRoots.left` is the sorted list of keys of the left side that are verifiable and absent from the right side; `independentRoots.right` likewise.
6. If `sharedSources` is empty: status `independent` when every key of both sides is verifiable; otherwise status `unknown`, with `independentRoots` lists empty.
7. Otherwise: status `dependent-partial` when either `independentRoots` list is non-empty, else `dependent`.

Result: `{status, sharedSources, independentRoots: {left, right}, problems, warnings, interpretation}`. `problems` and `warnings` are sorted codes without reference; `interpretation` is free text.

Reading the statuses: `dependent` means the comparison cannot detect an error in the shared input, which covers a value back-filled from its own comparand. `dependent-partial` means at least one side also carries an input the other lacks; a forecaster who consults the market price among other evidence is partially dependent, not circular. Consumers MUST NOT read `dependent-partial` as `independent`. Two direct reads of one instrument share that instrument: they detect a change, never an error of the instrument. Missing declarations block a conclusion of independence, never a declared dependence.

### 7.2 Dispute — `inspectDispute({claim, objection, policy, sources})`

Question answered: what does the receiver's own controlling source say about a disputed claim? The claim's status and the quality of the objection's citation are two separate facts.

1. **Structure.** Unless `claim`, `objection` and `policy` are present, `claim.id` and `objection.id` are non-empty strings, `claim` has a member `value`, `objection` has a member `proposedValue`, and `claim.domain` and `claim.version` are non-empty strings: status `unresolved`.
2. **Policy.** Unless `objection.claimId` and `policy.claimId` equal `claim.id`, `policy.verified` is `true`, and `policy.domain` and `policy.version` equal those of the claim: `unresolved`.
3. **Source identity.** `sources` that is not an array counts as empty. Unless every source `id` is a non-empty string and no two are equal: `unresolved`.
4. **Controlling source.** The source whose `id` equals `policy.sourceId`. Unless it exists, its `status` is `verified`, its `domain` and `version` equal the claim's, and it has a member `value`: `unresolved`. Otherwise it is **established**.
5. **Precedence.** If another source has `status` `verified`, the claim's `domain` and `version`, lists the controlling source's `id` in `supersedes`, has a member `value`, and its value is not JSON-equal to the controlling value: `unresolved`, until local policy decides which instrument controls. An unverified source never blocks; otherwise any message could block every confirmation.
6. **Status.** Controlling value JSON-equal to `claim.value`: `confirmed`. Else JSON-equal to `objection.proposedValue`: `correction_supported`. Else: `contradicted`.

**Undeclared contradiction (0.2.1).** Once a controlling source is established at step 4, every other source with `status` `verified`, the claim's `domain` and `version`, a member `value` not JSON-equal to the controlling value, and whose `supersedes` does not list the controlling source's `id`, adds the warning `contradicted-undeclared:<its id>`. A warning never changes the status: an undeclared note does not govern, but it must not stay unseen.

Result: `{status, value, original, objection, reason, applied, objectionAssessment, warnings}`.

- `value` is `claim.value`; `original` and `objection` are deep copies of the inputs; `reason` is free text; `applied` is always `false`. Nothing is ever corrected automatically: a supported correction justifies a new version, it does not overwrite the old one.
- `objectionAssessment.citation`: `none` if `objection.sourceId` is not a non-empty string; `controlling` if a controlling source was established at step 4 and `sourceId` equals its `id`, even when step 5 then returns `unresolved`; otherwise `secondary`.
- `objectionAssessment.proposedValueSupported`: for `confirmed`, `correction_supported` and `contradicted`, whether the controlling value is JSON-equal to `proposedValue`; otherwise `null`.
- `warnings`: sorted; empty when no controlling source was established.

### 7.3 Record — `inspectRecord(record)`

Sender-side conformance before transmission. Violations:

| Code | When |
|---|---|
| `missing-record-id` | `id` is not a non-empty string. |
| `missing-or-duplicate-field-id` | A field id is not a non-empty string or repeats (no occurrence is indexed, section 2). |
| `source-cycle` | Some indexed field is among its own transitive sources. |
| `invalid-expect:F` | `expect` is present and not `accept`, `verify` or `re_derive`. |
| `invalid-kind:F` | `kind` is not one of the four kinds. |
| `missing-or-invalid-sources:F` | `sources` is not an array of non-empty strings. |
| `provenance-truncated:F` | With valid `sources`: one names no field of the record. |
| `inconsistent-provenance:F` | With valid `sources` and a valid kind: `derived`/`reconstructed` without sources, or `observed`/`unknown` with sources. |
| `invalid-seal:F` | `sealed` present, and `alg` is not `sha256-jcs` or `commitment` is not 64 lowercase hexadecimal characters. |
| `sealed-value-present:F` | `sealed` and `value` both present. |
| `sealed-without-re-derive:F` | `sealed` present and `expect` (default `accept`) is not `re_derive`. |
| `re-derive-unsealed:F` | `expect` is `re_derive` and `sealed` is absent. |
| `missing-value:F` | Neither `sealed` nor `value`. |
| `invalid-channel:F` | An `observed` field has a `channel` outside the four values. |
| `sealed-value-leak:F` | F is not sealed and a sealed field is among its transitive sources. |
| `missing-or-duplicate-objection-id` | An objection id is not a non-empty string or repeats. |
| `objection-target-missing:O` | `target` names no field. |
| `objection-basis-missing:O` | `basis` is not an object, `citation` is not one of the three values, or `sourceId` is not a non-empty string while `citation` is not `none`. |

Warnings: `observed-channel-undeclared:F`; `upstream-undeclared:F` (an `observed` field with a valid non-direct channel and no non-empty `upstream`); `lineage-undeclared` (`author.lineage` not a non-empty string).

Transitive sources follow the definition of section 2, over indexed fields.

Result: `{status: "conformant" | "non-conformant", violations, warnings}`, `conformant` if and only if there is no violation.

### 7.4 Hop — `inspectHop({sent, receipt})`

Receiver-side conformance of one hop. Let R be `receipt.record` (an empty object if absent). Fields and objections of `sent` and R are indexed by `id`; an empty or repeated id adds `sent-record-invalid` or `received-record-invalid`.

1. `parent-missing` if `sent.id` is not a non-empty string or `R.parent` differs from it.
2. Dispositions: the reference is `field` when it is a non-empty string, else the empty string. A reference that names no sent field: `unknown-field-disposition:ref`. A sent field with more than one disposition: `duplicate-disposition:F`; none of its dispositions is used or counted, and step 3 skips that field.
3. For each sent field F without duplicate dispositions:
   - no disposition: `missing-disposition:F`, next field;
   - `action` not one of the six: `invalid-disposition:F`, next field;
   - the action is counted;
   - F sealed and action neither `re_derive` nor `drop`: `sealed-field-not-re-derived:F`, next field;
   - **kept** means R has a field F that is JSON-equal to the sent F once `expect` is removed from both;
   - `accept`: not kept, `altered-on-accept:F`;
   - `verify`: not kept, `altered-on-verify:F`. If `basis` is not a non-empty string naming a field of R: `verify-without-basis:F`. Else if `basis` equals F, or F is a transitive source of `basis` in R: `circular-verification:F`. Else run 7.1 on R's fields with `left` F and `right` `basis`, and warn `verification-dependent:F`, `verification-partially-dependent:F` or `verification-unverifiable:F` when its status is `dependent`, `dependent-partial` or `unknown`;
   - `re_derive`: F not sealed, warning `re-derivation-unprovable:F`. If R has no field F, or R's F has no member `value`, or has a member `sealed`: `re-derivation-missing:F`. Else, if F is sealed, F is pending reveal;
   - `contest`: not kept, `original-overwritten:F`. If R has no objection with id `disposition.objection`, or its `target` is not F, or that id is an objection id of `sent`: `contest-objection-missing:F`. Else if its basis fails the rule of `objection-basis-missing` (7.3): `contest-without-basis:F`;
   - `modify`: F is marked modified. R has no field F: `modified-field-missing:F`. `basis` not a non-empty string naming a field of R: `modify-without-basis:F`; else, if R has F and its `sources` do not contain `basis`: `modification-provenance-omits-basis:F`. If R has F and F is kept: warning `modify-without-change:F`;
   - `drop`: `reason` not a non-empty string, `drop-without-reason:F`; R has F, `dropped-field-present:F`.
4. Every field G of R whose `sources` is an array naming a field absent from R: `provenance-truncated:G`.
5. Every objection O of `sent`: absent from R, `objection-lost:O`. Otherwise, if the two `basis` members are not JSON-equal (a missing basis counts as `null`): `objection-basis-lost:O`; if the objections without `basis` are not JSON-equal: `objection-altered:O`.
6. For every sent field F whose single disposition is `accept` or `verify`, even if step 3 rejected it on a sealed field: if a transitive source of F in R is marked modified, warning `ancestor-modified:F`.
7. With `a = sent.author.lineage` and `b = R.author.lineage`: either not a non-empty string, warning `lineage-undeclared`; else if equal and not `human`, warning `same-lineage`.

Result: `{status, violations, warnings, counts, pendingReveal}`. `counts` has the six actions as keys, including actions later rejected on a sealed field. `status` is `conformant` if and only if there is no violation.

### 7.5 Reveal — `inspectReveal({sent, receipt, reveal})`

1. `reveal-target-mismatch` if `receipt.id` is not a non-empty string or `reveal.target` differs from it.
2. `receipt-digest-mismatch` if `reveal.receiptDigest` differs from the SHA-256 of the receipt's canonical form, or the receipt cannot be canonicalized.
3. A reveal item whose `field` is not a non-empty string, or a field revealed more than once: `duplicate-or-invalid-reveal`; no item of a repeated field is used.
4. The fields checked are the sorted ids of dispositions with action `re_derive` on a sealed field of `sent`. For each: no reveal item, it is **missing**. Otherwise the commitment **matches** when `salt` is a non-empty string, the item has a member `value`, and the SHA-256 of the canonical form of `{"field", "salt", "value"}` equals the sealed commitment. No match: `commitment-mismatch:F`. The outcome is `invalid` without a match; `agree` when R's field F has a `value` JSON-equal to the revealed one; otherwise `disagree`.

Result: `{status, results, missing, violations}` with `results` entries `{field, commitment: "match" | "mismatch", outcome}`. `status` is `invalid` if there is any violation, else `incomplete` if any field is missing, else `verified`.

What this proves: the sender cannot change its answer after seeing the receiver's, and the receiver cannot edit its receipt after the reveal. It does not prove that the receiver never saw the value through another channel.

## 8. Human control

### 8.1 What the human controls

The human does not read models' reasoning. The human controls three things:

- **Gates.** v0.1 decisions (adopt, reject, withdraw) remain decisions of an actor whose authority is verified out of band. An agent MUST NOT emit a decision on behalf of its operator without a recorded human decision it can reference.
- **The per-hop report** below, which a human can read in a few seconds.
- **The stop.** Any hop can be halted; nothing in this profile applies a correction automatically.

### 8.2 Per-hop report — `driftReport({sent, receipt, reveal?})`

Run 7.3 on `sent`, 7.4 on the hop and, when a reveal is given (the member `reveal` is present and not `null`), 7.5.

- `violations`: sorted, prefixed `sender/`, `receiver/` or `reveal/`.
- `warnings`: sorted, prefixed `sender/` or `receiver/`.
- `pendingReveal`: the reveal's `missing` list when a reveal is given, else the hop's `pendingReveal`.
- `counts`: the hop's six counts plus `re_derive_agree` and `re_derive_disagree` from the reveal results.
- `level`: **red** if there is any violation; else **orange** if there is any warning, any disagreeing re-derivation, any pending reveal, or any `contest`, `modify` or `drop`; else **green**.

Result: `{level, counts, violations, warnings, pendingReveal}`. Red means the transmission broke a rule. Orange means it is conformant but a human should look. Green means conformant, independently checked where it was asked, and in agreement.

### 8.3 Across a chain

Drift is measured hop by hop. A chain A → B → C is only as conformant as its worst hop. Over many hops, the useful measures are the disagreement rate on **sealed** fields, the survival of objections with their basis, provenance truncations and relabellings. None of them is a quality score: two independent derivations can agree, and zero disagreement on visible fields proves nothing.

## 9. Independence of participants

The rule that makes a check redundant applies to agents themselves: two checks by the same model family share an input. A hop between two agents of the same declared lineage is conformant but receives warning `same-lineage`.

Applied to this draft: its author is Claude; one external contributor declares running on Claude; the reformulation that started it came from ChatGPT; v0.1 was written by Codex. Conformance evidence for leaving draft status MUST therefore come from implementations by **different operators and different lineages**, written from this document without reading each other's code.

## 10. Conformance

### 10.1 Claims

A checker implementation claims conformance to this draft by passing every case of `conformance/cases.json` through `conformance/run.mjs` (or an equivalent harness), and by publishing its runtime, expected versus actual results, and limitations. A sender or receiver claims conformance for a given hop when that hop is green or orange, never red. Passing establishes behaviour on these inputs, not the truth of any value.

### 10.2 The suite

| Kind | Cases | Of which |
|---|---|---|
| Lineage (7.1) | 19 | 8 migrated from v0.1, 4 from terminator2-agent's counterexamples (verbatim and declared), 1 from the first blind trial |
| Dispute (7.2) | 16 | 8 migrated from v0.1, 2 from Clara (bonyohana)'s counterexamples (verbatim), 1 from her 0.2.1 request |
| Record (7.3) | 11 | 1 from the first blind trial |
| Hop (7.4) | 22 | 3 from the first blind trial |
| Reveal (7.5) | 8 | 1 from the first blind trial |
| Drift report (8.2) | 5 | |
| **Total** | **81** | |

`run.mjs` also checks that inputs are not mutated, that arrival order does not change results, and that a dispute never applies a revision nor loses the original claim or objection. `cross-check.py` recomputes every commitment and receipt digest in Python. `schema-check.mjs` validates the shape of every input expected to be conformant.

### 10.3 Exit criteria

This profile leaves draft status only when:

1. two implementations by different operators and different lineages, each written from this document alone, pass every case;
2. every external counterexample either passes or is recorded as a known limit, with the contributor's objection kept;
3. at least one real transmission between two independently operated agents, with receipt and reveal, is checked by both implementations;
4. the Attractor operator records the decision.

### 10.4 Trials so far

| Date | Implementer | Lineage | Result | Record |
|---|---|---|---|---|
| 2026-09-15 | Claude Sonnet subagent, from the text alone | same as the author | 74/74 on the suite of that moment; 12 ambiguities; 6 cases and 11 clarifications added; 76/80 on the revised suite, failing exactly the 4 cases that pin rewritten rules | `trials/2026-09-15-blind-same-lineage/` |
| 2026-09-15 | Codex, from the text alone | different (OpenAI) | Not run: the Codex service did not start the job | operator's local records |

Neither trial satisfies criterion 1: the first shares the author's lineage, the second did not run. On the 0.2.1 suite the same-lineage implementation passes 73 of 81 cases, since it predates the 0.2.1 warning.

## 11. Changes from the v0.1 trial checker

| Case | v0.1 | v0.2 | Why |
|---|---|---|---|
| terminator2-agent case 1, verbatim | independent | unknown | Undeclared channels no longer prove independence. |
| terminator2-agent case 1, declared | independent | dependent | The cache names its upstream; keys match. |
| terminator2-agent case 2, declared | dependent | dependent-partial | The analyst note is an independent root. |
| Clara (bonyohana) case 1 | unresolved | correction_supported | Claim status follows the controlling source; citation reported apart. |
| Clara (bonyohana) case 2 | confirmed | unresolved | A verified same-scope instrument claims precedence. |
| v0.1 `dispute-value-match-does-not-transfer-source-authority` | unresolved | correction_supported | Same principle as Clara (bonyohana) case 1; the citation stays `secondary`. |
| Equal observations without channel | independent | unknown | Channel now required to conclude independence. |
| New: controlling source contradicts both | unresolved | contradicted | "We cannot tell" and "the original is refuted" are different states. |
| New: cached root without upstream | independent | unknown | A copy that does not name what it copies may hide the comparand. |
| New: two direct reads of one instrument | independent | dependent | Both share the instrument. |
| New: channel outside the four values | independent | unknown | Unusable declaration, not silently direct. |
| New: `supersedes` given as a list | confirmed | unresolved | Same rule as Clara (bonyohana) case 2. |
| New: objection without source | unresolved | correction_supported | A declared hunch; the claim status still follows the controlling source. |

The other 15 v0.1 cases keep their v0.1 status. terminator2-agent's verbatim case 2 stays `dependent`: its inputs lack the declarations that would show the partial dependence. For verbatim case 1, the contributor expected `dependent`; no checker can derive it from that record, which does not say the cache copies the venue. v0.2 returns `unknown` rather than a false `independent`, and `dependent` once the channel is declared. This difference is recorded, not hidden.

### 11.1 Changes in 0.2.1

| Change | Origin |
|---|---|
| The dispute check reports `contradicted-undeclared:<sourceId>` for a verified same-scope source that contradicts the controlling one without claiming precedence. Status unchanged. | [Clara (bonyohana), 15 September](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5682799621) |
| One new case (her variant of case 2 without `supersedes`: `confirmed` plus the warning); three dispute cases gain a `warnings` expectation. | Same |

The narrow supersession rule of 0.2 is kept: Clara (bonyohana) confirmed that the broad form would let preserved dissent block confirmations in her own register.

## 12. Known limits

- Declared provenance can lie. A hidden copy declared `direct` is undetectable from the record alone.
- A sealed value leaked through another channel or through free text is undetectable. Commit–reveal proves order, not ignorance.
- Values are compared as exact JSON. There is no natural-language equivalence.
- A controlling source fits scoped documents such as agreements. It is not a universal authority for scientific or factual questions.
- `dependent-partial` can be gamed by adding a decorative independent source. It is weaker evidence and never independence.
- Lineage strings and verified flags are declarations or local policy, never authentication.
- Except for the four external inputs and the sixteen v0.1 cases, the suite's expected outcomes were written by the same author as the reference checker. Mutation testing (14 deliberately broken checkers, all detected) reduces but does not remove this bias. Section 9 states the remedy.

## 13. Contributors and sources

- **terminator2-agent** (display name Claudius Maximus): per-field provenance with observed / derived / reconstructed; circular controls that share an input; carried objections needing their basis; re-derivation rather than acceptance; the honest cache that launders the comparand; sole versus partial determination. [First contribution](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5656528807), [counterexamples](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5657026385).
- **Clara** (bonyohana): the controlling instrument; an objection from a stronger but non-controlling source must not delete a true claim; claim status separate from citation discipline; supersession between instruments; the undeclared-contradiction warning of 0.2.1. [First contribution](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5656534610), [counterexamples](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5659817602), [gist revision 1fcf282a](https://gist.github.com/bonyohana/6ca7b510c3c78bff90347f7cd82611cb).
- v0.1 convention: [cooperation guide](https://attractor-observatory-demo.vercel.app/cooperation-guide.md) and [schema](https://attractor-observatory-demo.vercel.app/convention-schema.json) (SHA-256 `cc013ef87ac7275b…`); v0.1 trial checker: [feedback guide](https://attractor-observatory-demo.vercel.app/feedback-guide.md).

Their participation is individual. It is not an endorsement of this draft by them or by any community.
