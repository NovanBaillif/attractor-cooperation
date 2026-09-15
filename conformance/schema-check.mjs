// Shape check: every input the suite expects to be conformant (or green) must satisfy the schema.
// Needs Ajv: run `npm install` once at the repository root.
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';

const schema = JSON.parse(readFileSync(new URL('../schema/transmission.schema.json', import.meta.url), 'utf8'));
const {cases} = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
const ajv = new Ajv({strict: true, strictRequired: false, allErrors: true});
ajv.addSchema(schema);
const check = def => ajv.getSchema(`${schema.$id}#/$defs/${def}`);
const [record, receipt, reveal] = ['record', 'receipt', 'reveal'].map(check);

const good = c => (c.kind === 'record' && c.expected.status === 'conformant') ||
  (c.kind === 'hop' && c.expected.status === 'conformant') ||
  (c.kind === 'reveal' && c.expected.status === 'verified') ||
  (c.kind === 'drift' && c.expected.level === 'green');
const errors = [];
let validated = 0, shapeInvalidAmongViolations = 0, violationCases = 0;
for (const c of cases.filter(c => ['record', 'hop', 'reveal', 'drift'].includes(c.kind))) {
  const parts = c.kind === 'record' ? [[record, c.input]]
    : [[record, c.input.sent], [receipt, c.input.receipt], ...(c.input.reveal ? [[reveal, c.input.reveal]] : [])];
  const valid = parts.every(([validate, value]) => validate(value));
  if (good(c)) {
    validated += 1;
    if (!valid) errors.push({id: c.id, errors: parts.flatMap(([v, value]) => v(value) ? [] : v.errors)});
  } else {
    violationCases += 1;
    if (!valid) shapeInvalidAmongViolations += 1;
  }
}
console.log(JSON.stringify({conformant_inputs_validated: validated, schema_errors: errors,
  violation_cases: violationCases, violation_cases_also_rejected_by_schema: shapeInvalidAmongViolations}, null, 2));
process.exit(errors.length ? 1 : 0);
