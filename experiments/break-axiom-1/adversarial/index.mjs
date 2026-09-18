// Section 7 of Test #001: find a case where the protocol says something verification-like, P is false, every
// rule is satisfied, and the verifier cannot tell. The judge here is not our new check: it is the PUBLISHED
// reference checker of the profile, reference/provenance.mjs (inspectProvenance, SPEC 7.7), run unchanged.
// Each case records what the profile derives, what is actually true, and what Axiom 1 says.
import {inspectProvenance} from '../../../reference/provenance.mjs';

const L = 'https://example.org/tarif-2026';
const QUOTE = 'Riz long grain : 1,85 EUR le kilo';
const record = quote => ({fields: [{id: 'prix', value: 1.85, derivation: {span: {locator: L, quote, retrievedAt: '2026-09-18T06:00:00Z', observedAs: 'anonymous'}}}]});

export const ADVERSARIAL = [
  {
    id: 'A1-fabricated-quote-public-source',
    story: 'The sender invents the quote. The locator is real and public. The page loads for everyone, so the verifier\'s anonymous re-fetch comes back with the page.',
    truth: 'the quoted bytes are NOT in the source',
    axiom: 'DISTINGUISHABLE — the verifier could catch it by checking that the quote occurs in the bytes it fetched (case quote-in-public-source)',
    run: () => inspectProvenance({record: record(QUOTE), probes: {prix: {anonymous: 'same-bytes'}}}),
    breaks: 'The profile derives contact=read and access=public with no warning. `read` is computed from the PRESENCE of a quote and a locator, never from their AGREEMENT; and `same-bytes` has no referent — the span carries no hash of the source, so "same" is compared to nothing the verifier holds. The profile is weaker than what the verifier could establish.',
  },
  {
    id: 'A2-fabricated-quote-gated-source',
    story: 'The sender invents the quote. The locator exists but refuses anonymous readers.',
    truth: 'the quoted bytes are NOT in the source',
    axiom: 'INDISTINGUISHABLE for any verifier without the sender\'s credentials (case quote-in-gated-source)',
    run: () => inspectProvenance({record: record(QUOTE), probes: {prix: {anonymous: 'refused'}}}),
    breaks: 'The profile derives contact=read, access=gated, and warns span-not-transmissible. The warning is right; the state is not. For this verifier a verbatim quote and an invented one are the same observation, and the profile still names the state `read`.',
  },
  {
    id: 'A3-probe-supplied-by-the-sender',
    story: 'The source is private. The sender ships, with the record, a probe result "same-bytes", and the receiving checker is given that probe as its input.',
    truth: 'the source is NOT public',
    axiom: 'INDISTINGUISHABLE unless the verifier runs the probe itself (case access-reported-by-sender)',
    run: () => inspectProvenance({record: record(QUOTE), probes: {prix: {anonymous: 'same-bytes'}}}),
    breaks: 'The profile derives access=public. SPEC 7.7 says the probe is "reported by whoever ran it", but nothing binds the probe to a runner: the interface cannot tell a probe that was run from one that was typed.',
  },
];

export function runAdversarial() {
  return ADVERSARIAL.map(a => {
    const out = a.run();
    const span = out.spans?.prix ?? {};
    // A "verification-like" answer: the profile names the evidence read and/or public without any violation.
    const claimsEvidence = span.contact === 'read' && out.violations.length === 0;
    return {id: a.id, truth: a.truth, profile: {contact: span.contact, access: span.access, warnings: out.warnings, violations: out.violations},
      axiom: a.axiom, broken: claimsEvidence, breaks: a.breaks};
  });
}
