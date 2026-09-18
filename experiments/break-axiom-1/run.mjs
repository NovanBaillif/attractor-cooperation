// Runs Test #001 end to end and writes what it found. Deterministic: same inputs, same outputs.
//   node experiments/break-axiom-1/run.mjs
// Writes results/results.json, packet/ (for independent agents; sending is a separate, operator-approved act) and manifest.json.
import {readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join, relative, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {distinguishabilityCheck} from './check.mjs';
import {CASES} from './cases/index.mjs';
import {runAdversarial} from './adversarial/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = p => join(here, p);

// ——— 1. The pairs ———
const cases = CASES.map(c => {
  const r = distinguishabilityCheck(c);
  return {id: c.id, property: c.property, verdict: r.verdict, expected: c.expected, agrees: r.verdict === c.expected,
    witness: r.witness ?? null, reason: r.reason ?? null, adversariesClosed: !!c.adversariesClosed, closedBy: r.closedBy ?? null, refuters: r.refuters ?? null, note: c.note};
});
// ——— 2. Against the published profile ———
const adversarial = runAdversarial();

const tally = v => cases.filter(c => c.verdict === v).length;
const results = {
  test: 'ATTRACTOR Test #001 — Break Axiom 1',
  generatedFrom: 'experiments/break-axiom-1 (deterministic; re-run with node run.mjs)',
  summary: {
    properties: cases.length,
    distinguishable: tally('DISTINGUISHABLE'),
    indistinguishable: tally('INDISTINGUISHABLE'),
    unknown: tally('UNKNOWN'),
    profileBreaks: adversarial.filter(a => a.broken).length,
  },
  cases, adversarial,
};
mkdirSync(out('results'), {recursive: true});
writeFileSync(out('results/results.json'), JSON.stringify(results, null, 2) + '\n');

// ——— 3. The packet for independent agents (section 8) ———
// Axiom, statuses, schema, worlds, instrument, instructions. NO expected verdicts, NO notes, NO results, NO
// novelty verdict: an agent handed our conclusion would be measuring our conclusion.
mkdirSync(out('packet'), {recursive: true});
const describe = v => typeof v === 'function' ? `[function: ${v.toString().replace(/\s+/g, ' ').slice(0, 160)}]` : v;
const scrub = world => JSON.parse(JSON.stringify(world, (k, v) => describe(v)));
const packetCases = CASES.map(c => ({id: c.id, property: c.property, question: c.question, verifier: c.verifier,
  P: scrub(c.P), notP: c.notP.map(scrub), adversariesClosed: !!c.adversariesClosed, closedBy: c.closedBy ?? null}));
writeFileSync(out('packet/cases.json'), JSON.stringify(packetCases, null, 2) + '\n');
copyFileSync(out('check.mjs'), out('packet/check.mjs'));
copyFileSync(out('schema.json'), out('packet/schema.json'));
const axiom = readFileSync(out('axiom.md'), 'utf8').split('## Status of this axiom')[0].trimEnd() + '\n';
writeFileSync(out('packet/axiom.md'), axiom);

// ——— 4. Manifest: a hash per file, so a reader can tell whether what they hold is what was run ———
const files = [];
const walk = dir => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (!p.endsWith('manifest.json')) files.push(p); } };
walk(here);
const manifest = {test: results.test, files: Object.fromEntries(files.sort().map(p => [relative(here, p).replaceAll('\\', '/'),
  createHash('sha256').update(readFileSync(p)).digest('hex')]))};
writeFileSync(out('manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// ——— Report ———
console.log(`${results.test}`);
console.log(`${results.summary.properties} properties · ${results.summary.distinguishable} distinguishable · ${results.summary.indistinguishable} indistinguishable · ${results.summary.unknown} unknown · ${results.summary.profileBreaks} breaks of the published profile`);
for (const c of cases) console.log(`  ${c.agrees ? ' ' : '!'} ${c.verdict.padEnd(18)} ${c.id}`);
for (const a of adversarial) console.log(`  ${a.broken ? 'BROKEN' : 'holds '} ${a.id} → profile says ${a.profile.contact}/${a.profile.access}`);
if (cases.some(c => !c.agrees)) process.exitCode = 1;
