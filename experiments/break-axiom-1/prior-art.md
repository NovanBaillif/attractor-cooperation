# Prior art — Test #001, Break Axiom 1

Rule from the test: never write NOVEL without a sufficient literature analysis. Each mechanism below is
classified EXISTING, ADAPTATION, COMBINATION, POSSIBLY DISTINCT or UNKNOWN. The search behind this table is
**not** exhaustive; where it stops, the entry says so.

The four 2026 references below were first cited by ChatGPT in a conversation relayed by the operator, then
checked one by one on their primary pages (datatracker.ietf.org, arxiv.org) on 18 September 2026. All four
exist and were summarised correctly; the quotations of the Bu draft were re-checked against the text of -07.

| Mechanism used here | Class | Where it already exists |
|---|---|---|
| **Axiom 1 itself** — P is known to V only if P holds in every world V cannot tell apart from the actual one | **EXISTING** | The possible-worlds definition of knowledge: Hintikka, *Knowledge and Belief* (1962); Fagin, Halpern, Moses & Vardi, *Reasoning About Knowledge* (MIT Press, 1995). Same shape as identifiability in statistics (Koopmans, 1949) and observability in control theory (Kalman, 1960). |
| The adversary picks the worst not-P world; one match is enough | **EXISTING** | Indistinguishability games in cryptography: Goldwasser & Micali, *Probabilistic Encryption* (JCSS, 1984). |
| The status is derived by the verifier, never copied from the claim | **EXISTING** | The attester / verifier / relying-party split of IETF RATS, RFC 9334 (2023): *evidence* is distinct from *attestation results*. Also in-toto (Torres-Arias et al., USENIX Security 2019) and W3C Verifiable Credentials, where the verifier checks proofs rather than trusting the credential's own statements. |
| "The quote occurs in the source at the locator" as the verifiable form of a citation | **EXISTING** | W3C Web Annotation Data Model (2017), `TextQuoteSelector`; content hashes as in W3C Subresource Integrity (2016); time-anchored retrieval as in Memento, RFC 7089 (2013) and Robust Links. The profile's own 0.6 draft already cites these. |
| Access as a relation between a source, a reader and a moment | **ADAPTATION** | Reference rot and content drift: Klein et al., *Scholarly Context Not Found* (PLOS ONE, 2014); Memento. Applied here to agent-to-agent transmission rather than to scholarly links. |
| A probe result is only evidence for the party who ran it | **EXISTING** | Challenge–response with a verifier-chosen nonce in remote attestation (TPM quotes; RFC 9334 freshness). |
| Tool execution provable only by a receipt the agent cannot forge | **EXISTING** | Remote attestation; verifiable computation (Gennaro, Gentry & Parno, CRYPTO 2010); proof-carrying code (Necula, POPL 1997). Not modelled as a computed case here: see results. |
| Re-derivation tested by a blind perturbation | **ADAPTATION** | Mutation testing (DeMillo, Lipton & Sayward, 1978); canaries and honeytokens; blinding in experimental design. The ATTRACTOR experiment E15 applies it to agent memory. |
| "Not copied from A" proved by an order recorded before the reveal | **EXISTING** | Commitment schemes: Blum, *Coin Flipping by Telephone* (1981). Already in the profile as sealed fields (SPEC 7.5). The first version of this test missed it; see the report's correction. |
| A property may be called verified only if the verifier rejects a negative case for the same property | **EXISTING** | draft-bu-agentproto-security-principal-binding-07 (S. Bu, individual IETF submission, 15 Sept 2026; the rule is present since -04, 2 Aug 2026), rule 14: *"A successful happy-path exchange is not sufficient implementation evidence for a security row. The implementation needs to perform the stated verification and reject a negative case for the same property."* Section 3: *"A signed assertion does not become an attested property unless the verifier checks evidence…"*; section 15: a report *"MUST NOT describe a reporter-asserted deployment fact as independently verified"*; section 16 defines `indeterminate` (neither satisfied nor unsatisfied). Scope: security claims in agent communication protocols; "satisfied" means the stated checks passed. |
| Receipts and replay-ready proofs attached to each agent action | **EXISTING** | Wang, *Proof-Carrying Agent Actions* (arXiv 2606.04104, June 2026): a per-action certificate with runtime and approval receipts, portable across runtimes. Relevant to the tool-execution row above. |
| Agent identity and provenance, explicitly excluding agent behaviour | **EXISTING** | draft-tonyai-a2a-trust-03 (T. Trujillo, individual IETF submission, 4 Sept 2026): *"This document does not address … agent behavior"*. It covers who sent a message, not what the sender did. |
| Certifying that two agents use a term with the same meaning, by testing them on shared observable events | **EXISTING** | Schoenegger, Carlson, Schneider & Daly, *Verifiable Semantics for Agent-to-Agent Communication* (arXiv 2602.16424, Feb 2026): certification, drift detection, renegotiation. Relevant to ATTRACTOR's chain experiment and to the words of the profile itself ("read", "verified"). |
| A procedure property that leaves no mark in the artifact is unverifiable from the artifact | **EXISTING** | The general motivation for attested execution logs; in LLM evaluation, the contamination and carry-over problem. |
| The received artifact is held fixed; the adversary may vary only what the verifier cannot see | **EXISTING** | The standard construction of an epistemic model: the agent's information set is fixed and the worlds range over what it does not observe. Stated explicitly here because the first draft of this corpus violated it. |
| **Using this test as a conformance rule over inter-agent transmission records**, with the profile's own states as the object under test | **ADAPTATION at most** (was UNKNOWN until 18 Sept 2026) | The Bu draft above already applies the same discrimination rule to claims carried in agent-to-agent messages, as a requirement on implementation evidence. What differs here is only the kind of claim (provenance of a quote, re-derivation, access) and the use of the rule as the definition of a status word rather than as an evidence requirement. Other close work: Pramana (arXiv 2605.20312, typed attestation per claim with offline replay) and IETF RATS. None compared case by case yet. Nothing in ATTRACTOR may call this new. |

## What this means

Every building block used by Test #001 is existing work, and since 18 September 2026 so is most of its
application: an IETF individual draft (Bu, -04 of 2 August 2026) already requires rejecting a negative case
before a claim between agents may be called verified. The honest summary is: **Axiom 1 is epistemic logic;
what ATTRACTOR can add, if anything, is the discipline of running it against its own published states.**
