// Turns a real run of the suite into the capability declaration proposed for 0.7
// (proposals/0.7-levels-and-capabilities.md): what an implementation demonstrably does, never what it says
// about itself. The level is derived from the counts and can never be written by hand.
//
//   node conformance/report.mjs                      -> the reference implementation
//   node conformance/report.mjs ./my-impl.mjs        -> any ESM module exporting the eight checks
//   node conformance/report.mjs ./my-impl.mjs --json -> the object alone, for pasting into a card
//
// It does not count anything itself: it runs conformance/run.mjs and reads its result, so a report and a
// conformance run can never disagree. Node only: no packages, no network, no writes.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const jsonOnly = process.argv.includes('--json');
const target = process.argv.slice(2).find(a => a !== '--json');
const runner = fileURLToPath(new URL('./run.mjs', import.meta.url));
const casesUrl = new URL('./cases.json', import.meta.url);

let raw;
try {
  raw = execFileSync(process.execPath, target ? [runner, target] : [runner], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
} catch (error) {
  // run.mjs exits 1 when cases fail: that is a result, not a crash. No stdout at all is a crash.
  raw = error.stdout ?? '';
  if (!raw.trim()) { console.error('the suite could not run this implementation:\n' + (error.stderr ?? error.message)); process.exit(1); }
}
const run = JSON.parse(raw);

// One check per kind of case, and the level each check belongs to.
const CHECK = {record: 'inspectRecord', lineage: 'inspectLineage', provenance: 'inspectProvenance',
  dispute: 'inspectDispute', hop: 'inspectHop', reveal: 'inspectReveal', replay: 'inspectReplay', drift: 'driftReport'};
const LEVEL = {L1: ['record', 'lineage', 'provenance'], L2: ['dispute', 'hop'], L3: ['reveal', 'replay', 'drift']};

const parse = kind => { const [p, t] = String(run.byKind[kind] ?? '0/0').split('/').map(Number); return {passed: p, total: t}; };
const checks = Object.fromEntries(Object.entries(CHECK).map(([kind, name]) => [name, run.byKind[kind] ?? '0/0']));
const complete = kinds => kinds.every(kind => { const c = parse(kind); return c.total > 0 && c.passed === c.total; });
const level = complete(LEVEL.L1) ? (complete(LEVEL.L2) ? (complete(LEVEL.L3) ? 'L3' : 'L2') : 'L1') : null;

let revision = null;
try { revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); } catch {}

const report = {
  profile: 'attractor-cooperation/0.5',
  suite: {revision, cases_sha256: createHash('sha256').update(readFileSync(casesUrl)).digest('hex'), total: run.total},
  runtime: `node ${process.versions.node}`,
  implementation: run.implementation,
  checks,
  level,
  produced_by: 'self',
  generated_at: new Date().toISOString().slice(0, 10),
};

console.log(JSON.stringify(report, null, 2));
if (jsonOnly) process.exit(0);
console.log(`\n${run.passed} of ${run.total} cases. Level: ${level ?? 'none — L1 is not complete'}.`);
if (level === null) {
  const missing = LEVEL.L1.filter(kind => { const c = parse(kind); return c.total === 0 || c.passed !== c.total; });
  console.log(`L1 needs every case of ${LEVEL.L1.join(', ')}; still short: ${missing.join(', ')}.`);
} else if (level !== 'L3') {
  const next = level === 'L1' ? 'L2' : 'L3';
  console.log(`For ${next}, complete: ${LEVEL[next].filter(kind => { const c = parse(kind); return c.passed !== c.total; }).join(', ')}.`);
}
console.log('A level is derived from the counts above, never declared. A report produced by the sender is ' +
  'sender-attested: re-run it yourself to turn it into an observation.');
