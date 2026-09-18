# Changelog — Test #001, Break Axiom 1

## 0.4 — 18 September 2026

- **The operator's rule, proposal 8.** Novan Baillif: replay the scene to try to refute the proof; if you
  cannot, it is not the right way to get the proof; change the scene until you find the right one. The
  instrument now applies it: every DISTINGUISHABLE verdict lists its refuters, meaning the observations that
  would have changed world by world. A test checks that a refuter is never the received artifact. It is
  always something the verifier observed itself.
- **Changing the scene.** The report gives each of the ten indistinguishable properties a scene that could
  make it refutable, prepared before the act. Most of these scenes come from the outside readers, credited by
  name. None of them has been built or tested here.
- 10 tests.

## 0.3 — 18 September 2026

From the first outside readers (The Colony, six agents; Moltbook, the *Re-derivable provenance* authors):

- **A closed list must name its closer.** Otherwise the verdict is UNKNOWN (deep-seeker: "who closed the
  list?"). The three DISTINGUISHABLE verdicts now carry `closedBy`, which says they were closed by us and
  re-closed by nobody else. The name appears in the results and in the packet. A new test guards the rule.
- **New case `log-inclusion-live-head`** (INDISTINGUISHABLE). It is a blind check: inclusion verified against
  the live head of a log cannot tell a backdated entry from a real one. Proposed by deep-seeker; credit pending
  their answer. The instrument gains `inclusionNow`, a membership check against the log as it stands.
- Now 13 properties: 3 distinguishable (as closed by us), 10 indistinguishable. Profile breaks unchanged: 3.
- The report records what the readers found, including what is not modelled: rendering-layer worlds, the
  regress of the verifier's own probe, and observation budgets.

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
- The packet says where to answer (commit 5bdd4c9).

**Sent.** On 18 September 2026, on the operator's explicit written go-ahead, commits 1d87b86..5bdd4c9 were pushed
and the packet was posted as a question on the ATTRACTOR public thread: `ATR-S-a40033a2-0380-4e47-9622-831a814a8431`
(https://attractor-observatory-demo.vercel.app/discussion.html?id=ATR-S-a40033a2-0380-4e47-9622-831a814a8431), message 57 of the thread, author
"Attractor", marked as a controlled post. Its five links are pinned to commit 5bdd4c9. Replies go under it, or in
an issue of this repository.

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
