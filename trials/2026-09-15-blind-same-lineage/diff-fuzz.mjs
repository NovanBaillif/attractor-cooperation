// Differential test: reference vs another implementation on random inputs (no duplicate ids).
// Divergences point at places where SPEC.md admits two readings.
//   node diff-fuzz.mjs ./impl.mjs [runs-per-kind]      (seeded: the same inputs every run)
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const V02 = new URL('../../', import.meta.url);
const A = await import(new URL('reference/index.mjs', V02).href);
const B = await import(pathToFileURL(resolve(process.argv[2] ?? './impl.mjs')).href);
const N = Number(process.argv[3] ?? 3000);
const {cases} = JSON.parse(readFileSync(new URL('conformance/cases.json', V02), 'utf8'));
const baseHop = cases.find(c => c.id === 'v02-hop-clean').input;
const baseReveal = cases.find(c => c.id === 'v02-reveal-sealed-agreement').input;

let seed = 20260915;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = a => a[Math.floor(rnd() * a.length)];
const maybe = p => rnd() < p;
const strip = v => JSON.parse(JSON.stringify(v, (k, x) => (k === 'interpretation' || k === 'reason') ? undefined : x));

function genLineage() {
  const n = 2 + Math.floor(rnd() * 5), ids = Array.from({length: n}, (_, i) => 'f' + i);
  const fields = ids.map(id => {
    const f = {id, value: pick([1, 2, 'x']), kind: pick(['observed', 'observed', 'derived', 'reconstructed', 'unknown', 'bogus'])};
    f.sources = f.kind === 'observed' && maybe(0.8) ? [] : ids.filter(x => x !== id && maybe(0.35)).concat(maybe(0.1) ? ['ghost'] : []);
    if (maybe(0.08)) f.sources = 'nope';
    const ch = pick([undefined, 'direct', 'direct', 'cached', 'mirrored', 'republished', 'weird']);
    if (ch !== undefined) f.channel = ch;
    const up = pick([undefined, undefined, 'u1', 'u2', '', 'f0']);
    if (up !== undefined) f.upstream = up;
    return f;
  });
  return {fields, comparison: {left: maybe(0.95) ? pick(ids) : 'absent', right: pick(ids)}};
}

function genDispute() {
  const vals = ['14', '21', '30'], doms = ['d', 'e'], vers = ['v1', 'v2'];
  const claim = {id: 'c', value: pick(vals), domain: pick(doms.slice(0, 1)), version: 'v2'};
  if (maybe(0.05)) delete claim.value;
  const ids = ['s1', 's2', 's3'].slice(0, 1 + Math.floor(rnd() * 3));
  const sources = ids.map(id => {
    const s = {id, value: pick(vals), domain: maybe(0.85) ? 'd' : 'e', version: maybe(0.85) ? 'v2' : 'v1', status: maybe(0.8) ? 'verified' : 'unverified'};
    if (maybe(0.3)) s.supersedes = maybe(0.5) ? pick(ids) : [pick(ids), 'zz'];
    if (maybe(0.05)) delete s.value;
    return s;
  });
  const objection = {id: 'o', claimId: maybe(0.95) ? 'c' : 'x', proposedValue: pick(vals)};
  if (maybe(0.8)) objection.sourceId = pick([...ids, 'unsupplied']);
  const policy = {claimId: 'c', sourceId: pick([...ids, 'missing']), domain: maybe(0.9) ? 'd' : 'e', version: 'v2', verified: maybe(0.9)};
  return {claim, objection, policy, sources};
}

const clone = structuredClone;
function mutateHop(input) {
  const x = clone(input), r = x.receipt, R = r.record, S = x.sent;
  const steps = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < steps; i++) {
    const f = pick(R.fields), d = pick(r.dispositions);
    switch (Math.floor(rnd() * 16)) {
      case 0: d.action = pick(['accept', 'verify', 're_derive', 'contest', 'modify', 'drop', 'shrug']); break;
      case 1: r.dispositions = r.dispositions.filter(y => y !== d); break;
      case 2: if (f) f.value = pick([0.1, 0.69, 'changed']); break;
      case 3: if (f) f.kind = pick(['observed', 'derived', 'unknown']); break;
      case 4: if (f) f.sources = maybe(0.5) ? [] : [pick(R.fields).id]; break;
      case 5: if (f) { delete f.channel; } break;
      case 6: R.fields = R.fields.filter(y => y !== f); break;
      case 7: R.fields.push({id: 'new' + i, value: 1, kind: 'observed', sources: [], channel: pick(['direct', 'cached']), ...(maybe(0.5) ? {upstream: 'https://venue.example/api'} : {})}); break;
      case 8: if (R.objections[0]) R.objections[0].basis = {citation: 'none'}; break;
      case 9: R.objections = []; break;
      case 10: R.objections.push({id: 'ob' + i, target: pick(S.fields).id, proposedValue: 1, ...(maybe(0.6) ? {basis: {citation: pick(['none', 'secondary'])}} : {})}); d.objection = 'ob' + i; break;
      case 11: R.parent = pick([null, 'rec-a-1', 'other']); break;
      case 12: R.author.lineage = pick(['example/lineage-a', 'example/lineage-b', 'human', '']); break;
      case 13: d.basis = pick([...R.fields.map(y => y.id), 'nowhere']); break;
      case 14: if (maybe(0.5)) delete d.reason; else d.reason = 'because'; break;
      case 15: if (f) f.sources = [...(Array.isArray(f.sources) ? f.sources : []), 'estimate']; break;
    }
  }
  return x;
}

function mutateRecord(sent) {
  const s = clone(sent), steps = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < steps; i++) {
    const f = pick(s.fields);
    switch (Math.floor(rnd() * 10)) {
      case 0: delete f.channel; break;
      case 1: f.expect = pick(['accept', 'verify', 're_derive', 'maybe']); break;
      case 2: if (f.sealed) f.value = 1; else f.sealed = {alg: 'sha256-jcs', commitment: 'a'.repeat(64)}; break;
      case 3: s.fields.push({id: 'leak' + i, value: 1, kind: 'derived', sources: ['thesis']}); break;
      case 4: f.sources = pick([[], ['ghost'], [pick(s.fields).id], 'x']); break;
      case 5: f.kind = pick(['observed', 'derived', 'unknown', 'odd']); break;
      case 6: if (s.objections[0]) s.objections[0].basis = pick([null, {citation: 'secondary'}, {citation: 'none'}, {citation: 'controlling', sourceId: 'x'}]); break;
      case 7: if (s.objections[0]) s.objections[0].target = pick(['ghost', 'estimate']); break;
      case 8: f.channel = pick(['cached', 'weird', 'direct']); break;
      case 9: delete s.author.lineage; break;
    }
  }
  return s;
}

function mutateReveal(input) {
  const x = clone(input);
  switch (Math.floor(rnd() * 6)) {
    case 0: x.reveal.reveals[0].salt = pick(['', 'wrong', 'salt-a-thesis']); break;
    case 1: x.reveal.reveals[0].value = pick([0.58, 0.6]); break;
    case 2: x.reveal.receiptDigest = 'b'.repeat(64); break;
    case 3: x.reveal.target = pick(['receipt-b-1', 'other']); break;
    case 4: x.reveal.reveals = []; break;
    case 5: x.receipt.record.fields.find(f => f.id === 'thesis').value = pick([0.58, 0.6]); break;
  }
  return x;
}

const kinds = {
  lineage: [() => genLineage(), 'inspectLineage'],
  dispute: [() => genDispute(), 'inspectDispute'],
  record: [() => mutateRecord(baseHop.sent), 'inspectRecord'],
  hop: [() => mutateHop(baseHop), 'inspectHop'],
  reveal: [() => mutateReveal(baseReveal), 'inspectReveal'],
  drift: [() => maybe(0.5) ? mutateReveal(baseReveal) : mutateHop(baseHop), 'driftReport']
};
const report = {};
for (const [kind, [gen, fn]] of Object.entries(kinds)) {
  const diffs = [];
  let count = 0;
  for (let i = 0; i < N; i++) {
    const input = gen();
    let a, b;
    try { a = strip(A[fn](clone(input))); } catch (e) { a = {threw: e.message}; }
    try { b = strip(B[fn](clone(input))); } catch (e) { b = {threw: e.message}; }
    if (!isDeepStrictEqual(a, b)) { count++; if (diffs.length < 4) diffs.push({input, reference: a, blind: b}); }
  }
  report[kind] = {runs: N, divergent: count, examples: diffs};
}
console.log(JSON.stringify(report, null, 1));
