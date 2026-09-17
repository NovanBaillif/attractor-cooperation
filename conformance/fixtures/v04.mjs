// 0.4 fixtures: worked cases carried with a declaration (SPEC 4.2.2), the witness replay (7.7), and the warning
// raised when a sender asks for verification while handing nothing that can be replayed (7.3).
// Expected outcomes are written by hand from the SPEC, never computed.
// Measured origin: experiment E15 of 16 September 2026, whose numbers are in the note below.
const E15 = 'https://attractor-observatory-demo.vercel.app/journal/';
const notEstablished = 'not-established';
const author = {actor: 'https://example.org/agent-a', lineage: 'example/lineage-a'};

// The procedure an agent hands to its successor, with the cases it claims to reproduce.
const rule = 'uppercase the identifier and keep its leading zeros';
const witness = [
  {input: {code: ' zz-001 '}, output: {code_registre: 'ZZ-001'}},
  {input: {code: 'ab-009'}, output: {code_registre: 'AB-009'}}
];
const handover = (derivation, expect = 'accept') => ({
  id: 'handover', parent: null, author, objections: [],
  fields: [
    {id: 'source-entry', value: 'previous entry of the register', kind: 'observed', sources: [], channel: 'direct', upstream: 'https://example.org/register/entry-1'},
    {id: 'procedure', value: rule, kind: 'derived', sources: ['source-entry'], expect, derivation}
  ]
});
const computed = {operation: 'computed', inputs: ['source-entry']};
const withWitness = {...computed, witness};
// The claim E15 put to the test: a memory that declares itself already verified.
const claimed = {...computed, verifiedOn: 'two fixed cases of the previous entry'};
const claimedWithWitness = {...withWitness, verifiedOn: 'two fixed cases of the previous entry'};

export const v04ReplayCases = [
  {id: 'v04-witness-confirmed', kind: 'replay', origin: 'v0.4-new', source: E15,
    why: 'A handed-over procedure carries the cases it claims to reproduce. The receiver runs them and gets the declared outputs: the declaration stands on its own evidence.',
    input: {record: handover(withWitness), replay: {field: 'procedure', method: 'witness', lineage: 'example/lineage-b',
      produced: [{code_registre: 'ZZ-001'}, {code_registre: 'AB-009'}]}},
    expected: {status: 'confirmed', reproduced: true, cases: {matched: 2, total: 2}, independence: notEstablished, problems: [], warnings: []}},
  {id: 'v04-witness-self-refuted', kind: 'replay', origin: 'measured', source: E15,
    why: 'E15: a memory whose stated rule fails the very cases it carries. This is the only form of false memory that was ever caught — 0 copies of the error out of 120, against 120 out of 120 when the same error came with a rule and reasons alone. The mismatch accuses the record, not the replayer, so the result says so.',
    input: {record: handover(withWitness), replay: {field: 'procedure', method: 'witness', lineage: 'example/lineage-b',
      produced: [{code_registre: 'zz-001'}, {code_registre: 'ab-009'}]}},
    expected: {status: 'refuted', reproduced: false, cases: {matched: 0, total: 2}, independence: notEstablished, problems: [], warnings: ['self-refuting-witness']}},
  {id: 'v04-witness-partial-refuted', kind: 'replay', origin: 'v0.4-new', source: E15,
    why: 'One case out of two coming back wrong is a refutation, not a score: a procedure that holds most of the time is still not the procedure that was declared.',
    input: {record: handover(withWitness), replay: {field: 'procedure', method: 'witness', lineage: 'example/lineage-b',
      produced: [{code_registre: 'ZZ-001'}, {code_registre: 'ab-009'}]}},
    expected: {status: 'refuted', reproduced: false, cases: {matched: 1, total: 2}, independence: notEstablished, problems: [], warnings: ['self-refuting-witness']}},
  {id: 'v04-witness-undeclared', kind: 'replay', origin: 'v0.4-new', source: E15,
    why: 'A procedure handed over with no case to run cannot be replayed at all. The check refuses rather than pretending the declaration was tested.',
    input: {record: handover(computed), replay: {field: 'procedure', method: 'witness', lineage: 'example/lineage-b',
      produced: [{code_registre: 'ZZ-001'}]}},
    expected: {status: 'invalid', reproduced: null, independence: notEstablished, problems: ['witness-undeclared'], warnings: []}},
  {id: 'v04-witness-count-mismatch', kind: 'replay', origin: 'v0.4-new', source: E15,
    why: 'A replay that answers a different number of cases than were declared is not a replay of that declaration.',
    input: {record: handover(withWitness), replay: {field: 'procedure', method: 'witness', lineage: 'example/lineage-b',
      produced: [{code_registre: 'ZZ-001'}]}},
    expected: {status: 'invalid', reproduced: null, independence: notEstablished, problems: ['replay-produced-invalid'], warnings: []}},
  {id: 'v04-witness-same-lineage', kind: 'replay', origin: 'v0.4-new', source: E15,
    why: 'The seat rule of 0.3.1 applies to a witness replay as to any other: a replayer of the author\'s own lineage is not a second sample.',
    input: {record: handover(withWitness), replay: {field: 'procedure', method: 'witness', lineage: 'example/lineage-a',
      produced: [{code_registre: 'ZZ-001'}, {code_registre: 'AB-009'}]}},
    expected: {status: 'confirmed', reproduced: true, cases: {matched: 2, total: 2}, independence: notEstablished, problems: [], warnings: ['same-lineage-replay']}}
];

export const v04RecordCases = [
  {id: 'v04-record-verified-claim-without-witness', kind: 'record', origin: 'measured', source: E15,
    why: 'E15: the false memory announced itself as verified on eight fixed cases, and that sentence protected no one — the error was copied on 120 times out of 120. A claim of past verification whose cases do not travel with it is therefore flagged, so that a receiver knows the claim cannot be acted on.',
    input: handover(claimed),
    expected: {status: 'conformant', violations: [], warnings: ['verification-unsupported:procedure']}},
  {id: 'v04-record-verified-claim-with-witness', kind: 'record', origin: 'v0.4-new', source: E15,
    why: 'The same claim, with the cases that make it answerable, raises nothing.',
    input: handover(claimedWithWitness),
    expected: {status: 'conformant', violations: [], warnings: []}},
  {id: 'v04-record-no-claim-no-duty', kind: 'record', origin: 'v0.4-new', source: E15,
    why: 'A field that claims nothing about having been verified owes no cases: the profile adds a duty where a claim is made, not everywhere. Asking the receiver to verify against its own sources stays a clean transmission.',
    input: handover(computed, 'verify'),
    expected: {status: 'conformant', violations: [], warnings: []}},
  {id: 'v04-record-witness-malformed', kind: 'record', origin: 'v0.4-new', source: E15,
    why: 'Cases that are not pairs of an input and an output cannot be replayed by anyone; announcing them is worse than announcing nothing, so it is a violation and not a warning.',
    input: handover({...computed, witness: [{input: {code: 'zz-001'}}]}),
    expected: {status: 'non-conformant', violations: ['invalid-witness:procedure'], warnings: []}}
];
