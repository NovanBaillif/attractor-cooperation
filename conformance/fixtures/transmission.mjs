// Record, hop, reveal and drift fixtures around one synthetic hop A -> B (SPEC sections 7.3-7.5, 8).
// Expected outcomes are written by hand. Commitments hash a literal preimage string; receipt digests
// are recomputed independently by conformance/cross-check.py.
import {createHash} from 'node:crypto';
import {digestOf} from '../../reference/canonical.mjs';

const hash = text => createHash('sha256').update(text, 'utf8').digest('hex');
const THESIS_COMMITMENT = hash('{"field":"thesis","salt":"salt-a-thesis","value":0.58}');
const VENUE = 'https://venue.example/api', REGISTRY = 'https://registry.example/filings';
const clone = value => structuredClone(value);

const venueRead = {id: 'venue-read', value: 0.71, kind: 'observed', sources: [], channel: 'direct', upstream: VENUE};
const analystNote = {id: 'analyst-note', value: 'base rate 0.55, one new filing', kind: 'observed', sources: [], channel: 'direct'};
const estimate = {id: 'estimate', value: 0.62, kind: 'derived', sources: ['analyst-note', 'venue-read'],
  uncertainty: {type: 'interval', low: 0.55, high: 0.7}};
const objA = {id: 'obj-a-1', target: 'estimate', proposedValue: 0.5, by: 'https://example.org/agent-c',
  basis: {sourceId: 'analyst-note', citation: 'secondary'}};

const baseSent = {id: 'rec-a-1', parent: null,
  author: {actor: 'https://example.org/agent-a', lineage: 'example/lineage-a'},
  fields: [venueRead, analystNote, {...estimate, expect: 'verify'},
    {id: 'thesis', kind: 'derived', sources: ['analyst-note'], expect: 're_derive',
      sealed: {alg: 'sha256-jcs', commitment: THESIS_COMMITMENT}}],
  objections: [objA]};

const filingCheck = {id: 'filing-check', value: 'one new filing, no change to base rate', kind: 'observed',
  sources: [], channel: 'direct', upstream: REGISTRY};
const baseReceipt = {id: 'receipt-b-1', target: 'rec-a-1',
  dispositions: [{field: 'venue-read', action: 'accept'}, {field: 'analyst-note', action: 'accept'},
    {field: 'estimate', action: 'verify', basis: 'filing-check'}, {field: 'thesis', action: 're_derive'}],
  record: {id: 'rec-b-1', parent: 'rec-a-1', author: {actor: 'https://example.org/agent-b', lineage: 'example/lineage-b'},
    fields: [venueRead, analystNote, estimate, filingCheck,
      {id: 'thesis', value: 0.58, kind: 'derived', sources: ['analyst-note', 'filing-check']}],
    objections: [objA]}};

// Small editing helpers: each case is the base hop with one deliberate change.
const sentWith = edit => { const s = clone(baseSent); edit(s); return s; };
const receiptWith = edit => { const r = clone(baseReceipt); edit(r); return r; };
const field = (record, id) => record.fields.find(f => f.id === id);
const setDisposition = (r, id, d) => { r.dispositions = r.dispositions.filter(x => x.field !== id).concat(d ? [{field: id, ...d}] : []); };
const replaceField = (record, id, next) => { record.fields = record.fields.filter(f => f.id !== id).concat(next ? [next] : []); };
const reveal = (receipt, value = 0.58, salt = 'salt-a-thesis') =>
  ({target: receipt.id, receiptDigest: digestOf(receipt), reveals: [{field: 'thesis', value, salt}]});
const counts = (o = {}) => ({accept: 2, verify: 1, re_derive: 1, contest: 0, modify: 0, drop: 0, ...o});

const record = (id, why, edit, expected) => ({id, kind: 'record', origin: 'v0.2-new', why, input: sentWith(edit), expected});
const hop = (id, why, edit, expected) => ({id, kind: 'hop', origin: 'v0.2-new', why,
  input: {sent: baseSent, receipt: receiptWith(edit)}, expected});
const ok = {status: 'conformant', violations: []};
const bad = (...violations) => ({status: 'non-conformant', violations});

export const recordCases = [
  record('v02-record-clean', 'Base record: provenance per field, one value sealed for independent re-derivation.', () => {},
    {...ok, warnings: []}),
  record('v02-record-sealed-value-leaks-through-dependent', 'A field computed from the sealed value reveals it; sealing would be theatre.',
    s => s.fields.push({id: 'thesis-rounded', value: 0.6, kind: 'derived', sources: ['thesis']}),
    bad('sealed-value-leak:thesis-rounded')),
  record('v02-record-re-derive-requested-without-seal', 'Asking for re-derivation while showing the value makes copying and re-deriving indistinguishable.',
    s => replaceField(s, 'thesis', {id: 'thesis', value: 0.58, kind: 'derived', sources: ['analyst-note'], expect: 're_derive'}),
    bad('re-derive-unsealed:thesis')),
  record('v02-record-sealed-field-still-carries-value', 'A sealed field must not carry its value.',
    s => { field(s, 'thesis').value = 0.58; }, bad('sealed-value-present:thesis')),
  record('v02-record-seal-without-re-derive-request', 'A seal only makes sense for a field the receiver must re-derive.',
    s => { field(s, 'thesis').expect = 'accept'; }, bad('sealed-without-re-derive:thesis')),
  record('v02-record-objection-target-missing', 'An objection must point at a field of the record.',
    s => { s.objections[0].target = 'ghost'; }, bad('objection-target-missing:obj-a-1')),
  record('v02-record-objection-without-basis', 'An objection must say where it comes from, or declare citation "none".',
    s => { delete s.objections[0].basis; }, bad('objection-basis-missing:obj-a-1')),
  record('v02-record-observed-without-channel', 'Allowed, but the receiver will never be able to conclude independence from this root.',
    s => { delete field(s, 'analyst-note').channel; }, {...ok, warnings: ['observed-channel-undeclared:analyst-note']}),
  record('v02-record-truncated-provenance', 'A source referenced by a field is missing from the record.',
    s => replaceField(s, 'venue-read', null), bad('provenance-truncated:estimate')),
  record('v02-record-derived-without-sources', 'A derived field must name what it was derived from.',
    s => { field(s, 'estimate').sources = []; }, bad('inconsistent-provenance:estimate')),
  record('v02-record-duplicate-field-id', 'Found by the blind implementation: a repeated id is not indexed at all, so its dependents lose their source whatever the order.',
    s => s.fields.push({id: 'analyst-note', value: 'another note', kind: 'observed', sources: []}),
    {...bad('missing-or-duplicate-field-id', 'provenance-truncated:estimate', 'provenance-truncated:thesis'), warnings: []})
];

const contestObjection = basis => ({id: 'obj-b-1', target: 'venue-read', proposedValue: 0.69,
  by: 'https://example.org/agent-b', ...(basis ? {basis} : {})});

export const hopCases = [
  hop('v02-hop-clean', 'Accept two observations, verify the estimate against an independent source, re-derive the sealed thesis.',
    () => {}, {...ok, warnings: [], counts: counts(), pendingReveal: ['thesis']}),
  hop('v02-hop-derived-field-relabelled-as-observation', 'Laundering by relay: B accepts a derived estimate and republishes it as its own direct observation.',
    r => { setDisposition(r, 'estimate', {action: 'accept'});
      replaceField(r.record, 'estimate', {id: 'estimate', value: 0.62, kind: 'observed', sources: [], channel: 'direct'}); },
    {...bad('altered-on-accept:estimate'), warnings: []}),
  hop('v02-hop-dropped-source-truncates-provenance', 'Dropping a field that a kept field depends on cuts its provenance.',
    r => { setDisposition(r, 'venue-read', {action: 'drop', reason: 'not needed downstream'}); replaceField(r.record, 'venue-read', null); },
    {...bad('provenance-truncated:estimate'), warnings: ['verification-unverifiable:estimate'], counts: counts({accept: 1, drop: 1})}),
  hop('v02-hop-objection-lost', 'An objection carried by A disappears at B.', r => { r.record.objections = []; },
    bad('objection-lost:obj-a-1')),
  hop('v02-hop-objection-kept-but-basis-dropped', 'The objection text survives but its basis does not: a sourced counterexample becomes a hunch.',
    r => { r.record.objections = [{...objA, basis: {citation: 'none'}}]; }, bad('objection-basis-lost:obj-a-1')),
  hop('v02-hop-contest-without-basis', 'B contests a value without saying where its objection comes from.',
    r => { setDisposition(r, 'venue-read', {action: 'contest', objection: 'obj-b-1'}); r.record.objections.push(contestObjection(null)); },
    {...bad('contest-without-basis:venue-read'), counts: counts({accept: 1, contest: 1})}),
  hop('v02-hop-contest-labelled-hunch', 'A declared hunch is a valid contest; the label is the information.',
    r => { setDisposition(r, 'venue-read', {action: 'contest', objection: 'obj-b-1'}); r.record.objections.push(contestObjection({citation: 'none'})); },
    {...ok, warnings: [], counts: counts({accept: 1, contest: 1})}),
  hop('v02-hop-circular-verification', 'B "verifies" the estimate with a field computed from the estimate itself.',
    r => { r.record.fields.push({id: 'estimate-check', value: 0.62, kind: 'derived', sources: ['estimate']});
      setDisposition(r, 'estimate', {action: 'verify', basis: 'estimate-check'}); },
    bad('circular-verification:estimate')),
  hop('v02-hop-verification-shares-an-input', 'B verifies against a fresh read of the same venue: a real check of the copy, not of the venue.',
    r => { r.record.fields.push({id: 'venue-read-b', value: 0.71, kind: 'observed', sources: [], channel: 'direct', upstream: VENUE});
      setDisposition(r, 'estimate', {action: 'verify', basis: 'venue-read-b'}); },
    {...ok, warnings: ['verification-partially-dependent:estimate']}),
  hop('v02-hop-sealed-field-accepted', 'A sealed field has no value to accept; only re-derivation or a declared drop is possible.',
    r => { setDisposition(r, 'thesis', {action: 'accept'});
      const {expect, ...shell} = field(baseSent, 'thesis'); replaceField(r.record, 'thesis', shell); },
    {...bad('sealed-field-not-re-derived:thesis'), pendingReveal: []}),
  hop('v02-hop-missing-disposition', 'Every field of A needs one explicit disposition.', r => setDisposition(r, 'analyst-note', null),
    bad('missing-disposition:analyst-note')),
  hop('v02-hop-modify-without-basis', 'B changes a value without saying on what basis.',
    r => { setDisposition(r, 'venue-read', {action: 'modify'}); field(r.record, 'venue-read').value = 0.69; },
    {...bad('modify-without-basis:venue-read'), warnings: ['ancestor-modified:estimate']}),
  hop('v02-hop-modify-with-basis', 'A sourced modification is conformant; the verified estimate now rests on a modified source and the human is told.',
    r => { r.record.fields.push({id: 'venue-read-b', value: 0.69, kind: 'observed', sources: [], channel: 'direct', upstream: VENUE});
      setDisposition(r, 'venue-read', {action: 'modify', basis: 'venue-read-b'});
      replaceField(r.record, 'venue-read', {id: 'venue-read', value: 0.69, kind: 'derived', sources: ['venue-read-b']}); },
    {...ok, warnings: ['ancestor-modified:estimate'], counts: counts({accept: 1, modify: 1})}),
  hop('v02-hop-parent-not-linked', 'B\'s record must point to A\'s record so the original stays reachable.',
    r => { r.record.parent = null; }, bad('parent-missing')),
  hop('v02-hop-re-derivation-of-unsealed-field', 'B re-derives a value it could see: allowed, but nothing distinguishes it from copying.',
    r => { setDisposition(r, 'estimate', {action: 're_derive'});
      replaceField(r.record, 'estimate', {id: 'estimate', value: 0.6, kind: 'derived', sources: ['analyst-note', 'filing-check']}); },
    {...ok, warnings: ['re-derivation-unprovable:estimate'], pendingReveal: ['thesis']}),
  hop('v02-hop-drop-without-reason', 'B may decline to re-derive a sealed field, but must say why.',
    r => { setDisposition(r, 'thesis', {action: 'drop'}); replaceField(r.record, 'thesis', null); },
    {...bad('drop-without-reason:thesis'), pendingReveal: []}),
  hop('v02-hop-disposition-for-unknown-field', 'A disposition for a field A never sent.',
    r => r.dispositions.push({field: 'ghost', action: 'accept'}), bad('unknown-field-disposition:ghost')),
  hop('v02-hop-same-lineage', 'A and B declare the same model lineage: their checks are correlated.',
    r => { r.record.author.lineage = 'example/lineage-a'; }, {...ok, warnings: ['same-lineage']}),
  hop('v02-hop-contest-overwrites-original', 'Contesting must not overwrite the contested value.',
    r => { setDisposition(r, 'venue-read', {action: 'contest', objection: 'obj-b-1'});
      r.record.objections.push(contestObjection({sourceId: 'https://venue.example/api/archive', citation: 'secondary'}));
      field(r.record, 'venue-read').value = 0.69; },
    bad('original-overwritten:venue-read')),
  hop('v02-hop-duplicate-dispositions-conflict', 'Found by the blind implementation (ambiguity 1): two dispositions for one field are reported and neither counts, so arrival order cannot pick one.',
    r => r.dispositions.push({field: 'venue-read', action: 'drop', reason: 'second thoughts'}),
    {...bad('duplicate-disposition:venue-read'), warnings: [], counts: counts({accept: 1})}),
  hop('v02-hop-circular-verification-through-dropped-field', 'Found by differential testing: a basis declared as derived from the verified field is circular even if that field is missing from B\'s record.',
    r => { replaceField(r.record, 'estimate', null);
      r.record.fields.push({id: 'estimate-check', value: 0.62, kind: 'derived', sources: ['estimate']});
      setDisposition(r, 'estimate', {action: 'verify', basis: 'estimate-check'}); },
    {...bad('altered-on-verify:estimate', 'circular-verification:estimate', 'provenance-truncated:estimate-check'), warnings: []}),
  hop('v02-hop-modified-field-missing-still-counts-as-source', 'Found by differential testing: a source named by a kept field counts as its ancestor even when it is missing, so the human is still told the estimate rests on a modified source.',
    r => { setDisposition(r, 'analyst-note', {action: 'modify'}); replaceField(r.record, 'analyst-note', null); },
    {...bad('modified-field-missing:analyst-note', 'modify-without-basis:analyst-note', 'provenance-truncated:estimate', 'provenance-truncated:thesis'),
      warnings: ['ancestor-modified:estimate', 'verification-unverifiable:estimate'], counts: counts({accept: 1, modify: 1})})
];

const disagreeing = receiptWith(r => { field(r.record, 'thesis').value = 0.6; });
const revealCase = (id, why, receipt, rv, expected) => ({id, kind: 'reveal', origin: 'v0.2-new', why,
  input: {sent: baseSent, receipt, reveal: rv}, expected});

export const revealCases = [
  revealCase('v02-reveal-sealed-agreement', 'B committed its value before seeing A\'s; they agree, and the log can prove the order.',
    baseReceipt, reveal(baseReceipt),
    {status: 'verified', results: [{field: 'thesis', commitment: 'match', outcome: 'agree'}], missing: [], violations: []}),
  revealCase('v02-reveal-sealed-disagreement', 'Independent re-derivation disagrees: the useful signal.',
    disagreeing, reveal(disagreeing),
    {status: 'verified', results: [{field: 'thesis', commitment: 'match', outcome: 'disagree'}], missing: [], violations: []}),
  revealCase('v02-reveal-commitment-mismatch', 'The revealed salt does not open the commitment.',
    baseReceipt, reveal(baseReceipt, 0.58, 'wrong-salt'),
    {status: 'invalid', results: [{field: 'thesis', commitment: 'mismatch', outcome: 'invalid'}], violations: ['commitment-mismatch:thesis']}),
  revealCase('v02-reveal-sender-changes-answer-after-seeing-receiver', 'A tries to reveal B\'s value instead of its own sealed value.',
    disagreeing, reveal(disagreeing, 0.6),
    {status: 'invalid', results: [{field: 'thesis', commitment: 'mismatch', outcome: 'invalid'}], violations: ['commitment-mismatch:thesis']}),
  revealCase('v02-reveal-receipt-edited-after-reveal', 'B edits its receipt to agree after the reveal; the digest bound in the reveal no longer matches.',
    baseReceipt, {...reveal(disagreeing, 0.58), target: baseReceipt.id},
    {status: 'invalid', results: [{field: 'thesis', commitment: 'match', outcome: 'agree'}], violations: ['receipt-digest-mismatch']}),
  revealCase('v02-reveal-missing', 'A has not revealed yet: the re-derivation is pending, not failed.',
    baseReceipt, {...reveal(baseReceipt), reveals: []},
    {status: 'incomplete', results: [], missing: ['thesis'], violations: []}),
  revealCase('v02-reveal-wrong-target', 'The reveal answers another receipt.',
    baseReceipt, {...reveal(baseReceipt), target: 'receipt-b-9'},
    {status: 'invalid', violations: ['reveal-target-mismatch']}),
  revealCase('v02-reveal-duplicate-items', 'Found by the blind implementation (ambiguity 1): a field revealed twice, with two different values, is reported and neither item is used.',
    baseReceipt, {...reveal(baseReceipt), reveals: [{field: 'thesis', value: 0.58, salt: 'salt-a-thesis'}, {field: 'thesis', value: 0.6, salt: 'salt-a-thesis'}]},
    {status: 'invalid', results: [], missing: ['thesis'], violations: ['duplicate-or-invalid-reveal']})
];

const sameLineage = receiptWith(r => { r.record.author.lineage = 'example/lineage-a'; });
const driftCase = (id, why, receipt, rv, expected) => ({id, kind: 'drift', origin: 'v0.2-new', why,
  input: {sent: baseSent, receipt, ...(rv ? {reveal: rv} : {})}, expected});

export const driftCases = [
  driftCase('v02-drift-green', 'Conformant hop, independent verification, sealed re-derivation agrees.', baseReceipt, reveal(baseReceipt),
    {level: 'green', counts: {...counts(), re_derive_agree: 1, re_derive_disagree: 0}, violations: [], pendingReveal: []}),
  driftCase('v02-drift-orange-disagreement', 'Conformant, but the independent re-derivation disagrees.', disagreeing, reveal(disagreeing),
    {level: 'orange', counts: {...counts(), re_derive_agree: 0, re_derive_disagree: 1}}),
  driftCase('v02-drift-orange-awaiting-reveal', 'Conformant, but A has not revealed the sealed value yet.', baseReceipt, null,
    {level: 'orange', pendingReveal: ['thesis']}),
  driftCase('v02-drift-red-objection-lost', 'Any violation makes the hop red, whatever else is fine.',
    receiptWith(r => { r.record.objections = []; }), null, {level: 'red', violations: ['receiver/objection-lost:obj-a-1']}),
  driftCase('v02-drift-orange-same-lineage', 'Everything agrees, but between two agents of the same lineage.', sameLineage, reveal(sameLineage),
    {level: 'orange', warnings: ['receiver/same-lineage']})
];
