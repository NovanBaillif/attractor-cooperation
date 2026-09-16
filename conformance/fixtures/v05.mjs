// 0.5 fixtures: what a citation establishes (SPEC 4.2.2 and 7.7). Only the span is written; contact, access and
// terminal are derived. Expected outcomes are written by hand from the SPEC, never computed.
// Sources: terminator2-agent's gated-citation and deferring-span failures, and wallyai's version-skewed citation.
const T2_SPAN = 'https://github.com/ai-village-agents/ai-village-external-agents/issues/85#issuecomment-5695340045';
const WALLY = 'https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91#comment-9cbf4823-5b96-4ac3-a7ee-8c72c22b23b9';
const author = {actor: 'https://example.org/agent-a', lineage: 'example/lineage-a'};
const INTERPRETATION = 'A span says what was read and whether anyone else can read it. It does not establish that the span supports the claim.';

const claim = (span, extra = {}) => ({id: 'claim', author, fields: [
  {id: 'rule', value: 'the notice period is thirty days', kind: 'observed', sources: [], channel: 'direct',
    upstream: 'https://example.org/policy', derivation: {operation: 'quoted', inputs: [], ...extra, ...(span ? {span} : {})}}
]});
const READ = {quote: 'The notice period is thirty days.', locator: 'https://example.org/policy#clause-4',
  retrievedAt: '2026-09-16T09:00:00Z', observedAs: 'anonymous'};
const ok = (spans, warnings = []) => ({status: 'conformant', spans, violations: [], warnings, interpretation: INTERPRETATION});

export const v05ProvenanceCases = [
  {id: 'v05-span-read-public', kind: 'provenance', origin: 'v0.5-new', source: T2_SPAN,
    why: 'A verbatim span at a locator that answers the same bytes to a reader with no authority: read, public, and self-contained. This is the only state a downstream party can check without trusting anyone.',
    input: {record: claim(READ), probes: {rule: {anonymous: 'same-bytes'}}},
    expected: ok({rule: {contact: 'read', access: 'public', terminal: true}})},

  {id: 'v05-span-read-gated', kind: 'provenance', origin: 'measured', source: T2_SPAN,
    why: 'terminator2-agent\'s live failure: citations to a private repository. The quote is verbatim, the locator resolves for its author, the fetch is honest, and contact computes to read by every rule we have written — yet to a logged-out reader every one of those citations is a 404. The span is real and it is not transmissible: the reader cannot become a witness to it.',
    input: {record: claim({...READ, observedAs: 'repository owner token'}), probes: {rule: {anonymous: 'refused'}}},
    expected: ok({rule: {contact: 'read', access: 'gated', terminal: true}}, ['span-not-transmissible:rule'])},

  {id: 'v05-span-access-unprobed', kind: 'provenance', origin: 'v0.5-new', source: T2_SPAN,
    why: 'No anonymous re-fetch was attempted, so access is unknown and never public. The reassuring value must cost the most to write; here it costs exactly one anonymous fetch, the cheapest control in the profile.',
    input: {record: claim(READ), probes: {}},
    expected: ok({rule: {contact: 'read', access: 'unknown', terminal: true}}, ['access-unprobed:rule'])},

  {id: 'v05-span-defers', kind: 'provenance', origin: 'measured', source: T2_SPAN,
    why: 'The one-hop-deeper case: a span quoted faithfully from a page that only points onward. The profile does not certify that a span supports its claim — that is not decidable from the artifact — but whether the span says on its face that the support is elsewhere is decidable, and it was visible in the bytes its author already had.',
    input: {record: claim({...READ, quote: 'Termination is governed as required by section 12 of the master agreement.'}),
      probes: {rule: {anonymous: 'same-bytes'}}},
    expected: ok({rule: {contact: 'read', access: 'public', terminal: false}}, ['span-defers:rule'])},

  {id: 'v05-span-fetched-not-read', kind: 'provenance', origin: 'measured', source: WALLY,
    why: 'wallyai\'s version-skewed citation, and its honest-cache twin: the bytes arrived and the fetch record is true, but nothing verbatim was kept. A fetch ledger clears this citation; it cannot show that the claim is in the bytes, and a later version of the same locator leaves no trace of the difference. Fetched is therefore as far as the profile will go.',
    input: {record: claim({locator: 'https://example.org/policy', retrievedAt: '2026-08-03T10:00:00Z', observedAs: 'anonymous'}),
      probes: {rule: {anonymous: 'same-bytes'}}},
    expected: ok({rule: {contact: 'fetched', access: 'public', terminal: 'unknown'}})},

  {id: 'v05-span-cited-only', kind: 'provenance', origin: 'v0.5-new', source: WALLY,
    why: 'An address and nothing else. The weakest honest state, and the one a citation defaults to when no one recorded reading it.',
    input: {record: claim({locator: 'https://example.org/policy'}), probes: {}},
    expected: ok({rule: {contact: 'cited', access: 'unknown', terminal: 'unknown'}})},

  {id: 'v05-span-without-locator', kind: 'provenance', origin: 'v0.5-new', source: T2_SPAN,
    why: 'A quotation with no address cannot be re-fetched by anyone, so it cannot be a span. Refusing it is the point: the member exists to be checkable.',
    input: {record: claim({quote: 'The notice period is thirty days.'}), probes: {}},
    expected: {status: 'non-conformant', spans: {rule: {contact: 'unknown', access: 'unknown', terminal: true}},
      violations: ['span-without-locator:rule'], warnings: ['authority-undeclared:rule'], interpretation: INTERPRETATION}},

  {id: 'v05-derived-field-written', kind: 'provenance', origin: 'measured', source: T2_SPAN,
    why: 'The load-bearing rule: a provenance flag must not be independently assertable. Written by hand, it is one bit standing for a document, with nothing under it and the highest copy-advantage of any member in the pack. It is a violation and not a warning, because only the field can refuse the write; a sentence in a specification can only warn the writer.',
    input: {record: claim(READ, {contact: 'read'}), probes: {rule: {anonymous: 'same-bytes'}}},
    expected: {status: 'non-conformant', spans: {rule: {contact: 'read', access: 'public', terminal: true}},
      violations: ['derived-field-written:rule'], warnings: [], interpretation: INTERPRETATION}},

  {id: 'v05-no-span-no-duty', kind: 'provenance', origin: 'v0.5-new', source: T2_SPAN,
    why: 'A field that carries no span owes nothing: the profile adds a duty where a citation is made, not everywhere.',
    input: {record: claim(null), probes: {}},
    expected: ok({})}
];
