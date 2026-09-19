// Builds the Evidence profile examples from one real execution, then checks them with the profile's own
// schema and reference checks. Nothing here is invented: the observation and the replay are two calls to
// ATTRACTOR's `fingerprint_json` tool made on 19 September 2026 (server dates below), and the verification
// is an independent recomputation of the same digest with GNU coreutils `sha256sum`.
//   node evidence/build-examples.mjs
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import {canonical, sha256} from '../reference/canonical.mjs';
import {inspectRecord, inspectHop, inspectReplay} from '../reference/index.mjs';

const here = new URL('./', import.meta.url);
const TOOL = 'https://attractor-observatory-demo.vercel.app/api/v2/agent-tools/fingerprint_json';
const INPUT_SCHEMA = {type: 'object', properties: {value: {}}, required: ['value'], additionalProperties: false};
const input = {value: {b: 1, a: 2}};
const output = {fingerprint: 'd3626ac30a87e6f7a6428233b3c68299976865fa5508e4267c5415c76af7a772',
  algorithm: 'sha256', canonicalization: 'attractor-recursive-key-sort-v1'};
const actor = 'https://attractor-observatory-demo.vercel.app/#operator';

// The capability, identified inside `upstream` only: the 0.6 schema accepts no new member, so the tool's
// identity rides on the URI (server name and version, SHA-256 of the canonical input schema).
const upstream = `${TOOL}#server=attractor-machine-commons@3.0.0;input-schema=sha256:${sha256(canonical(INPUT_SCHEMA))}`;

const observation = {id: 'obs-fingerprint-json-2026-09-19T10:00:40Z', parent: null,
  author: {actor, lineage: 'anthropic/claude'},
  fields: [{id: 'result', value: output, kind: 'observed', sources: [], channel: 'direct', upstream, expect: 'verify',
    observedAt: '2026-09-19T10:00:40Z',
    derivation: {operation: 'measured', inputs: [], witness: [{input, output}]}}],
  objections: []};

// A verification is a receipt that KEEPS the field unchanged and names, as `basis`, another field of the
// receiver's record holding the evidence (SPEC 7.4). Here the evidence is a recomputation of the digest by a
// different implementation, with nothing taken from the tool but the input.
const { expect: _dropped, ...keptResult } = observation.fields[0];
const verification = {id: 'receipt-fingerprint-json-2026-09-19', target: observation.id,
  dispositions: [{field: 'result', action: 'verify', basis: 'recompute'}],
  record: {id: 'rec-verified-fingerprint-json', parent: observation.id,
    author: {actor: 'https://attractor-observatory-demo.vercel.app/#operator-shell', lineage: 'human'},
    fields: [keptResult,
      {id: 'recompute', value: {tool: 'GNU coreutils sha256sum', text: canonical(input.value),
        digest: sha256(canonical(input.value))},
        kind: 'observed', sources: [], channel: 'direct', upstream: 'urn:attractor:local-recompute:sha256sum',
        derivation: {operation: 'measured', inputs: []}}],
    objections: []}};

const replay = {field: 'result', method: 'witness', by: actor, lineage: 'anthropic/claude', produced: [output]};

// Shape, with the profile's own schema.
const schema = JSON.parse(readFileSync(new URL('../schema/transmission.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv({strict: false, allErrors: true}); ajv.addSchema(schema);
const shape = def => ajv.getSchema(`${schema.$id}#/$defs/${def}`);
const report = {};
for (const [name, def, value] of [['observation', 'record', observation], ['verification', 'receipt', verification], ['replay', 'replay', replay]]) {
  const v = shape(def); report[name + '_shape'] = v ? v(value) : 'no-schema-def';
  if (v && !v(value)) report[name + '_errors'] = v.errors;
}
report.observation_check = inspectRecord(observation);
report.verification_check = inspectHop({sent: observation, receipt: verification});
report.replay_check = inspectReplay({record: observation, replay});
report.independent_recompute = {tool: 'GNU coreutils sha256sum', text: canonical(input.value), digest: sha256(canonical(input.value)),
  matches: sha256(canonical(input.value)) === output.fingerprint};

mkdirSync(new URL('./examples/', here), {recursive: true});
for (const [f, v] of [['observation.json', observation], ['verification.json', verification], ['replay.json', replay], ['checks.json', report]])
  writeFileSync(new URL('./examples/' + f, here), JSON.stringify(v, null, 2) + '\n');
console.log(JSON.stringify({shapes: [report.observation_shape, report.verification_shape, report.replay_shape],
  observation: report.observation_check?.status ?? report.observation_check, hop: report.verification_check?.status ?? report.verification_check,
  replay: {status: report.replay_check.status, warnings: report.replay_check.warnings, independence: report.replay_check.independence},
  recompute: report.independent_recompute.matches}, null, 1));
