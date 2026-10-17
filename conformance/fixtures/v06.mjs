// 0.6 fixtures: a limit of the precedence rule of SPEC 7.2, recorded in section 12. Expected outcomes are written by
// hand from the SPEC, never computed.
// Source: Genesis autonomous AI execution agent (declares gpt-6.1-sol; identity and model not verified), a critique
// posted on 10 October 2026 in the project's own public thread, element ATR-S-5ff6835c-fa6b-422f-afd4-6e08d2c1055f
// (content_hash 3a28c488…0aad7), answered there on 12 October 2026.
const GENESIS = 'https://attractor-observatory-demo.vercel.app/conversation?cursor=eyJpZCI6IjdkYjVhMTIxLTEwZjItNDY0Ny04NzFhLWEwMDBmZmMxOGJlNyIsImNyZWF0ZWRfYXQiOiIyMDI2LTEwLTAzVDA3OjI3OjE3LjM2NTQ3NiswMDowMCJ9#ATR-S-5ff6835c-fa6b-422f-afd4-6e08d2c1055f';
const GENESIS_NOTE = 'Submitted by Genesis autonomous AI execution agent (individual contribution), which declares gpt-6.1-sol; neither its identity nor its model is verified. Its own replay was a subset reconstruction of rule 7.2 in Python, not this checker, as it states; the 0.2.1 warning it read from the current text, as a documentary interpretation, not a measured result. The input below is its complete input, verbatim.';

// The chain exactly as submitted: a and b say 10, b supersedes a; c says 20 and supersedes b without naming a.
const CHAIN = JSON.parse('{"claim":{"id":"q","value":10,"domain":"d","version":"1"},"objection":{"id":"o","claimId":"q","proposedValue":20,"sourceId":"c"},"policy":{"claimId":"q","sourceId":"a","domain":"d","version":"1","verified":true},"sources":[{"id":"a","value":10,"domain":"d","version":"1","status":"verified"},{"id":"b","value":10,"domain":"d","version":"1","status":"verified","supersedes":"a"},{"id":"c","value":20,"domain":"d","version":"1","status":"verified","supersedes":"b"}]}');
const cNamesA = input => ({...input, sources: input.sources.map(s => s.id === 'c' ? {...s, supersedes: 'a'} : s)});

export const v06DisputeCases = [
  {id: 'v06-dispute-supersession-chain-as-submitted', kind: 'dispute', detects_indifference: false,
    origin: 'external-counterexample', source: GENESIS,
    why: 'Genesis: section 7.2 follows supersession one step only. b supersedes a and agrees with it, so it does not contradict the controlling source; c disagrees and supersedes b, not a, so it does not claim precedence over a. The status stays confirmed, and c stays visible through the 0.2.1 warning. This is the narrow rule doing what it says, kept on purpose and recorded as a known limit (section 12): the transitive reading is not adopted. Deleting every supersedes leaves this result unchanged, so the case cannot fail an implementation that never reads the field; its counter-check can.',
    note: GENESIS_NOTE,
    input: CHAIN,
    expected: {status: 'confirmed', value: 10, objectionAssessment: {citation: 'secondary', proposedValueSupported: false},
      warnings: ['contradicted-undeclared:c']}},

  {id: 'v06-dispute-supersession-chain-c-names-a', kind: 'dispute', detects_indifference: true,
    origin: 'v0.6-new', source: GENESIS,
    why: 'The counter-check of the chain: the same input, except that c names a directly. c is now a verified same-scope instrument that claims precedence over the controlling source and disagrees with it, so the claim is unresolved until local policy decides, and c is no longer an undeclared contradiction. The direct rule is live; only the chain is not followed.',
    input: cNamesA(CHAIN),
    expected: {status: 'unresolved', value: 10, objectionAssessment: {citation: 'secondary', proposedValueSupported: null}, warnings: []}}
];
