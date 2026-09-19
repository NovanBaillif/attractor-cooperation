// Extracts the RFC 8785 test vectors from the RFC text into rfc8785.json, by program, so that no vector is
// transcribed by hand. Usage: node evidence/vectors/extract-rfc8785.mjs <path to rfc8785.txt>
// Source: https://www.rfc-editor.org/rfc/rfc8785.txt
import {readFileSync, writeFileSync} from 'node:fs';

const rfc = readFileSync(process.argv[2], 'utf8').split('\n');
const find = needle => { const i = rfc.findIndex(l => l.includes(needle)); if (i < 0) throw Error('not found: ' + needle); return i; };

// Section 3.2.2: the object parsed, from its opening brace to its closing brace.
const open = find('"numbers": [333333333.33333329') - 1, close = find('"literals": [null, true, false]') + 1;
const exampleInput = rfc.slice(open, close + 1).join('\n');
// Section 3.2.3: the canonical form, printed on two lines "for display purposes only".
const c = find('{"literals":[null,true,false],"numbers":[333333333.3333333,');
const exampleCanonical = rfc[c].trim() + rfc[c + 1].trim();
// Section 3.2.3: the sorting sample and the expected order of its values.
const s = find('"\\u20ac": "Euro Sign"') - 1;
const e = find('"\\u00f6": "Latin Small Letter O With Diaeresis"') + 1;
const sortingInput = rfc.slice(s, e + 1).join('\n');
const o = find('Expected argument order after sorting');
const order = rfc.slice(o + 1, o + 12).map(l => l.trim()).filter(l => l.startsWith('"')).map(l => JSON.parse(l));
// Appendix B: IEEE 754 value in hexadecimal and its JSON text. NaN and infinities have no JSON form.
const numbers = [];
for (const line of rfc) {
  const m = line.match(/^\s*\|\s*([0-9a-f]{16})\s*\|\s*(\S+)\s*\|/);
  if (m && Number.isFinite(Buffer.from(m[1], 'hex').readDoubleBE(0))) numbers.push({ieee754: m[1], json: m[2]});
}
for (const [name, text] of [['example', exampleInput], ['sorting', sortingInput]]) JSON.parse(text); // fails loudly if cut
if (order.length !== 7 || numbers.length !== 24) throw Error(`unexpected counts: ${order.length} keys, ${numbers.length} numbers`);
writeFileSync(new URL('./rfc8785.json', import.meta.url), JSON.stringify({
  source: 'RFC 8785 (https://www.rfc-editor.org/rfc/rfc8785.txt), extracted by evidence/vectors/extract-rfc8785.mjs, not transcribed by hand',
  example_input_text: exampleInput, example_canonical: exampleCanonical,
  sorting_input_text: sortingInput, sorting_expected_value_order: order, numbers}, null, 2) + '\n');
console.log(`extracted: 1 example, ${order.length} sorted keys, ${numbers.length} numbers`);
