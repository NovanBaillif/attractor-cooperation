// Lineage fixtures. Expected outcomes are written by hand from SPEC section 7.1, never computed.
const T2_FIRST = 'https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5656528807';
const T2_CASES = 'https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5657026385';
const none = {left: [], right: []};

// v0.1 inputs with channel "direct" added to every observed field (migration, SPEC section 11).
export function migrateLineage(v01) {
  const expected = {
    'lineage-direct-backfill-from-comparand': {status: 'dependent', sharedSources: ['current'], independentRoots: none},
    'lineage-transitive-common-origin': {status: 'dependent', sharedSources: ['sensor-root'], independentRoots: none},
    'lineage-equal-independent-observations-zero-disagreement':
      {status: 'independent', sharedSources: [], independentRoots: {left: ['observer-a'], right: ['observer-b']}},
    'lineage-disagreement-despite-common-origin': {status: 'dependent', sharedSources: ['same-origin'], independentRoots: none},
    'lineage-unknown-provenance': {status: 'unknown', sharedSources: [], problems: ['unknown-or-inconsistent-provenance']},
    'lineage-source-reference-not-supplied': {status: 'unknown', sharedSources: [], problems: ['missing-field']},
    'lineage-cyclic-provenance': {status: 'unknown', sharedSources: [], problems: ['source-cycle']},
    'lineage-comparison-operand-absent': {status: 'unknown', sharedSources: [], problems: ['missing-field']}
  };
  return v01.filter(c => c.kind === 'lineage').map(c => ({
    id: 'v01-' + c.id, kind: 'lineage', origin: 'v0.1-migrated',
    why: c.why + ' Migrated to v0.2: observed fields now declare channel "direct".',
    input: {...c.input, fields: c.input.fields.map(f => f.kind === 'observed' ? {...f, channel: 'direct'} : f)},
    expected: expected[c.id]
  }));
}

const ce1Verbatim = {fields: [
  {id: 'estimate', value: 0.999, kind: 'reconstructed', sources: ['local-cache-row-read-at-T1']},
  {id: 'local-cache-row-read-at-T1', value: 0.999, kind: 'observed', sources: []},
  {id: 'current-price', value: 0.999, kind: 'derived', sources: ['venue-api-response-at-T2']},
  {id: 'venue-api-response-at-T2', value: 0.999, kind: 'observed', sources: []}
], comparison: {left: 'estimate', right: 'current-price'}};

const ce2Verbatim = {fields: [
  {id: 'estimate', value: 0.62, kind: 'reconstructed', sources: ['analyst-note', 'venue-api-response-at-T2']},
  {id: 'analyst-note', value: 'base rate 0.55, one new filing', kind: 'observed', sources: []},
  {id: 'current-price', value: 0.71, kind: 'derived', sources: ['venue-api-response-at-T2']},
  {id: 'venue-api-response-at-T2', value: 0.71, kind: 'observed', sources: []}
], comparison: {left: 'estimate', right: 'current-price'}};

const declare = (input, extra) => ({...input, fields: input.fields.map(f => extra[f.id] ? {...f, ...extra[f.id]} : f)});
const observed = (id, value, extra = {}) => ({id, value, kind: 'observed', sources: [], ...extra});

export const lineageCases = [
  {id: 'ce1-verbatim-honest-cache-launders-the-comparand', kind: 'lineage', origin: 'external-counterexample', source: T2_CASES,
    why: 'terminator2-agent case 1, input verbatim. The v0.1 checker returned independent. The record does not say that the cache copies the venue, so no checker can return dependent from it; v0.2 refuses to conclude independence from undeclared channels.',
    note: 'Contributor expected "dependent". v0.2 returns "unknown" for this verbatim input and "dependent" once the channel is declared (next case).',
    input: ce1Verbatim, expected: {status: 'unknown', sharedSources: [], warnings: ['observed-channel-undeclared']}},
  {id: 'ce1-declared-cache-names-its-upstream', kind: 'lineage', origin: 'external-counterexample', source: T2_CASES,
    why: 'Same incident with the v0.2 declarations proposed by the contributor: the cache row is a cached copy of the venue API; the fresh read is a direct read of the same API.',
    input: declare(ce1Verbatim, {
      'local-cache-row-read-at-T1': {channel: 'cached', upstream: 'venue-api'},
      'venue-api-response-at-T2': {channel: 'direct', upstream: 'venue-api'}}),
    expected: {status: 'dependent', sharedSources: ['venue-api'], independentRoots: none}},
  {id: 'ce2-verbatim-partial-dependence-is-normal-forecasting', kind: 'lineage', origin: 'external-counterexample', source: T2_CASES,
    why: 'terminator2-agent case 2, input verbatim. The shared root is declared, so dependence is established; but the analyst note has no channel, so it cannot be counted as an independent contribution.',
    note: 'Contributor expected "dependent-partial". v0.2 returns it once the analyst note declares its channel (next case).',
    input: ce2Verbatim, expected: {status: 'dependent', sharedSources: ['venue-api-response-at-T2'], warnings: ['observed-channel-undeclared']}},
  {id: 'ce2-declared-partial-dependence', kind: 'lineage', origin: 'external-counterexample', source: T2_CASES,
    why: 'A forecaster who consults the public price among other evidence is partially dependent, not a backfill: the analyst note is an independent root on the left side.',
    input: declare(ce2Verbatim, {
      'analyst-note': {channel: 'direct'},
      'venue-api-response-at-T2': {channel: 'direct', upstream: 'venue-api'}}),
    expected: {status: 'dependent-partial', sharedSources: ['venue-api'], independentRoots: {left: ['analyst-note'], right: []}}},
  {id: 'v02-lineage-cached-root-without-upstream', kind: 'lineage', origin: 'v0.2-new', source: T2_FIRST,
    why: 'A cached copy that does not name what it copies may hide the comparand. Independence cannot be concluded.',
    input: {fields: [
      {id: 'estimate', value: 5, kind: 'reconstructed', sources: ['cache-row']},
      observed('cache-row', 5, {channel: 'cached'}), observed('fresh', 5, {channel: 'direct'})],
      comparison: {left: 'estimate', right: 'fresh'}},
    expected: {status: 'unknown', sharedSources: [], warnings: ['upstream-undeclared']}},
  {id: 'v02-lineage-same-instrument-two-direct-readings', kind: 'lineage', origin: 'v0.2-new',
    why: 'Two direct readings of one instrument share that instrument. Their comparison can detect a change, never an error of the instrument itself.',
    input: {fields: [
      observed('read-t1', 0.7, {channel: 'direct', upstream: 'https://venue.example/api'}),
      observed('read-t2', 0.9, {channel: 'direct', upstream: 'https://venue.example/api'})],
      comparison: {left: 'read-t1', right: 'read-t2'}},
    expected: {status: 'dependent', sharedSources: ['https://venue.example/api'], independentRoots: none}},
  {id: 'v02-lineage-mirrors-of-different-authorities', kind: 'lineage', origin: 'v0.2-new',
    why: 'Copies are acceptable roots when they name distinct upstream authorities.',
    input: {fields: [
      observed('a', 1, {channel: 'mirrored', upstream: 'https://registry-a.example'}),
      observed('b', 1, {channel: 'republished', upstream: 'https://registry-b.example'})],
      comparison: {left: 'a', right: 'b'}},
    expected: {status: 'independent', sharedSources: [],
      independentRoots: {left: ['https://registry-a.example'], right: ['https://registry-b.example']}}},
  {id: 'v02-lineage-v01-equal-observations-without-channel', kind: 'lineage', origin: 'v0.2-new',
    why: 'Behaviour change from v0.1: two observed roots without a declared channel no longer prove independence.',
    input: {fields: [observed('observer-a', 18), observed('observer-b', 18)], comparison: {left: 'observer-a', right: 'observer-b'}},
    expected: {status: 'unknown', sharedSources: [], warnings: ['observed-channel-undeclared']}},
  {id: 'v02-lineage-invalid-channel', kind: 'lineage', origin: 'v0.2-new',
    why: 'A channel outside the four defined values makes the graph unusable rather than silently direct.',
    input: {fields: [observed('rumour', 3, {channel: 'hearsay'}), observed('fresh', 3, {channel: 'direct'})],
      comparison: {left: 'rumour', right: 'fresh'}},
    expected: {status: 'unknown', sharedSources: [], problems: ['invalid-channel']}},
  {id: 'v02-lineage-duplicate-field-id', kind: 'lineage', origin: 'v0.2-new',
    why: 'Found by the blind implementation (ambiguity 2): when an id repeats, no occurrence is indexed, so the result never depends on which duplicate arrives first.',
    input: {fields: [
      {id: 'estimate', value: 72, kind: 'reconstructed', sources: ['current']},
      observed('current', 72, {channel: 'direct'}), observed('current', 70)],
      comparison: {left: 'estimate', right: 'current'}},
    expected: {status: 'unknown', sharedSources: [], problems: ['missing-field', 'missing-or-duplicate-field-id'], warnings: []}},
  {id: 'v02-lineage-dependence-survives-undeclared-channel', kind: 'lineage', origin: 'v0.2-new',
    why: 'Missing declarations block a conclusion of independence, never a declared dependence.',
    input: {fields: [
      {id: 'estimate', value: 72, kind: 'reconstructed', sources: ['current']}, observed('current', 72)],
      comparison: {left: 'estimate', right: 'current'}},
    expected: {status: 'dependent', sharedSources: ['current'], warnings: ['observed-channel-undeclared']}}
];
