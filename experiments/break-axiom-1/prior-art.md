# Prior art — Test #001, Break Axiom 1

Rule from the test: never write NOVEL without a sufficient literature analysis. Each mechanism below is
classified EXISTING, ADAPTATION, COMBINATION, POSSIBLY DISTINCT or UNKNOWN. The search behind this table is
**not** exhaustive; where it stops, the entry says so.

| Mechanism used here | Class | Where it already exists |
|---|---|---|
| **Axiom 1 itself** — P is known to V only if P holds in every world V cannot tell apart from the actual one | **EXISTING** | The possible-worlds definition of knowledge: Hintikka, *Knowledge and Belief* (1962); Fagin, Halpern, Moses & Vardi, *Reasoning About Knowledge* (MIT Press, 1995). Same shape as identifiability in statistics (Koopmans, 1949) and observability in control theory (Kalman, 1960). |
| The adversary picks the worst not-P world; one match is enough | **EXISTING** | Indistinguishability games in cryptography: Goldwasser & Micali, *Probabilistic Encryption* (JCSS, 1984). |
| The status is derived by the verifier, never copied from the claim | **EXISTING** | The attester / verifier / relying-party split of IETF RATS, RFC 9334 (2023): *evidence* is distinct from *attestation results*. Also in-toto (Torres-Arias et al., USENIX Security 2019) and W3C Verifiable Credentials, where the verifier checks proofs rather than trusting the credential's own statements. |
| "The quote occurs in the source at the locator" as the verifiable form of a citation | **EXISTING** | W3C Web Annotation Data Model (2017), `TextQuoteSelector`; content hashes as in W3C Subresource Integrity (2016); time-anchored retrieval as in Memento, RFC 7089 (2013) and Robust Links. The profile's own 0.6 draft already cites these. |
| Access as a relation between a source, a reader and a moment | **ADAPTATION** | Reference rot and content drift: Klein et al., *Scholarly Context Not Found* (PLOS ONE, 2014); Memento. Applied here to agent-to-agent transmission rather than to scholarly links. |
| A probe result is only evidence for the party who ran it | **EXISTING** | Challenge–response with a verifier-chosen nonce in remote attestation (TPM quotes; RFC 9334 freshness). |
| Tool execution provable only by a receipt the agent cannot forge | **EXISTING** | Remote attestation; verifiable computation (Gennaro, Gentry & Parno, CRYPTO 2010); proof-carrying code (Necula, POPL 1997). Not modelled as a computed case here: see results. |
| Re-derivation testable only under a blind perturbation | **ADAPTATION** | Mutation testing (DeMillo, Lipton & Sayward, 1978); canaries and honeytokens; blinding in experimental design. The ATTRACTOR experiment E15 applies it to agent memory. |
| A procedure property that leaves no mark in the artifact is unverifiable from the artifact | **EXISTING** | The general motivation for attested execution logs; in LLM evaluation, the contamination and carry-over problem. |
| The received artifact is held fixed; the adversary may vary only what the verifier cannot see | **EXISTING** | The standard construction of an epistemic model: the agent's information set is fixed and the worlds range over what it does not observe. Stated explicitly here because the first draft of this corpus violated it. |
| **Using this test as a conformance rule over inter-agent transmission records**, with the profile's own states as the object under test | **UNKNOWN** | Closest known work: Pramana (arXiv 2605.20312, typed attestation per claim with offline replay) and IETF RATS. Neither has been compared case by case against this corpus. Until that comparison exists, this row stays UNKNOWN and nothing in ATTRACTOR may call it new. |

## What this means

Every building block used by Test #001 is existing work. The only candidate for a contribution is the
last row — the application — and it is not established. The honest summary is: **Axiom 1 is epistemic logic;
what ATTRACTOR can add, if anything, is the discipline of running it against its own published states.**
