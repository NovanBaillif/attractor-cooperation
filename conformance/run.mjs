// Conformance replay for attractor-cooperation/0.2. Node only: no packages, network or writes.
//   node run.mjs                                  -> reference implementation, bundled cases
//   node run.mjs ./my-impl.mjs [my-cases.json]   -> any ESM module exporting the six functions
// Every case is run; all mismatches are listed; exit code 1 if any case fails.
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const implPath = process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href
  : new URL('../reference/index.mjs', import.meta.url).href;
const casesPath = process.argv[3] ? resolve(process.argv[3]) : new URL('./cases.json', import.meta.url);
const impl = await import(implPath);
const loaded = JSON.parse(readFileSync(casesPath, 'utf8'));
const cases = Array.isArray(loaded) ? loaded : loaded.cases;

const CHECKS = {
  lineage: ['inspectLineage', input => input],
  dispute: ['inspectDispute', input => input],
  record: ['inspectRecord', input => input],
  hop: ['inspectHop', input => input],
  reveal: ['inspectReveal', input => input],
  drift: ['driftReport', input => input]
};

// Arrival order must never change a decision (SPEC section 10). Receipt arrays are left alone for
// reveal and drift because the receipt digest binds their exact order.
function reorder(kind, input) {
  const copy = structuredClone(input);
  const flip = array => Array.isArray(array) ? array.reverse() : array;
  if (kind === 'lineage') { flip(copy.fields); copy.fields?.forEach(f => flip(f?.sources)); }
  if (kind === 'dispute') flip(copy.sources);
  if (kind === 'record') { flip(copy.fields); flip(copy.objections); }
  if (kind === 'hop') {
    flip(copy.sent?.fields); flip(copy.sent?.objections); flip(copy.receipt?.dispositions);
    flip(copy.receipt?.record?.fields); flip(copy.receipt?.record?.objections);
  }
  if (kind === 'reveal' || kind === 'drift') flip(copy.reveal?.reveals);
  return copy;
}

const failures = [], results = [];
for (const c of cases) {
  const [name] = CHECKS[c.kind] ?? [];
  const fn = impl[name];
  const problems = [];
  if (typeof fn !== 'function') problems.push(`missing export ${name ?? c.kind}`);
  else {
    const before = structuredClone(c.input);
    let actual;
    try { actual = fn(structuredClone(c.input)); } catch (error) { problems.push('threw: ' + error.message); }
    const mutated = structuredClone(c.input);
    try { fn(mutated); } catch { /* reported above */ }
    if (!isDeepStrictEqual(mutated, before)) problems.push('input mutated');
    if (actual) {
      for (const [key, expected] of Object.entries(c.expected)) {
        if (!isDeepStrictEqual(actual[key], expected)) {
          problems.push(`${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual[key])}`);
        }
      }
      let again;
      try { again = fn(reorder(c.kind, c.input)); } catch (error) { problems.push('reordered input threw: ' + error.message); }
      if (again && !isDeepStrictEqual(again, actual)) problems.push('arrival order changed the result');
      if (c.kind === 'dispute' && actual.applied !== false) problems.push('a revision was applied');
      if (c.kind === 'dispute' && !isDeepStrictEqual(actual.original, before.claim)) problems.push('original claim lost');
      if (c.kind === 'dispute' && !isDeepStrictEqual(actual.objection, before.objection)) problems.push('objection lost');
    }
  }
  results.push({id: c.id, kind: c.kind, passed: problems.length === 0});
  if (problems.length) failures.push({id: c.id, kind: c.kind, problems});
}

const byKind = Object.fromEntries(Object.keys(CHECKS).map(kind => {
  const own = results.filter(r => r.kind === kind);
  return [kind, `${own.filter(r => r.passed).length}/${own.length}`];
}));
console.log(JSON.stringify({implementation: process.argv[2] ?? 'reference', total: cases.length,
  passed: results.filter(r => r.passed).length, byKind, failures}, null, 2));
process.exit(failures.length ? 1 : 0);
