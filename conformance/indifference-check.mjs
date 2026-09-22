// Does the suite catch an implementation that never reads `supersedes`?
//
// Covering both forms of a field and being able to detect an error are different measurements, and a suite
// reports the first (terminator2-agent, AI Village #85, 19-20 September 2026). He measured the case set of the
// v0.1 trial: `supersedes` appears in none of its 16 cases, so an implementation indifferent to the field
// passed it exactly like a correct one. This check measures the same thing for this suite, case by case.
//
// Method: for every dispute case whose input carries `supersedes`, run the reference checker twice — on the
// case as written, and on the same input with every `supersedes` member deleted. A case detects indifference
// when the two results differ, because an implementation that ignores the field cannot tell those inputs apart
// and therefore returns the second result for the first input.
//
//   node conformance/indifference-check.mjs [path to an implementation]
// Exit code 1 if no case detects it, or if a case's own expected result is not what the reference returns.
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const implPath = process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href
  : new URL('../reference/index.mjs', import.meta.url).href;
const {inspectDispute} = await import(implPath);
const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8')).cases
  .filter(c => c.kind === 'dispute' && JSON.stringify(c.input).includes('"supersedes"'));

const outcome = r => ({status: r.status, warnings: [...(r.warnings ?? [])].sort()});
const withoutField = input => {
  const copy = structuredClone(input);
  for (const source of copy.sources ?? []) delete source.supersedes;
  return copy;
};

let detecting = 0, mismatched = 0;
console.log('case | as written | with supersedes deleted | detects indifference');
for (const c of cases) {
  const asWritten = outcome(inspectDispute(c.input));
  const deleted = outcome(inspectDispute(withoutField(c.input)));
  const detects = !isDeepStrictEqual(asWritten, deleted);
  if (detects) detecting++;
  const expected = {status: c.expected.status, warnings: [...(c.expected.warnings ?? [])].sort()};
  if (!isDeepStrictEqual(asWritten, expected)) { mismatched++; console.log(`MISMATCH ${c.id}: reference returns ${JSON.stringify(asWritten)}, case expects ${JSON.stringify(expected)}`); }
  const show = o => o.status + (o.warnings.length ? ' + ' + o.warnings.join(',') : '');
  console.log(`${detects ? 'yes' : 'no '}  ${c.id}\n     as written: ${show(asWritten)}\n     field gone: ${show(deleted)}`);
}
console.log(`\n${cases.length} cases carry \`supersedes\`; ${detecting} of them detect an implementation that never reads it.`);
if (mismatched) { console.log(`${mismatched} case(s) disagree with the reference checker.`); process.exitCode = 1; }
if (detecting === 0) { console.log('No case in this suite would fail such an implementation.'); process.exitCode = 1; }
