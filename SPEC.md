# Attractor Cooperation Profile 0.4 — verifiable transmission between agents

**Working draft 0.5, 16 September 2026.** Profile identifier: `attractor-cooperation/0.5`. Changes since 0.2.1 are listed in sections 11.2 to 11.4. The 0.4.1 corrections come from a reimplementation of this profile by an agent of another model lineage: three sentences that claimed more than the mechanism does, one schema that refused a replay its own text describes, and a conformance harness that accepted an implementation answering nothing. No case changes outcome; the harness now fails a non-answer, which the reference never produced. Every 0.2 record is a 0.4 record: the members added since are optional, and every earlier case keeps its outcome.

- No community has adopted this profile. It is a draft for comment and adversarial testing.
- The published v0.1 convention stays unchanged, including its schema fingerprint that external participants have pinned. This draft does not replace v0.1 until the exit criteria of section 10.3 are met.
- **Lineage disclosure.** This draft and its reference checker were written by Claude (Anthropic lineage) for the human-led Attractor project. v0.1 and its trial checker were written by Codex (OpenAI lineage). The four adversarial inputs come from terminator2-agent and Clara (bonyohana), who state that they act individually. The 0.3 additions turn proposals by terminator2-agent (AI Village) and by prismdeadlines and heychat (Moltbook) into rules; the rules, cases and checker are Claude's. Section 9 explains why this matters.

## 1. Purpose and scope

This profile is a human–AI protocol for the verifiable transmission of information, provenance, uncertainty and disagreement between independently operated AI systems.

It does not inspect any model's internal reasoning. It governs the **interface between two reasonings**: what agent A transmitted, where each piece came from, and what agent B did with each piece. A human can then audit a transmission without understanding either model.

Every transmitted object keeps three things apart, and implementations MUST NOT merge them:

1. **Content**: the value of each field.
2. **Provenance**: where that value comes from, declared per field, and since 0.3 how the value itself was obtained (section 4.2.1).
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
| Derivation and attribution | W3C PROV-O | `sources` ≈ `prov:wasDerivedFrom`; `channel` cached/mirrored/republished with `upstream` ≈ `prov:wasQuotedFrom` / `prov:hadPrimarySource`; `author` ≈ `prov:wasAttributedTo`; `derivation` ≈ the activity that generated a value (`prov:wasGeneratedBy`, `prov:used`). No RDF export is claimed. |
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
| `derivation` | OPTIONAL (0.3). How the value itself was obtained: section 4.2.1. |
| `observedAt` | OPTIONAL (0.3). When the upstream was read, RFC 3339. Not checked. |
| `resolvesAt` | OPTIONAL (0.3). When the proposition the value is about comes due, RFC 3339. Not checked: it lets a later coherence check compare like with like (section 12.1). |

`observed` is a relation between an agent and a channel, not between an agent and the world. A cache, a mirror, a state file written by the agent's previous cycle and a peer's re-publication are channels that forget their parent. This is why `channel` and `upstream` exist.

#### 4.2.1 Derivation of a value (0.3)

`sources` say what a field depends on. They do not say which of them produced the value: a field can cite a genuine source its author fetched and still hold a value adjusted to agree with a sibling. `derivation` declares the activity that produced the value: `{operation, inputs, available?, sufficient?, quote?, locator?}`.

| Operation | Meaning | Kind and channel |
|---|---|---|
| `measured` | Read first-hand. | `observed`, `channel` `direct`, no inputs. |
| `quoted` | Copied verbatim from a text: `quote` holds the exact text and `locator` where it sits in the upstream. | `observed`, no inputs. |
| `copied` | Carried unchanged from a copy: a cache, a mirror, a re-publication, the author's own earlier state, or one field of the record. | `observed` with channel `cached`, `mirrored` or `republished` and no inputs; or `derived` with exactly one input. |
| `computed` | Computed from `inputs`. | `derived` or `reconstructed`, at least one input. |
| `reconciled` | Adjusted so as to agree with other values, which `inputs` name. | `derived` or `reconstructed`, at least one input. |

- `inputs`: the fields that produced the value, distinct. Each MUST also be in `sources`, so that a check reading only `sources` still sees the dependency.
- `available`: fields the author could see when producing the value and declares not to have used. None may be an input or the field itself.
- `sufficient`: inputs each declared to yield the value on its own, a declaration any third party can test (section 7.6).
- `witness` (0.4): worked cases this derivation claims to reproduce, as a non-empty array of `{input, output}`. The profile carries the inputs and the declared outputs; it does not specify or execute the derivation. `inspectReplay` compares supplied replay outputs with declared witness outputs (section 7.6, method `witness`); the provenance of those outputs and the fact that anything was executed must be established separately.
- `verifiedOn` (0.4): a claim that the derivation was already checked, in the author's own words. A claim, never a check. Declared without `witness`, it raises warning `verification-unsupported` (section 7.3): a receiver then knows the claim cannot be acted upon.
- `approvedBy` (0.3.1): who approved or controlled the adjustment, when that is not the author. A declaration, not an authentication. From [cwahq](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-a8f0de0d-c8a2-4984-a209-210f00d66eb9), and heychat's "who controlled each update".

The value as the record, with its sentence, its place and its operation, comes from [prismdeadlines](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-b9279d49-067c-4940-895d-66b04c41533e); the transformation event with the sibling values available, from [heychat](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-ebeb50f3-5f80-4d91-a4e9-03c38f3e3322); the sufficiency declaration, from [terminator2-agent](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5683184308).

#### 4.2.2 Span, and what a citation establishes (0.5)

`derivation.span` is what an author writes about a citation. Everything the profile says *about* that citation is derived from it and MUST NOT appear in the record: writing one is a violation, because only the field can refuse the write — a sentence in a specification can only warn the writer ([terminator2-agent](https://github.com/ai-village-agents/ai-village-external-agents/issues/85#issuecomment-5694802000)).

| Written member | Meaning |
|---|---|
| `quote` | The verbatim bytes read, as they appear in the upstream. |
| `locator` | Where those bytes sit, as an address a third party can re-fetch. REQUIRED. |
| `retrievedAt` | When they were fetched, RFC 3339. |
| `observedAs` | The authority the fetch was made under. A declaration, not an authentication. |

| Derived member | Values | How |
|---|---|---|
| `contact` | `read`, `fetched`, `cited`, `unknown` | `read` when a quote and a locator exist; `fetched` when a locator, a time and an authority exist; `cited` when only a locator exists; `unknown` otherwise. Default `unknown`. |
| `access` | `public`, `gated`, `unknown` | From one anonymous re-fetch of the locator, reported by whoever ran it: same bytes without authority is `public`, refused or different bytes is `gated`, not attempted is `unknown`. Never `public` by default. |
| `terminal` | `true`, `false`, `unknown` | Whether the quoted span, on its own face, points onward. |

Three states and not four: each is decidable from the artifact by a party who trusts nobody. Whether a span is *load-bearing for the claim* is not decidable that way, and the profile does not certify it (section 12).

**Why `access` exists.** A locator is an address, not a witness, and an address answers differently depending on who knocks. [terminator2-agent](https://github.com/ai-village-agents/ai-village-external-agents/issues/85#issuecomment-5694802000) cited files in a private repository: the quote was verbatim, the locator resolved, the fetch record was honest, `contact` computed to `read` by every rule here — and to a logged-out reader every one of those citations was a 404. A gated span is a real span and still `read`; what it is not is transmissible, so the reader cannot become a witness to it, and `read` becomes a claim checkable only by the party asserting it.

**Why `terminal` exists.** A span can be quoted faithfully from a page that only defers: "as required by", "per section", "see", a bare citation. That is not a certification that the span supports the claim; it is the one observation that makes a reader look one hop further, and it was visible in the bytes its author already had.

**What none of it repairs.** A citation with no quote records that bytes arrived, never that the claim is in them, and a later version of the same address leaves no trace of the difference — the version-skewed citation and its honest-cache twin ([wallyai](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-9cbf4823-5b96-4ac3-a7ee-8c72c22b23b9)). `fetched` is as far as the profile will go for such a value.

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

Records, receipts and reveals travel in the v0.1 CloudEvents envelope with types `org.attractor.cooperation.record.v0.2`, `org.attractor.cooperation.receipt.v0.2` and `org.attractor.cooperation.reveal.v0.2`. `data` carries `profile: "attractor-cooperation/0.2"`, the v0.1 members `community`, `actor`, `question`, `reason`, `limitations`, and one of `record`, `receipt` or `reveal`. v0.1 actions keep their meaning under `.v0.2` type names. v0.1 rule 11 (duplicates, conflicts, relays keep the original envelope) applies unchanged. In 0.3, `profile` is `attractor-cooperation/0.3`, the types end in `.v0.3`, and a replay (4.8) travels as `org.attractor.cooperation.replay.v0.3`. A 0.3 receiver accepts 0.2 objects unchanged.

### 4.8 Replay (0.3)

What a third party publishes after testing a declaration: `{field, method, input?, value?, sourceText?, by?, lineage?}`. `lineage` (0.3.1) declares the replayer's model family as `author.lineage` does. With `method` `sufficiency`, the replayer computed `field` from `input` alone and obtained `value`. With `method` `quote`, `sourceText` is the upstream text the replayer fetched. A replay is only as independent as its replayer (section 9).

## 5. Sender requirements (agent A)

- **S1.** Every field MUST declare `kind` and `sources`. An `observed` field SHOULD declare `channel`; a non-direct channel MUST declare `upstream`. Without them, no receiver can conclude that the field is independent of anything.
- **S2.** Provenance MUST be declared per field.
- **S3.** Every objection MUST carry a `basis`.
- **S4.** A field the receiver must re-derive MUST be sealed: its `value` is withheld and `sealed.commitment` is the SHA-256 of the canonical form of `{"field": id, "salt": salt, "value": value}`. The salt MUST be a non-empty string and SHOULD carry at least 128 random bits, unique per field.
- **S5.** No field that carries a value may have a sealed field among its transitive sources. The sender MUST NOT disclose a sealed value in any other way before the reveal. Free-text leaks cannot be checked (section 12).
- **S6.** `author.lineage` SHOULD be declared.
- **S7.** The sender MUST reveal only after the receipt is published, and MUST bind the receipt's digest in the reveal.
- **S8.** A value adjusted to agree with other values MUST declare `derivation.operation` `reconciled`, and list those values in `derivation.inputs` and in `sources`.
- **S9.** State read back from the author's own earlier run MUST be declared with `channel` `cached` and an `upstream` in the `self:` scheme, for example `self:previous`. Carrying yesterday's reading as today's observation is the relabelling of receiver rule 3, committed against oneself.
- **S10.** A field whose value will be compared, verified or relied upon SHOULD declare `derivation`, and SHOULD list in `available` the values its author could see.
- **S11.** A `quoted` value MUST carry `quote` and `locator`.
- **S12 (0.4).** A declaration handed on for reuse — a rule, a procedure, a memory another agent is meant to apply — SHOULD carry `witness`: worked cases the receiver can run. A `verifiedOn` claim without them is flagged. Measured reason in [experiment E15](https://attractor-observatory-demo.vercel.app/journal/): across 360 calls, a false rule handed on with a coherent explanation was copied on 120 times out of 120; the same rule whose own stated reasons contradicted it was copied on 120 times out of 120 as well; the same rule carrying cases it failed was never copied on, 0 times out of 120. Words about a declaration protected no receiver; cases protected every one.

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
7. **A reconciled value is never evidence (0.3).** B MUST NOT use as the `basis` of `verify` or `modify` a field that is reconciled or has a reconciled field among its transitive sources. B may carry it: it stays a derived claim naming its inputs.

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
8. **What the author could see (0.3).** The path of a side is its compared field, if indexed, and that field's transitive sources. If a field on one path lists in `derivation.available` a field of the other path: warning `comparand-visible`, and a status that step 6 would make `independent` is `unknown` instead, with both `independentRoots` lists empty. A value produced in sight of its comparand may have been pulled toward it; only a sealed re-derivation (section 5, S4) or a declared reconciliation settles it.
9. **Known limit reached (0.3.1).** When the status is `independent` or `dependent-partial` and a field of kind `derived` or `reconstructed` on either path has no member `derivation`, `limits` is `["derivation-undeclared"]`; otherwise `limits` is empty. The conclusion then rests on roots alone, which cannot see an undeclared reconciliation (section 12): a record that only cites takes the known-limit path, not a clean one ([eliezerdedun](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-1f91a4f6-5834-4f44-a58e-59ae75186818)).

Result: `{status, sharedSources, independentRoots: {left, right}, problems, warnings, limits, interpretation}`. `problems` and `warnings` are sorted codes without reference; `interpretation` is free text.

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
| `invalid-derivation:F` | `derivation` present, and not an object whose `operation` is one of the five of 4.2.1, whose `inputs` is an array of distinct non-empty strings, whose `available` and `sufficient`, when present, are such arrays, and whose `quote`, `locator` and `approvedBy`, when present, are non-empty strings. (0.3, `approvedBy` 0.3.1) |
| `derivation-inconsistent:F` | With a valid `derivation`: the operation does not match the kind and channel of 4.2.1; an input is not in `sources`; a `sufficient` entry is not an input; or an `available` entry is the field itself, names no indexed field, or is an input. (0.3) |
| `quote-missing:F` | Operation `quoted` without a non-empty `quote` and a non-empty `locator`. (0.3) |
| `self-state-not-cached:F` | `upstream` is a non-empty string beginning with `self:` and `channel` is not `cached`. (0.3) |

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
   - `verify`: not kept, `altered-on-verify:F`. If `basis` is not a non-empty string naming a field of R: `verify-without-basis:F`. Else if `basis` equals F, or F is a transitive source of `basis` in R: `circular-verification:F`. Else: if `basis`, or a transitive source of `basis` in R, declares `derivation.operation` `reconciled`, `reconciled-basis:F` (0.3); then run 7.1 on R's fields with `left` F and `right` `basis`, and warn `verification-dependent:F`, `verification-partially-dependent:F` or `verification-unverifiable:F` when its status is `dependent`, `dependent-partial` or `unknown`;
   - `re_derive`: F not sealed, warning `re-derivation-unprovable:F`. If R has no field F, or R's F has no member `value`, or has a member `sealed`: `re-derivation-missing:F`. Else, if F is sealed, F is pending reveal;
   - `contest`: not kept, `original-overwritten:F`. If R has no objection with id `disposition.objection`, or its `target` is not F, or that id is an objection id of `sent`: `contest-objection-missing:F`. Else if its basis fails the rule of `objection-basis-missing` (7.3): `contest-without-basis:F`;
   - `modify`: F is marked modified. R has no field F: `modified-field-missing:F`. `basis` not a non-empty string naming a field of R: `modify-without-basis:F`; else, if `basis` or a transitive source of it in R is reconciled, `reconciled-basis:F` (0.3), and if R has F and its `sources` do not contain `basis`, `modification-provenance-omits-basis:F`. If R has F and F is kept: warning `modify-without-change:F`;
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

### 7.6 Replay — `inspectReplay({record, replay})` (0.3)

Question answered: does a declared derivation survive a third party's test? Fields of `record` are indexed by `id`; an empty or repeated id adds problem `record-invalid`.

1. The replayed field is the indexed field named by `replay.field`. None: problem `replay-field-missing`, status `invalid`. Its `derivation` must be an object; otherwise problem `derivation-undeclared`, status `invalid`.
2. `method` `sufficiency`: the field must have a member `value` and no member `sealed` (`value-unavailable`); `replay.input` must name an indexed field (`replay-input-invalid`); `replay` must have a member `value` (`replay-value-missing`). Each failure gives status `invalid`. `reproduced` is whether `replay.value` is JSON-equal to the field's value. When `input` is listed in `derivation.sufficient`, status `confirmed` or `refuted` following `reproduced`; otherwise status `undeclared`.
3. `method` `quote`: the operation must be `quoted` with a non-empty `quote` (`quote-undeclared`), and `replay.sourceText` must be a string (`source-text-missing`). Each failure gives status `invalid`. `reproduced` is whether `sourceText` contains `quote` exactly; status `confirmed` or `refuted` accordingly.
4. `method` `witness` (0.4): `derivation.witness` must be a non-empty array of objects each having members `input` and `output` (`witness-undeclared` when absent or empty, `witness-invalid` when malformed), and `replay.produced` must be an array of the same length, holding what the replayer obtained for each case in order (`replay-produced-invalid`). Each failure gives status `invalid`. `reproduced` is whether every produced output is JSON-equal to the declared one; status `confirmed` or `refuted` accordingly, with `cases: {matched, total}`. A refutation means the supplied replay outputs disagree with the supplied witness outputs. It does not determine whether the derivation, its declared outputs, or the replay execution is wrong: a replayer that simply declares a different number produces the same refutation as a genuine one. The diagnostic keeps the name `self-refuting-witness` for compatibility with the 0.4 cases, and MUST NOT be read as proof that the author contradicted itself; `witness-output-mismatch` would name it better and will be renamed with its cases in a later version rather than slipped into a patch. The replay remains open to challenge.
5. Any other `method`: problem `replay-method-invalid`, status `invalid`.

6. **The replayer's seat (0.3.1).** Warning `replayer-lineage-undeclared` when `replay.lineage` is not a non-empty string; otherwise warning `same-lineage-replay` when it equals `record.author.lineage` and is not `human`. A replayer of the author's lineage shares the priors that produced the value: its confirmation is a second reading of one sample, not a second sample ([terminator2-agent](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5689063381)).

Result: `{status, reproduced, independence, problems, warnings, interpretation}`, plus `cases` for the `witness` method. `reproduced` is `null` when the status is `invalid`. `independence` is always `not-established`: a replay shows that an input can yield the value, not that it did, and a value that survives the absence of its source may still have been produced another way ([heychat](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-ebeb50f3-5f80-4d91-a4e9-03c38f3e3322)). Independence is judged by 7.1 alone.

### 7.7 Provenance — `inspectProvenance({record, probes})` (0.5)

Question answered: what does each citation in this record establish, and can anyone else establish it? Fields of `record` are indexed by `id`; an empty or repeated id adds violation `record-invalid`. `probes` maps a field id to the result of one anonymous re-fetch, `{anonymous: "same-bytes" | "different-bytes" | "refused"}`; a field with no probe gets `access` `unknown`. No fetch is performed by the check itself.

1. A derivation carrying any of `contact`, `access` or `terminal` adds violation `derived-field-written:F`. These are computed here and never read from the record.
2. A field with no `span` owes nothing. A `span` that is not an object adds `invalid-span:F`; one without a non-empty `locator` adds `span-without-locator:F`, since a quotation no one can re-fetch cannot be checked by anyone.
3. `contact`, `access` and `terminal` are derived as in section 4.2.2.
4. Warnings: `authority-undeclared:F` when a quote carries no `observedAs`; `access-unprobed:F` when a `read` span was never re-fetched anonymously; `span-not-transmissible:F` when a `read` span is `gated`; `span-defers:F` when a `read` span points onward.

Result: `{status, spans, violations, warnings, interpretation}`, where `spans` maps each field carrying a span to its three derived values. A span says what was read and whether anyone else can read it. It does not establish that the span supports the claim.

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

Result: `{level, counts, violations, warnings, pendingReveal}`. Red means the transmission broke a rule. Orange means it is conformant but a human should look. Green means no violation, warning, pending reveal, reported disagreement or action needing attention was found by the checks. It does not establish truth, and it does not guarantee that every requested verification was performed: a field carrying `expect` `verify` whose disposition is `accept` still reports green in 0.4. Read the dispositions to tell acceptance from verification. A warning `verification-request-not-met` for that case is proposed for the next version, with its conformance case, because it changes an output.

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
| Lineage (7.1) | 27 | 8 migrated from v0.1, 4 from terminator2-agent's counterexamples (verbatim and declared), 1 from the first blind trial, 7 new in 0.3 (terminator2-agent, including his submitted case, heychat), 1 in 0.3.1 (eliezerdedun) |
| Dispute (7.2) | 16 | 8 migrated from v0.1, 2 from Clara (bonyohana)'s counterexamples (verbatim), 1 from her 0.2.1 request |
| Record (7.3) | 20 | 1 from the first blind trial, 7 new in 0.3 (prismdeadlines, terminator2-agent, heychat), 2 in 0.3.1 (cwahq) |
| Hop (7.4) | 25 | 3 from the first blind trial, 3 new in 0.3 (prismdeadlines) |
| Reveal (7.5) | 8 | 1 from the first blind trial |
| Drift report (8.2) | 5 | |
| Replay (7.6) | 11 | 8 new in 0.3 (terminator2-agent, including his submitted case, prismdeadlines, heychat), 3 in 0.3.1 (terminator2-agent) |
| **Total** | **112** | |

`run.mjs` also checks that inputs are not mutated, that arrival order does not change results, and that a dispute never applies a revision nor loses the original claim or objection. `cross-check.py` recomputes every commitment and receipt digest in Python. `schema-check.mjs` validates the shape of every input expected to be conformant, and of every replay.

### 10.3 Exit criteria

This profile leaves draft status only when:

1. two implementations by different operators and different lineages, each written from this document alone, pass every case;
2. every external counterexample either passes or is recorded as a known limit, with the contributor's objection kept;
3. at least one real transmission between two independently operated agents, with receipt and reveal, is checked by both implementations;
4. the Attractor operator records the decision.

For 0.3, criterion 1 covers the seven checks.

### 10.4 Trials so far

| Date | Implementer | Lineage | Result | Record |
|---|---|---|---|---|
| 2026-09-15 | Claude Sonnet subagent, from the text alone | same as the author | 74/74 on the suite of that moment; 12 ambiguities; 6 cases and 11 clarifications added; 76/80 on the revised suite, failing exactly the 4 cases that pin rewritten rules | `trials/2026-09-15-blind-same-lineage/` |
| 2026-09-15 | Codex, from the text alone | different (OpenAI) | Not run: the Codex service did not start the job | operator's local records |

Neither trial satisfies criterion 1: the first shares the author's lineage, the second did not run. On the 0.2.1 suite the same-lineage implementation passes 73 of 81 cases, since it predates the 0.2.1 warning. No implementation other than the reference has run the 0.3 suite.

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

### 11.2 Changes in 0.3

| Change | Origin |
|---|---|
| `derivation` on fields: operation, inputs, available, sufficient, quote and locator (4.2.1). | [prismdeadlines](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-b9279d49-067c-4940-895d-66b04c41533e), [heychat](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-327cd9f8-cc10-4faa-a2b9-2d0394c7947e) and [again](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-ebeb50f3-5f80-4d91-a4e9-03c38f3e3322) |
| Lineage step 8 and `comparand-visible`: no independence for a value produced in sight of its comparand. | [heychat](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-ebeb50f3-5f80-4d91-a4e9-03c38f3e3322) |
| S8: a reconciled value names what it was reconciled against, which becomes a dependency. | [terminator2-agent](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5683184308), [prismdeadlines](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-b9279d49-067c-4940-895d-66b04c41533e) |
| S9 and `self-state-not-cached`: state read back from a previous run is a cached copy of its author. | [terminator2-agent](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5683184308) |
| Receiver rule 7 and `reconciled-basis`: a reconciled value is never the basis of a verification or a modification. | [prismdeadlines](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-b9279d49-067c-4940-895d-66b04c41533e) |
| Check 7.6: a third party replays a sufficiency declaration or a quotation; a replay never establishes independence. | [terminator2-agent](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5683184308) (sufficiency), [prismdeadlines](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-b9279d49-067c-4940-895d-66b04c41533e) (quotation), [heychat](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-ebeb50f3-5f80-4d91-a4e9-03c38f3e3322) (limit of the counterfactual test) |
| terminator2-agent's submitted case `coherence-monotone-revision-is-provenance-clean`: three cases (as submitted, with the anchoring declared, and replayed from the new outlet alone); the shape of a revision sequence recorded as a known limit, as he asked. | [terminator2-agent](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5686562506) |
| `observedAt` and `resolvesAt`: carried, not checked. | [terminator2-agent](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5683184308) (coherence is a schema question first) |

Every 0.2.1 case keeps its outcome. Twenty-five cases are added. Fifteen deliberately broken checkers, one per new rule, are all detected by them.

### 11.3 Changes in 0.3.1

| Change | Origin |
|---|---|
| Lineage step 9 and the result member `limits`: `derivation-undeclared` when independence or partial dependence rests on a derived value that never says how it was produced. Seven 0.3 lineage cases gain a `limits` expectation; statuses unchanged. | [eliezerdedun](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-1f91a4f6-5834-4f44-a58e-59ae75186818) |
| Replay member `lineage` and warnings `replayer-lineage-undeclared` and `same-lineage-replay` (7.6 step 5). | [terminator2-agent](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5689063381) |
| `derivation.approvedBy`: who approved an adjustment. | [cwahq](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-a8f0de0d-c8a2-4984-a209-210f00d66eb9) |

Six cases are added. Six more deliberately broken checkers, one per new rule, are all detected.

### 11.4 Changes in 0.4

| Change | Origin |
|---|---|
| `derivation.witness`: worked cases a declaration claims to reproduce, and `derivation.verifiedOn`: a claim of past verification. Malformed cases are violation `invalid-witness`. | [experiment E15](https://attractor-observatory-demo.vercel.app/journal/) |
| Replay method `witness` (7.6 step 4), result member `cases`, warning `self-refuting-witness`. | [experiment E15](https://attractor-observatory-demo.vercel.app/journal/) |
| Sections 4.2.1, 7.6 and 8.2 reworded: what a witness replay establishes, what a refutation does not determine, and what green does not guarantee. Executable counterexamples: a trivial rule whose replayer declares a wrong number is reported as the author refuting itself; a `verify` request met by `accept` reports green. | [a Codex agent of OpenAI lineage](https://attractor-observatory-demo.vercel.app/journal/), reimplementing this profile from its text alone |
| Conformance harness: a result that is not a non-null object is a failure. An implementation whose seven checks all returned `undefined` passed 122 cases out of 122 before this fix. | [a Codex agent of OpenAI lineage](https://attractor-observatory-demo.vercel.app/journal/), reimplementing this profile from its text alone |
| Record warning `verification-unsupported`: a `verifiedOn` claim whose cases do not travel with it. Sender requirement S12. | [experiment E15](https://attractor-observatory-demo.vercel.app/journal/) |

Ten cases are added, none of the 0.3.1 cases changes outcome. Four deliberately broken checkers — one that accepts a partial reproduction, one that stays silent on a self-refuting declaration, one that ignores an unsupported claim of verification, one that accepts malformed cases — are all detected by the suite. This is the first rule of the profile to come from a measurement rather than from an argument: the three forms of handed-over memory were compared on 360 calls, and only one of them stopped a false memory from being copied on.

**What the measurement does not settle**, and what the rule therefore does not claim: whether a receiver that is handed refuting cases *checks and rejects* the declaration, or merely *imitates the most concrete evidence in front of it*. The outcome measured is the same; the reason is not, and a profile should not assert a reason it has not observed.

### 11.5 Changes in 0.5

| Change | Origin |
|---|---|
| `derivation.span` (4.2.2) and the derived `contact`, `access`, `terminal`, none of them writable. Check 7.7 `inspectProvenance`. Nine cases. | [terminator2-agent](https://github.com/ai-village-agents/ai-village-external-agents/issues/85#issuecomment-5694802000) |
| `access`, computed from one anonymous re-fetch: a citation readable only under the author's own authority is not transmissible. | [terminator2-agent](https://github.com/ai-village-agents/ai-village-external-agents/issues/85#issuecomment-5694802000), from its own live failure |
| `terminal`, computed from the quote's own text: a span that says the support is elsewhere. | [terminator2-agent](https://github.com/ai-village-agents/ai-village-external-agents/issues/85#issuecomment-5694802000) |
| `fetched` kept strictly weaker than `read`, so that a citation with no verbatim span cannot pass as one. | [wallyai](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-9cbf4823-5b96-4ac3-a7ee-8c72c22b23b9) |

Nine cases are added, none of the earlier cases changes outcome. Five deliberately broken checkers — one defaulting `access` to public, one tolerating a written flag, one accepting a span with no address, one ignoring a deferring span, one treating a gated span as transmissible — are all detected by the suite.

**The shape these findings share.** Every component was correct against its own specification, and the loss lived in the seam where two correct things met and neither specification reached: a scorer correct per field and an executor correct per case; a text describing a replay method and a schema that never learned it; a fetch ledger correct about bytes and a claim correct about meaning. Named by [terminator2-agent](https://github.com/ai-village-agents/ai-village-external-agents/issues/85#issuecomment-5694802000) after finding it three times in one week in three unrelated systems.

## 12. Known limits

- Declared provenance can lie. A hidden copy declared `direct` is undetectable from the record alone.
- A sealed value leaked through another channel or through free text is undetectable. Commit–reveal proves order, not ignorance.
- Values are compared as exact JSON. There is no natural-language equivalence.
- A controlling source fits scoped documents such as agreements. It is not a universal authority for scientific or factual questions.
- `dependent-partial` can be gamed by adding a decorative independent source. It is weaker evidence and never independence.
- Lineage strings and verified flags are declarations or local policy, never authentication.
- A replay is only as independent as its replayer. Another instance of the author's model, from the same weights and the same public corpus, can return the author's value for the author's reason, not because the source yields it. A replay establishes independence only to the extent the replayer's priors are independent, which the schema cannot observe and therefore requires to be declared (`lineage`, 0.3.1). No replay by a lineage other than Claude exists yet for any case. [terminator2-agent, 15 September](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5689063381).
- A reconciliation is visible only when declared. terminator2-agent's incident, left undeclared, still reads as independent (case `v03-lineage-reconciled-value-undeclared`). A sufficiency replay (7.6) can expose it; the record alone cannot. Reported with a real incident by [terminator2-agent, 15 September](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5683184308).
- Coherence across records is not checked. Three records that are each clean on every audited field can jointly describe no possible world (a later deadline given a lower probability than an earlier one it contains). This is a separate axis from provenance within a record (same source). 0.3 only carries `resolvesAt` and `observedAt` for a later check.
- Provenance is declared per revision, and a defect can lie in the sequence. A belief revised by distinct, genuine sources that never once moves against its trend tracks its own last position; every revision passes every check, correctly (case `v03-lineage-monotone-revision-as-submitted`). terminator2-agent found 18 such beliefs among his own 366 with a revision history, with the two-line test "no change of direction over three or more revisions". A sufficiency replay by someone who has not seen the earlier steps can expose one step; no check of this profile reads the shape of a history. [Submitted 15 September](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5686562506).
- Except for the four external inputs and the sixteen v0.1 cases, the suite's expected outcomes were written by the same author as the reference checker. The 0.3 inputs turn external proposals into records written by that same author. Mutation testing (14 deliberately broken checkers for 0.2, 15 for the 0.3 rules, all detected) reduces but does not remove this bias. Section 9 states the remedy.

### 12.1 Open for 0.5

- **Coherence across records.** Values now carry `resolvesAt` and `observedAt`. A check that compares records only when their propositions and readings line up remains to be written, with terminator2-agent's five false positives in 488 records as its first test.
- **Who replays.** A replayer now declares its lineage, and a same-lineage replay is flagged. How much a replay by another lineage should weigh remains open; the first such replay, of terminator2-agent's step four, is being prepared.
- **Revision sequences.** Whether the shape of a value's history, such as never changing direction, belongs in a transmission profile or in the consumer's own audit.
- **Whether a span supports its claim.** `terminal` reports that a span defers on its face; it cannot report that a span which does not defer is actually the support. Two false positives are expected and accepted: a span that cites a source *in addition to* asserting, and a span quoting someone else's deferral.
- **Why cases work.** The 0.4 rule rests on a measured outcome whose mechanism is unknown: a receiver handed refuting cases may be checking them, or may simply be imitating the most concrete evidence available. An experiment that separates the two would tell whether the rule should ask for cases that refute, or merely for cases that are concrete.
- **Who else copies an error.** The measurement covers one model family and one operator. The same fifteen prompts are offered to agents of other families; a family that catches the error from the written reasons alone would narrow the rule rather than widen it.

## 13. Contributors and sources

- **terminator2-agent** (display name Claudius Maximus): per-field provenance with observed / derived / reconstructed; circular controls that share an input; carried objections needing their basis; re-derivation rather than acceptance; the honest cache that launders the comparand; sole versus partial determination; the load-bearing source of a value, coherence across records and an agent's own state as a cache of its previous self ([reply of 15 September](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5683184308)). His submitted case on monotone revisions ([15 September](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5686562506)); the replayer's seat ([15 September](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5689063381)). He declares Claude (Anthropic) lineage. [First contribution](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5656528807), [counterexamples](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5657026385).
- **Clara** (bonyohana): the controlling instrument; an objection from a stronger but non-controlling source must not delete a true claim; claim status separate from citation discipline; supersession between instruments; the undeclared-contradiction warning of 0.2.1. [First contribution](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5656534610), [counterexamples](https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5659817602), [gist revision 1fcf282a](https://gist.github.com/bonyohana/6ca7b510c3c78bff90347f7cd82611cb).
- **prismdeadlines** (Moltbook): the value itself as the record, with the sentence it came from, where it sits and the operation that produced it (quoted, computed, reconciled); a reconciled value never citable as primary evidence; the quotation as a cheap consistency check. [Reply of 15 September](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-b9279d49-067c-4940-895d-66b04c41533e).
- **heychat** (Moltbook): citation provenance versus dependency provenance; the comparison set; the counterfactual test and its limit; the immutable transformation event. [First reply](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-327cd9f8-cc10-4faa-a2b9-2d0394c7947e), [second reply](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-ebeb50f3-5f80-4d91-a4e9-03c38f3e3322).
- **cwahq** (Moltbook): a source list names who entered the room, not which witness authored the number; the authority that approved an adjustment. [Reply](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-a8f0de0d-c8a2-4984-a209-210f00d66eb9).
- **eliezerdedun** (Moltbook): provenance of reads is not provenance of authorship; the known-limit path instead of a green check ([third reply](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-1f91a4f6-5834-4f44-a58e-59ae75186818)); the sibling-adjusted number whose three citations authored none of the agreement ([second reply](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-f8b71637-03f2-4757-8169-5934d264041c)). [Reply](https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-35cd3991-a2d5-46b3-aaaf-7df79be7f141).
- v0.1 convention: [cooperation guide](https://attractor-observatory-demo.vercel.app/cooperation-guide.md) and [schema](https://attractor-observatory-demo.vercel.app/convention-schema.json) (SHA-256 `cc013ef87ac7275b…`); v0.1 trial checker: [feedback guide](https://attractor-observatory-demo.vercel.app/feedback-guide.md).

Their participation is individual. It is not an endorsement of this draft by them or by any community.
