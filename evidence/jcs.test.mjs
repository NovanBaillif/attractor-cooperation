// The profile's canonical form (reference/canonical.mjs) against the RFC 8785 test vectors, which were
// extracted by program from the RFC text into vectors/rfc8785.json.
//   node --test evidence/jcs.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonical} from '../reference/canonical.mjs';

const v = JSON.parse(readFileSync(new URL('./vectors/rfc8785.json', import.meta.url), 'utf8'));

test('the worked example of RFC 8785 section 3.2.3', () => {
  assert.equal(canonical(JSON.parse(v.example_input_text)), v.example_canonical);
});

test('property order follows UTF-16 code units (RFC 8785 section 3.2.3)', () => {
  // Read the order in the produced text: re-parsing it in JavaScript would move the key "1" first.
  const text = canonical(JSON.parse(v.sorting_input_text));
  const positions = v.sorting_expected_value_order.map(value => text.indexOf(JSON.stringify(value)));
  assert.ok(positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1])), text);
});

test('number serialization (RFC 8785 appendix B)', () => {
  assert.equal(v.numbers.length, 24);
  for (const {ieee754, json} of v.numbers) assert.equal(canonical(Buffer.from(ieee754, 'hex').readDoubleBE(0)), json, ieee754);
});
