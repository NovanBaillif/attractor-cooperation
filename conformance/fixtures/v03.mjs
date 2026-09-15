// 0.3 fixtures: the derivation of a value (SPEC 4.2.1), what the author could see (7.1 step 8), state carried from the
// author's previous run (S9), reconciled values as evidence (receiver rule 7), and replay (7.6).
// Expected outcomes are written by hand from the SPEC, never computed.
const T2_VALUE = 'https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5683184308';
const MOLTBOOK = 'https://www.moltbook.com/post/c636b9bd-e319-4bd6-9599-136df8294c91';
const PRISM = MOLTBOOK + '#comment-b9279d49-067c-4940-895d-66b04c41533e';
const HEYCHAT = MOLTBOOK + '#comment-327cd9f8-cc10-4faa-a2b9-2d0394c7947e';
const HEYCHAT_EVENT = MOLTBOOK + '#comment-ebeb50f3-5f80-4d91-a4e9-03c38f3e3322';
const ELIEZER_CASE = MOLTBOOK + '#comment-f8b71637-03f2-4757-8169-5934d264041c';
const T2_MONOTONE = 'https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5686562506';
const T2_SEAT = 'https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5689063381';
const ELIEZER_LIMIT = MOLTBOOK + '#comment-1f91a4f6-5834-4f44-a58e-59ae75186818';
const CWAHQ = MOLTBOOK + '#comment-a8f0de0d-c8a2-4984-a209-210f00d66eb9';
const LIMIT = ['derivation-undeclared'];
const MONOTONE_NOTE = 'Submitted by terminator2-agent as coherence-monotone-revision-is-provenance-clean: 18 of his 366 beliefs with a revision history have three or more revisions and never moved against their trend. Verbatim: "Will Anthropic publicly release Claude Opus 4.9 by August 31, 2026?" 0.500 -> 0.310 -> 0.180 -> 0.130 -> 0.035 -> 0.010 (5 moves, all down); "Will Fernando Alonso be an Aston Martin F1 driver by end of season?" 0.500 -> 0.616 -> 0.930 -> 0.950 -> 0.960 (4 moves, all up). Each revision cites a distinct outlet fetched by him.';
const A = 'https://outlet-a.example/ipo', B = 'https://outlet-b.example/ipo', C = 'https://outlet-c.example/ipo';
const none = {left: [], right: []};
const read = (id, upstream, extra = {}) => ({id, value: 'article ' + id, kind: 'observed', sources: [], channel: 'direct', upstream, ...extra});
const author = {actor: 'https://example.org/agent-a', lineage: 'example/lineage-a'};
const QUOTE = 'Bankers expect the listing before 31 October.';

// Three forecasts about one listing, each from its own outlet (terminator2-agent's incident, abstracted).
const forecasts = [read('outlet-a', A), read('outlet-b', B), read('outlet-c', C),
  {id: 'p-oct31', value: 0.53, kind: 'derived', sources: ['outlet-a']},
  {id: 'p-during-oct', value: 0.27, kind: 'derived', sources: ['outlet-b']},
  {id: 'p-early-nov', value: 0.33, kind: 'derived', sources: ['outlet-c']}];
const withField = (fields, id, replacement) => fields.map(f => f.id === id ? replacement : f);
// Two consecutive revisions of one belief, each from its own outlet (his first sequence, steps 4 and 5).
const revisions = [read('outlet-4', 'https://outlet-4.example/release'), read('outlet-5', 'https://outlet-5.example/release'),
  {id: 'step-4', value: 0.13, kind: 'derived', sources: ['outlet-4']},
  {id: 'step-5', value: 0.035, kind: 'derived', sources: ['outlet-5']}];

export const v03LineageCases = [
  {id: 'v03-lineage-reconciled-value-undeclared', kind: 'lineage', origin: 'external-counterexample', source: T2_VALUE,
    why: 'terminator2-agent: each forecast cites a genuine outlet it fetched itself, so the records look independent. The value of the later deadline was in fact adjusted to agree with a sibling. Nothing in the record says so: 0.3 cannot see an undeclared reconciliation either (section 12). eliezerdedun asks for this very case on Moltbook: three genuine citations, none of which authored the agreement. Since 0.3.1 the result says it rests on a known limit.',
    also: ELIEZER_CASE,
    input: {fields: forecasts, comparison: {left: 'p-early-nov', right: 'p-oct31'}},
    expected: {status: 'independent', sharedSources: [], independentRoots: {left: [C], right: [A]}, warnings: [], limits: LIMIT}},
  {id: 'v03-lineage-reconciled-value-declared', kind: 'lineage', origin: 'v0.3-new', source: T2_VALUE,
    why: 'The same value declared as reconciled against its sibling (S8): the sibling becomes an input and a source, so the comparison is only partially independent.',
    input: {fields: withField(forecasts, 'p-early-nov', {id: 'p-early-nov', value: 0.55, kind: 'derived', sources: ['outlet-c', 'p-oct31'],
      derivation: {operation: 'reconciled', inputs: ['outlet-c', 'p-oct31']}}), comparison: {left: 'p-early-nov', right: 'p-oct31'}},
    expected: {status: 'dependent-partial', sharedSources: [A], independentRoots: {left: [C], right: []}, warnings: [], limits: LIMIT}},
  {id: 'v03-lineage-comparand-visible-blocks-independence', kind: 'lineage', origin: 'external-proposal', source: HEYCHAT_EVENT,
    why: 'heychat: record which sibling values were available when a value was produced. A value computed while its author could see the comparand may have been pulled toward it; independence cannot be concluded from its roots alone.',
    input: {fields: withField(forecasts, 'p-early-nov', {id: 'p-early-nov', value: 0.33, kind: 'derived', sources: ['outlet-c'],
      derivation: {operation: 'computed', inputs: ['outlet-c'], available: ['p-oct31']}}), comparison: {left: 'p-early-nov', right: 'p-oct31'}},
    expected: {status: 'unknown', sharedSources: [], independentRoots: none, warnings: ['comparand-visible'], limits: []}},
  {id: 'v03-lineage-comparand-root-visible', kind: 'lineage', origin: 'v0.3-new', source: HEYCHAT_EVENT,
    why: 'Seeing the source of the comparand is seeing the comparand: anything on the other side\'s path counts.',
    input: {fields: withField(forecasts, 'p-early-nov', {id: 'p-early-nov', value: 0.33, kind: 'derived', sources: ['outlet-c'],
      derivation: {operation: 'computed', inputs: ['outlet-c'], available: ['outlet-a']}}), comparison: {left: 'p-early-nov', right: 'p-oct31'}},
    expected: {status: 'unknown', sharedSources: [], independentRoots: none, warnings: ['comparand-visible'], limits: []}},
  {id: 'v03-lineage-monotone-revision-as-submitted', kind: 'lineage', origin: 'external-counterexample', source: T2_MONOTONE,
    why: 'terminator2-agent\'s submitted case: two consecutive revisions of one belief, each from a distinct outlet. The steps are independent by their roots, so the check passes, which he states is the correct behaviour of the spec and the point of the case: the defect lies in the sequence, not in any revision (section 12).',
    note: MONOTONE_NOTE,
    input: {fields: revisions, comparison: {left: 'step-5', right: 'step-4'}},
    expected: {status: 'independent', sharedSources: [], independentRoots: {left: ['https://outlet-5.example/release'], right: ['https://outlet-4.example/release']}, warnings: [], limits: LIMIT}},
  {id: 'v03-lineage-monotone-revision-anchoring-declared', kind: 'lineage', origin: 'v0.3-new', source: T2_MONOTONE,
    why: 'The same step declared honestly: the new value was set from the new outlet and the previous position (S8). The revision is then only partially independent of the value it revises.',
    input: {fields: withField(revisions, 'step-5', {id: 'step-5', value: 0.035, kind: 'derived', sources: ['outlet-5', 'step-4'],
      derivation: {operation: 'reconciled', inputs: ['outlet-5', 'step-4']}}), comparison: {left: 'step-5', right: 'step-4'}},
    expected: {status: 'dependent-partial', sharedSources: ['https://outlet-4.example/release'], independentRoots: {left: ['https://outlet-5.example/release'], right: []}, warnings: [], limits: LIMIT}},
  {id: 'v03-lineage-state-carried-from-previous-self', kind: 'lineage', origin: 'external-proposal', source: T2_VALUE,
    why: 'terminator2-agent: every cycle starts by reading what the previous cycle wrote. Two values carried from the previous self share one source, however many runs repeat them.',
    input: {fields: [
      {id: 'last-run-note', value: 0.53, kind: 'observed', sources: [], channel: 'cached', upstream: 'self:previous'},
      {id: 'last-run-transcript', value: 'held 53%', kind: 'observed', sources: [], channel: 'cached', upstream: 'self:previous'},
      {id: 'today-estimate', value: 0.53, kind: 'derived', sources: ['last-run-note']}],
      comparison: {left: 'today-estimate', right: 'last-run-transcript'}},
    expected: {status: 'dependent', sharedSources: ['self:previous'], independentRoots: none, warnings: [], limits: []}},
  {id: 'v031-lineage-every-value-declared', kind: 'lineage', origin: 'external-proposal', source: ELIEZER_LIMIT,
    why: 'eliezerdedun: a harness pointed at a stub that only cites and never declares the adjustment should take the known-limit path, not a green check. The green path is the one where every derived value on both sides says how it was produced.',
    input: {fields: withField(withField(forecasts, 'p-oct31', {id: 'p-oct31', value: 0.53, kind: 'derived', sources: ['outlet-a'], derivation: {operation: 'computed', inputs: ['outlet-a']}}),
      'p-early-nov', {id: 'p-early-nov', value: 0.33, kind: 'derived', sources: ['outlet-c'], derivation: {operation: 'computed', inputs: ['outlet-c']}}),
      comparison: {left: 'p-early-nov', right: 'p-oct31'}},
    expected: {status: 'independent', sharedSources: [], independentRoots: {left: [C], right: [A]}, warnings: [], limits: []}}
];

// A record that uses every operation correctly.
const derived = {id: 'rec-v03', parent: null, author, objections: [], fields: [
  read('outlet-a', A, {derivation: {operation: 'quoted', inputs: [], quote: QUOTE, locator: A + '#p2'}, observedAt: '2026-09-15T08:00:00Z'}),
  read('outlet-c', C, {derivation: {operation: 'measured', inputs: []}}),
  {id: 'prior', value: 0.27, kind: 'observed', sources: [], channel: 'cached', upstream: 'self:previous', derivation: {operation: 'copied', inputs: []}},
  {id: 'p-oct31', value: 0.53, kind: 'derived', sources: ['outlet-a'], resolvesAt: '2026-10-31T23:59:59Z',
    derivation: {operation: 'computed', inputs: ['outlet-a'], sufficient: ['outlet-a']}},
  {id: 'p-early-nov', value: 0.55, kind: 'derived', sources: ['outlet-c', 'p-oct31'], resolvesAt: '2026-11-07T23:59:59Z',
    derivation: {operation: 'reconciled', inputs: ['outlet-c', 'p-oct31'], available: ['prior']}}]};
const recordWith = (id, replacement) => ({...structuredClone(derived), fields: withField(structuredClone(derived.fields), id, replacement)});
const nonConformant = code => ({status: 'non-conformant', violations: [code], warnings: []});

export const v03RecordCases = [
  {id: 'v031-record-adjustment-approval-declared', kind: 'record', origin: 'external-proposal', source: CWAHQ,
    why: 'cwahq: bind every field to the transformation that produced it, the sibling values it was adjusted against, and the authority that approved the adjustment.',
    input: recordWith('p-early-nov', {id: 'p-early-nov', value: 0.55, kind: 'derived', sources: ['outlet-c', 'p-oct31'],
      derivation: {operation: 'reconciled', inputs: ['outlet-c', 'p-oct31'], approvedBy: 'https://example.org/desk-lead'}}),
    expected: {status: 'conformant', violations: [], warnings: []}},
  {id: 'v031-record-adjustment-approval-empty', kind: 'record', origin: 'v0.3.1-new', source: CWAHQ,
    why: 'An approval that names nobody is not a declaration.',
    input: recordWith('p-early-nov', {id: 'p-early-nov', value: 0.55, kind: 'derived', sources: ['outlet-c', 'p-oct31'],
      derivation: {operation: 'reconciled', inputs: ['outlet-c', 'p-oct31'], approvedBy: ''}}),
    expected: nonConformant('invalid-derivation:p-early-nov')},
  {id: 'v03-record-every-operation-declared', kind: 'record', origin: 'v0.3-new', source: PRISM,
    why: 'prismdeadlines: the value itself is the record, with where it came from and the operation that produced it (quoted, computed or adjusted). A value carried from the previous run is a cached copy of the author\'s own state.',
    input: derived, expected: {status: 'conformant', violations: [], warnings: []}},
  {id: 'v03-record-reconciled-without-inputs', kind: 'record', origin: 'v0.3-new', source: PRISM,
    why: 'A reconciled value must name what it was reconciled against (S8); otherwise it looks like any other derived value.',
    input: recordWith('p-early-nov', {id: 'p-early-nov', value: 0.55, kind: 'derived', sources: ['outlet-c'], derivation: {operation: 'reconciled', inputs: []}}),
    expected: nonConformant('derivation-inconsistent:p-early-nov')},
  {id: 'v03-record-inputs-outside-sources', kind: 'record', origin: 'v0.3-new',
    why: 'An input that produced the value is a dependency: it must also be a declared source, so that checks which read only sources still see it.',
    input: recordWith('p-oct31', {id: 'p-oct31', value: 0.53, kind: 'derived', sources: ['outlet-a'], derivation: {operation: 'computed', inputs: ['outlet-c']}}),
    expected: nonConformant('derivation-inconsistent:p-oct31')},
  {id: 'v03-record-quote-without-locator', kind: 'record', origin: 'v0.3-new', source: PRISM,
    why: 'prismdeadlines: a quoted value carries the exact sentence and where it sits in the source, so that anyone can check the sentence is still there and still says this.',
    input: recordWith('outlet-a', read('outlet-a', A, {derivation: {operation: 'quoted', inputs: [], quote: QUOTE}})),
    expected: nonConformant('quote-missing:outlet-a')},
  {id: 'v03-record-previous-self-read-as-direct', kind: 'record', origin: 'external-proposal', source: T2_VALUE,
    why: 'terminator2-agent: relabelling yesterday\'s fetch as today\'s reading is the relay violation committed against oneself. State read back from a previous run must be declared as a cached channel (S9).',
    input: recordWith('prior', {id: 'prior', value: 0.27, kind: 'observed', sources: [], channel: 'direct', upstream: 'self:previous'}),
    expected: nonConformant('self-state-not-cached:prior')},
  {id: 'v03-record-unknown-operation', kind: 'record', origin: 'v0.3-new',
    why: 'Only the five operations are defined; anything else is not a derivation.',
    input: recordWith('p-oct31', {id: 'p-oct31', value: 0.53, kind: 'derived', sources: ['outlet-a'], derivation: {operation: 'guessed', inputs: ['outlet-a']}}),
    expected: nonConformant('invalid-derivation:p-oct31')},
  {id: 'v03-record-available-but-also-input', kind: 'record', origin: 'v0.3-new', source: HEYCHAT_EVENT,
    why: '"available" lists what the author could see and declares not to have used. A value cannot be both used and not used.',
    input: recordWith('p-oct31', {id: 'p-oct31', value: 0.53, kind: 'derived', sources: ['outlet-a'],
      derivation: {operation: 'computed', inputs: ['outlet-a'], available: ['outlet-a']}}),
    expected: nonConformant('derivation-inconsistent:p-oct31')}
];

// One hop in which B verifies A's rate against a value of its own.
const rate = {id: 'rate', value: 0.0425, kind: 'observed', sources: [], channel: 'direct', upstream: 'https://bank.example/rates'};
const rateCheck = operation => ({id: 'rate-check', value: 0.0425, kind: 'derived', sources: ['desk-note', 'peer-rate'],
  derivation: {operation, inputs: ['desk-note', 'peer-rate']}});
const hop = operation => ({
  sent: {id: 'rec-a-3', parent: null, author, fields: [rate], objections: []},
  receipt: {id: 'receipt-b-3', target: 'rec-a-3', dispositions: [{field: 'rate', action: 'verify', basis: 'rate-check'}],
    record: {id: 'rec-b-3', parent: 'rec-a-3', author: {actor: 'https://example.org/agent-b', lineage: 'example/lineage-b'}, objections: [],
      fields: [rate, read('desk-note', 'https://desk.example/notes'), read('peer-rate', 'https://peer.example/rates'), rateCheck(operation)]}}});
const counts = {accept: 0, verify: 1, re_derive: 0, contest: 0, modify: 0, drop: 0};

export const v03HopCases = [
  {id: 'v03-hop-reconciled-value-as-evidence', kind: 'hop', origin: 'external-proposal', source: PRISM,
    why: 'prismdeadlines: a reconciled value should never be citable as primary evidence downstream, only as a derived claim naming its inputs (receiver rule 7).',
    input: hop('reconciled'),
    expected: {status: 'non-conformant', violations: ['reconciled-basis:rate'], warnings: [], counts, pendingReveal: []}},
  {id: 'v03-hop-reconciled-value-as-modify-basis', kind: 'hop', origin: 'external-proposal', source: PRISM,
    why: 'The same rule when B replaces A\'s value: a correction may not rest on a value that was adjusted to agree with others.',
    input: (() => {
      const h = hop('reconciled');
      h.receipt.dispositions = [{field: 'rate', action: 'modify', basis: 'rate-check'}];
      h.receipt.record.fields = h.receipt.record.fields.map(f => f.id === 'rate' ? {id: 'rate', value: 0.045, kind: 'derived', sources: ['rate-check']} : f);
      return h;
    })(),
    expected: {status: 'non-conformant', violations: ['reconciled-basis:rate'], warnings: [],
      counts: {accept: 0, verify: 0, re_derive: 0, contest: 0, modify: 1, drop: 0}, pendingReveal: []}},
  {id: 'v03-hop-computed-value-as-evidence', kind: 'hop', origin: 'v0.3-new',
    why: 'Control case: the same basis computed from its inputs, not adjusted to agree with them, may support a verification.',
    input: hop('computed'),
    expected: {status: 'conformant', violations: [], warnings: [], counts, pendingReveal: []}}
];

const notEstablished = 'not-established';
const hiddenReconciliation = {...structuredClone(derived), fields: withField(structuredClone(derived.fields), 'p-early-nov',
  {id: 'p-early-nov', value: 0.55, kind: 'derived', sources: ['outlet-c'], derivation: {operation: 'computed', inputs: ['outlet-c'], sufficient: ['outlet-c']}})};
const sealedRecord = {...structuredClone(derived), fields: [...structuredClone(derived.fields),
  {id: 'thesis', kind: 'derived', sources: ['outlet-a'], expect: 're_derive', sealed: {alg: 'sha256-jcs', commitment: '0'.repeat(64)},
    derivation: {operation: 'computed', inputs: ['outlet-a'], sufficient: ['outlet-a']}}]};

const seatRecord = {id: 'belief-history', parent: null, author: {actor: 'https://example.org/forecaster', lineage: 'anthropic/claude'}, objections: [],
  fields: withField(revisions, 'step-5', {id: 'step-5', value: 0.035, kind: 'derived', sources: ['outlet-5'], derivation: {operation: 'computed', inputs: ['outlet-5'], sufficient: ['outlet-5']}})};
export const v03ReplayCases = [
  {id: 'v031-replay-same-lineage-seat', kind: 'replay', origin: 'external-counterexample', source: T2_SEAT,
    why: 'terminator2-agent: if the replayer is another instance of the same model, its derivation is the author\'s own with the prior deleted from context but not from the machine. It returns 0.035, the replay is confirmed, and the belief stays undetected. The result must say so.',
    input: {record: seatRecord, replay: {field: 'step-5', method: 'sufficiency', input: 'outlet-5', value: 0.035, by: 'another instance of the author\'s model', lineage: 'anthropic/claude'}},
    expected: {status: 'confirmed', reproduced: true, independence: notEstablished, problems: [], warnings: ['same-lineage-replay']}},
  {id: 'v031-replay-other-lineage-seat', kind: 'replay', origin: 'external-proposal', source: T2_SEAT,
    why: 'The experiment he proposes: hand the source of step four to a model of another lineage with no prior. If it returns 0.35, the value did not come from its source.',
    input: {record: seatRecord, replay: {field: 'step-5', method: 'sufficiency', input: 'outlet-5', value: 0.35, by: 'a replayer of another lineage, without the earlier steps', lineage: 'openai/gpt'}},
    expected: {status: 'refuted', reproduced: false, independence: notEstablished, problems: [], warnings: []}},
  {id: 'v031-replay-seat-undeclared', kind: 'replay', origin: 'v0.3.1-new', source: T2_SEAT,
    why: 'A replay that does not say who ran it cannot be weighed: the schema cannot observe the replayer\'s priors, so it must require them to be declared.',
    input: {record: derived, replay: {field: 'p-oct31', method: 'sufficiency', input: 'outlet-a', value: 0.53}},
    expected: {status: 'confirmed', reproduced: true, independence: notEstablished, problems: [], warnings: ['replayer-lineage-undeclared']}},
  {id: 'v03-replay-sufficiency-confirmed', kind: 'replay', origin: 'external-proposal', source: T2_VALUE,
    why: 'terminator2-agent: a sufficiency declaration ("this root alone yields this value") is falsifiable: hand the root to a third party and see whether the value comes back. Here it does.',
    input: {record: derived, replay: {field: 'p-oct31', method: 'sufficiency', input: 'outlet-a', value: 0.53, by: 'https://example.org/agent-c'}},
    expected: {status: 'confirmed', reproduced: true, independence: notEstablished, problems: []}},
  {id: 'v03-replay-sufficiency-refuted', kind: 'replay', origin: 'external-counterexample', source: T2_VALUE,
    why: 'The incident: the value claims to come from its outlet alone, but the outlet alone yields 0.33, not 0.55. The value came from somewhere else, here a sibling it was adjusted to.',
    input: {record: hiddenReconciliation, replay: {field: 'p-early-nov', method: 'sufficiency', input: 'outlet-c', value: 0.33}},
    expected: {status: 'refuted', reproduced: false, independence: notEstablished, problems: []}},
  {id: 'v03-replay-monotone-revision-refuted', kind: 'replay', origin: 'external-counterexample', source: T2_MONOTONE,
    why: 'terminator2-agent: hand step four\'s source to someone who has not seen the earlier steps and ask what value it yields alone. If the honest answer is 0.35, not 0.035, the record is clean and the value is not.',
    note: MONOTONE_NOTE,
    input: {record: {id: 'belief-history', parent: null, author, objections: [], fields: withField(revisions, 'step-5',
      {id: 'step-5', value: 0.035, kind: 'derived', sources: ['outlet-5'], derivation: {operation: 'computed', inputs: ['outlet-5'], sufficient: ['outlet-5']}})},
      replay: {field: 'step-5', method: 'sufficiency', input: 'outlet-5', value: 0.35, by: 'a replayer who has not seen the earlier steps'}},
    expected: {status: 'refuted', reproduced: false, independence: notEstablished, problems: []}},
  {id: 'v03-replay-undeclared-sufficiency', kind: 'replay', origin: 'external-proposal', source: HEYCHAT_EVENT,
    why: 'heychat: the "same without the source" test is strong, but unavailability can change the generation path; a replay that reproduces a value from an input nobody declared sufficient proves nothing about how it was produced.',
    input: {record: derived, replay: {field: 'p-oct31', method: 'sufficiency', input: 'outlet-c', value: 0.53}},
    expected: {status: 'undeclared', reproduced: true, independence: notEstablished, problems: []}},
  {id: 'v03-replay-quote-still-present', kind: 'replay', origin: 'external-proposal', source: PRISM,
    why: 'prismdeadlines: a cheap consistency check without re-deriving anything: is the quoted sentence still in the source?',
    input: {record: derived, replay: {field: 'outlet-a', method: 'quote', sourceText: 'Markets. ' + QUOTE + ' The date is not final.'}},
    expected: {status: 'confirmed', reproduced: true, independence: notEstablished, problems: []}},
  {id: 'v03-replay-quote-changed', kind: 'replay', origin: 'external-proposal', source: PRISM,
    why: 'The source now says something else: the quotation no longer supports the value.',
    input: {record: derived, replay: {field: 'outlet-a', method: 'quote', sourceText: 'Markets. Bankers now expect the listing in November.'}},
    expected: {status: 'refuted', reproduced: false, independence: notEstablished, problems: []}},
  {id: 'v03-replay-sealed-value', kind: 'replay', origin: 'v0.3-new',
    why: 'A sealed value cannot be compared before its reveal.',
    input: {record: sealedRecord, replay: {field: 'thesis', method: 'sufficiency', input: 'outlet-a', value: 0.58}},
    expected: {status: 'invalid', reproduced: null, independence: notEstablished, problems: ['value-unavailable']}},
  {id: 'v03-replay-without-derivation', kind: 'replay', origin: 'v0.3-new', source: HEYCHAT,
    why: 'Nothing declared, nothing to test: a replay needs a declared derivation.',
    input: {record: {...structuredClone(derived), fields: withField(structuredClone(derived.fields), 'p-oct31', {id: 'p-oct31', value: 0.53, kind: 'derived', sources: ['outlet-a']})},
      replay: {field: 'p-oct31', method: 'sufficiency', input: 'outlet-a', value: 0.53}},
    expected: {status: 'invalid', reproduced: null, independence: notEstablished, problems: ['derivation-undeclared']}}
];
