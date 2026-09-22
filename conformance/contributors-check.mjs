// Credit record check: CONTRIBUTORS.json against SPEC section 13, and every "what it became" against this repository.
//   node conformance/contributors-check.mjs
// Node only: no packages, no network, no writes. Uses git, when present, to check that each commit named in
// `changed_in` is in the history of HEAD. Exit code 1 on any error; the summary is printed either way.
import {readFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(join(ROOT, path), 'utf8');
const flat = text => text.replace(/\s+/g, ' ');

// The fourteen CRediT roles, ANSI/NISO Z39.104-2022, spelled as the standard spells them (en dash included).
const CREDIT = new Set(['Conceptualization', 'Data curation', 'Formal analysis', 'Funding acquisition', 'Investigation',
  'Methodology', 'Project administration', 'Resources', 'Software', 'Supervision', 'Validation', 'Visualization',
  'Writing – original draft', 'Writing – review & editing']);
const OUTCOMES = new Set(['adopted', 'known-limit', 'open', 'declined']);
// The project's own accounts are never credited as contributors.
const OWN = new Set(['attractor-memory', 'attractor', 'novanbaillif', 'claude']);

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);
const isText = v => typeof v === 'string' && v.trim().length > 0;
const isHttps = v => isText(v) && /^https:\/\/[^\s]+$/.test(v);

const record = JSON.parse(read('CONTRIBUTORS.json'));
const specLines = read('SPEC.md').split('\n');

// --- Where a contribution landed -------------------------------------------------------------------------------
const caseIds = new Set(JSON.parse(read('conformance/cases.json')).cases.map(c => c.id));
for (const path of ['experiments/break-axiom-1/cases/index.mjs', 'experiments/break-axiom-1/adversarial/index.mjs']) {
  for (const m of read(path).matchAll(/^\s*id: '([^']+)'/gm)) caseIds.add(m[1]);
}

function specSection(number) {
  const start = specLines.findIndex(l => new RegExp(`^#{2,4} ${number.replace(/\./g, '\\.')}\\.? `).test(l));
  if (start < 0) return null;
  const level = specLines[start].match(/^#+/)[0].length;
  let end = specLines.findIndex((l, i) => i > start && /^#{1,6} /.test(l) && l.match(/^#+/)[0].length <= level);
  if (end < 0) end = specLines.length;
  return specLines.slice(start, end).join('\n');
}

function checkWhere(ref, where) {
  const [target, locator] = ref.split(' › ');
  let text = null;
  if (target.startsWith('SPEC §')) {
    text = specSection(target.slice('SPEC §'.length).trim());
    if (text === null) return fail(where, `no section ${target} in SPEC.md`);
  } else if (target.startsWith('case ')) {
    if (!caseIds.has(target.slice(5).trim())) fail(where, `no ${target} in conformance/cases.json or experiments/break-axiom-1`);
    if (locator !== undefined) fail(where, `a case reference takes no locator: ${ref}`);
    return;
  } else if (target.startsWith('file ')) {
    const path = target.slice(5).trim();
    if (!existsSync(join(ROOT, path))) return fail(where, `no file ${path}`);
    text = read(path);
  } else {
    return fail(where, `unknown reference form: ${ref} (use "SPEC §n", "case <id>" or "file <path>")`);
  }
  if (locator !== undefined && !flat(text).includes(flat(locator))) fail(where, `"${locator}" not found in ${target}`);
}

let git = null; // null: not checked yet; false: unavailable
function inHistory(commit, where) {
  if (git === null) {
    try {
      execFileSync('git', ['-c', 'safe.directory=*', 'rev-parse', '--is-inside-work-tree'], {cwd: ROOT, stdio: 'pipe'});
      git = true;
    } catch {
      git = false;
      console.warn('warning: git unavailable or not a repository; commits in changed_in were not checked');
    }
  }
  if (git === false) return;
  try {
    execFileSync('git', ['-c', 'safe.directory=*', 'merge-base', '--is-ancestor', commit, 'HEAD'], {cwd: ROOT, stdio: 'pipe'});
  } catch (e) {
    fail(where, e.status === 1 ? `commit ${commit} is not in the history of HEAD` : `unknown commit ${commit}`);
  }
}

// --- The record itself ---------------------------------------------------------------------------------------------
if (!isText(record.note)) fail('note', 'missing');
else {
  for (const [pattern, meaning] of [[/individual/i, 'participation is individual'], [/endorse/i, 'being listed is not an endorsement'],
    [/self-declared/i, 'lineage is self-declared'], [/paid/i, 'nobody was paid']]) {
    if (!pattern.test(record.note)) fail('note', `does not state that ${meaning}`);
  }
}
if (!Array.isArray(record.contributors) || record.contributors.length === 0) fail('contributors', 'missing or empty');

const byHandle = new Map();
const urlOwner = new Map();
const counts = {adopted: 0, 'known-limit': 0, open: 0, declined: 0};
let contributions = 0;

for (const [i, c] of (record.contributors ?? []).entries()) {
  const who = isText(c.handle) ? c.handle : `contributors[${i}]`;
  if (!isText(c.handle)) { fail(who, 'handle missing'); continue; }
  if (byHandle.has(c.handle)) fail(who, 'listed twice');
  byHandle.set(c.handle, c);
  if (OWN.has(c.handle.toLowerCase())) fail(who, 'the project\'s own account is not a contributor');
  if (!Array.isArray(c.platforms) || c.platforms.length === 0 || !c.platforms.every(isText)) fail(who, 'platforms missing');
  if (!('declared_lineage' in c) || !(c.declared_lineage === null || isText(c.declared_lineage))) {
    fail(who, 'declared_lineage must be present: a string they declared, or null');
  }
  if (!Array.isArray(c.contributions) || c.contributions.length === 0) { fail(who, 'no contributions'); continue; }
  for (const [j, k] of c.contributions.entries()) {
    const where = `${who} #${j + 1}`;
    contributions += 1;
    if (!isText(k.what) || /\n/.test(k.what) || !/\.$/.test(k.what)) fail(where, '`what` must be one plain sentence ending with a period');
    // A contribution normally links the contributor's own public message. A contribution that arrived
    // privately has no such link, and crediting it at all requires the contributor's permission: the entry then
    // carries `source_private` (where it came from) and `permission` (what they allowed, in their own words).
    // Without both, a private contribution is not listed.
    if (k.source_url === undefined) {
      if (!isText(k.source_private) || !isText(k.permission)) {
        fail(where, 'no source_url: a private contribution needs source_private and permission');
      }
    } else if (!isHttps(k.source_url)) fail(where, 'source_url must be a non-empty https URL');
    for (const url of [...(k.source_url === undefined ? [] : [k.source_url]), ...(k.see_also ?? [])]) {
      if (!isHttps(url)) { fail(where, `not an https URL: ${url}`); continue; }
      if (urlOwner.has(url) && urlOwner.get(url) !== c.handle) fail(where, `${url} is also credited to ${urlOwner.get(url)}`);
      urlOwner.set(url, c.handle);
    }
    if (k.see_also !== undefined && !Array.isArray(k.see_also)) fail(where, 'see_also must be an array');
    if (!CREDIT.has(k.role)) fail(where, `role "${k.role}" is not one of the fourteen CRediT roles`);
    if (!OUTCOMES.has(k.outcome)) { fail(where, `outcome "${k.outcome}" is not one of ${[...OUTCOMES].join(', ')}`); continue; }
    counts[k.outcome] += 1;
    if (k.outcome === 'open' && k.changed_in !== null) fail(where, 'an open contribution has changed_in null');
    if (k.outcome === 'declined' && !isText(k.reason)) fail(where, 'a declined contribution states its reason');
    if ((k.outcome === 'adopted' || k.outcome === 'known-limit') && (k.changed_in === null || typeof k.changed_in !== 'object')) {
      fail(where, `${k.outcome} needs changed_in: where it landed`);
      continue;
    }
    if (k.changed_in && typeof k.changed_in === 'object') {
      const {version, commits, where: refs} = k.changed_in;
      if (!isText(version)) fail(where, 'changed_in.version missing');
      if (!Array.isArray(commits) || commits.length === 0) fail(where, 'changed_in.commits missing');
      for (const commit of commits ?? []) {
        if (!/^[0-9a-f]{7,40}$/.test(commit)) fail(where, `not a commit id: ${commit}`);
        else inHistory(commit, where);
      }
      if (!Array.isArray(refs) || refs.length === 0) fail(where, 'changed_in.where missing');
      for (const ref of refs ?? []) isText(ref) ? checkWhere(ref, where) : fail(where, 'empty reference');
    }
  }
}

// --- SPEC section 13 and the record name the same people -------------------------------------------------------------
const s13 = specSection('13');
const credited = new Set();
if (s13 === null) fail('SPEC §13', 'section not found');
for (const line of (s13 ?? '').split('\n').filter(l => l.startsWith('- **'))) {
  const [, bold, paren] = line.match(/^- \*\*([^*]+)\*\*(?:\s*\(([^);:,]+))?/);
  const names = [bold, paren].filter(Boolean).map(s => s.trim());
  const c = [...byHandle.values()].find(x => names.includes(x.handle) || names.includes(x.display_name));
  if (!c) { fail('SPEC §13', `"${bold}" is credited in the text but has no entry in CONTRIBUTORS.json`); continue; }
  if (credited.has(c.handle)) fail('SPEC §13', `${c.handle} has two bullets`);
  credited.add(c.handle);
  const known = new Set(c.contributions.flatMap(k => [k.source_url, ...(k.see_also ?? [])]));
  for (const [, url] of line.matchAll(/\]\((https:[^)\s]+)\)/g)) {
    if (!known.has(url)) fail('SPEC §13', `${c.handle}: link ${url} is not in their CONTRIBUTORS.json entry`);
  }
}
for (const handle of byHandle.keys()) if (!credited.has(handle)) fail('SPEC §13', `${handle} is in CONTRIBUTORS.json but not credited in section 13`);

console.log(`contributors: ${byHandle.size} (${credited.size} credited in SPEC section 13)`);
console.log(`contributions: ${contributions} — ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`);
if (git === true) console.log('commits in changed_in: checked against the history of HEAD');
if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors) console.log(`  ${e}`);
  process.exit(1);
}
console.log('credit record: OK');
