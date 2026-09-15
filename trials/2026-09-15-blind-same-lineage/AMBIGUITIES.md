# Ambiguities found in SPEC.md

Written while implementing `impl.mjs` from `SPEC.md` and
`schema/transmission.schema.json` alone. For each item: the section, the
problem, and the literal reading I chose.

## 1. Section 7 (preamble) vs. 7.4 step 2 / 7.5 step 3: order-independence contradicts "the first one counts"

Section 7's preamble states results "MUST NOT depend on the order of
`fields`, `sources`, `objections`, `dispositions` or `reveals`." But 7.4
step 2 says of duplicate dispositions for the same field reference: "A
second disposition for the same field: `duplicate-disposition:ref`; the
first one counts" — and 7.5 step 3 says the same of duplicate reveal
items ("the first one counts"). If the two duplicates differ in content
(e.g. one `accept`, one `drop`), which one "counts" necessarily depends
on array order, directly contradicting the general rule.

**Reading chosen:** I followed the specific, operative instruction
literally — "first one counts" uses the literal array order of
`receipt.dispositions` / `reveal.reveals` as given. The general
order-independence rule is satisfied for every other array (`fields`,
`sources`, `objections`), and is only overridden here where the spec
itself names an explicit tie-break.

## 2. Section 7.1 step 1: are duplicate/invalid field ids excluded entirely, or does "the first" get indexed?

Step 1 says a field "repeats an indexed id" is "not indexed" — phrased as
a sequential process, which (like #1 above) would make the *choice* of
which duplicate wins order-dependent, again in tension with the
preamble.

**Reading chosen:** every occurrence of a duplicated (or invalid) id is
excluded from the index — no occurrence "wins". This is order-independent
by construction, and it does not change any final result because any
`missing-or-duplicate-field-id` problem already forces the whole
`inspectLineage`/`inspectHop` field-graph outcome to its "everything
empty" branch (7.1 step 4) or is itself a bare violation in 7.3/7.4, so
which specific duplicate would otherwise have been indexed is moot. Used
identically for objections (7.3, 7.4) and record ids.

## 3. Section 7.1 step 4: scope of "if there is any problem"

Step 4 says "If there is any problem: status `unknown`, ...". It's not
fully explicit whether "any problem" means only problems hit while
tracing roots from `left`/`right` (step 2), or also (a) field-indexing
problems from step 1 over the *entire* `fields` array (including fields
unrelated to the comparison), and (b) the per-root `invalid-upstream` /
`invalid-channel` problems raised in step 3.

**Reading chosen:** the broadest literal reading — `problems` is one
running set accumulated across steps 1, 2 and 3 of the whole
computation, and step 4 fires on any non-empty set, mattering practically
even for unrelated fields elsewhere in the same `fields` array.

## 4. Section 7.1: "interpretation" and 7.2: "reason" are unconstrained free text

Both are explicitly "free text" with no vocabulary given. I wrote short,
deterministic, literal-English explanations tied to each status/branch.
There is no way to know whether a hidden reference checker expects
specific wording, since `reference/index.mjs` was withheld from me.

## 5. Section 7.2: "equal"/"equals" vs. "JSON-equal"

Section 4.6/7.2 uses bare "equal(s)" for id/domain/version/`supersedes`
comparisons, not the capitalized "JSON-equal" term section 2 defines.
**Reading chosen:** I applied the general JSON-equal definition (section
2) uniformly everywhere the spec compares two JSON values, including
these, for consistency and because it is a strict superset of string
equality for the plain-string case that dominates in practice.

## 6. `jsonEqual` when a value has no canonical form

Section 3.2 says "a check that needs [a canonical form] fails as
specified" for the specific checks that build hashes (7.5). It does not
say what "JSON-equal" (section 2, used pervasively) should return when
one or both operands cannot be canonicalized at all (e.g. contain
`undefined`, a function, or a reference cycle — none of which should
appear in conformant JSON-sourced input, but nothing forbids a malformed
test input from containing them).

**Reading chosen:** treat such values as not JSON-equal to anything,
including another equally non-canonicalizable value. Documented here
since it is not spelled out.

## 7. Section 7.3 `sealed-value-leak:F` / `source-cycle`: transitive closure over a cyclic graph

"Transitive sources are computed over indexed fields, following `sources`
arrays and ignoring ids that name no field" does not say what a
"transitive closure" means when the graph contains a cycle (which is
itself a separate violation, `source-cycle`). My closure computation
memoizes per field and breaks a cycle by contributing no further edges at
the point of re-entry; this is enough to always correctly detect *that* a
cycle exists (the bare `source-cycle` violation is order-independent and
correct in every case tested), but the exact *set* of
`sealed-value-leak:F` codes for fields inside a cyclic subgraph can
depend on field array order in pathological cyclic+sealed combinations.
This never changes conformant/non-conformant status, since any cycle
already makes the record non-conformant via `source-cycle`.

## 8. Section 7.3 `invalid-channel:F` is gated on `kind === 'observed'`, asymmetrically with 7.1

7.3's table says "An **observed** field has a `channel` outside the four
values" — literally gated on `kind`. Section 7.1 step 3, by contrast,
checks every *root* reached (which are always observed by construction)
without ever mentioning kind. I implemented 7.3's check exactly as
worded: a non-observed field with a malformed `channel` value produces no
7.3 violation at all (channel is simply meaningless/unchecked outside
`observed`). This looked intentional (channel/upstream are only defined
for `observed` fields per 4.2) rather than an oversight, so I did not
generalize it.

## 9. Defensive defaults for malformed/absent top-level shapes

The spec assumes reasonably well-shaped inputs (`fields` is an array,
`receipt.record` is an object, etc.) but does not specify behaviour for
every possible malformed top-level input (e.g. `record` itself not an
object, `sources`/`dispositions`/`reveals` not arrays,
`receipt.record` absent or not an object, `comparison` absent). I treated
every such case defensively and uniformly: a missing/malformed collection
is treated as empty (`[]`), a missing/malformed nested object as `{}` —
which then naturally produces the corresponding `missing-*`/`invalid-*`
diagnostics from the rest of the algorithm rather than throwing.

## 10. `driftReport`'s "when a reveal is given"

8.2 says pendingReveal/counts differ "when a reveal is given". I treat
"given" as: the input object's `reveal` property is anything other than
`undefined` (so an explicit `null` or a malformed object still counts as
"given" and is passed through to `inspectReveal`, which will then likely
report violations rather than being silently skipped).

## 11. 7.4 step 6: "every counted disposition `accept` or `verify`"

"Counted" is defined at the `counts[action]++` point (right after the
action is validated as one of the six), which happens *before* the
sealed-field check that can later `continue` past an `accept`/`verify`
wrongly used on a sealed field (`sealed-field-not-re-derived:F`). I
included such rejected-but-counted dispositions in the step 6
ancestor-modified scan, since nothing in step 6 restricts it to
dispositions that additionally passed the sealed-field check.

## 12. 7.5 step 4: independent of 7.4's disposition de-duplication

`inspectReveal` is specified as a standalone pure function over
`{sent, receipt, reveal}`; nothing ties its reading of
`receipt.dispositions` to `inspectHop`'s own "first one counts"
disposition indexing. I scan `receipt.dispositions` directly and
independently for `re_derive` actions on a sealed field of `sent`,
de-duplicating only the resulting *field id* set (via `Set`), not
picking a single "first" disposition object per field the way 7.4 does.
