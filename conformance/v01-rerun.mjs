// Re-runs the v0.1 trial checker, unchanged, on the inputs of the section 11 table, and compares its outputs with
// the table's v0.1 column. The checker is not in this repository: download it first from the project repository,
//   https://raw.githubusercontent.com/NovanBaillif/attractor/20475f41440409e6e15387183e65291781c184a4/civilisation/convention/feedback-trial/guard.mjs
// then run: node conformance/v01-rerun.mjs <path to guard.mjs>
// The file is refused unless its git blob id is the pinned one, so the run is against the checker v0.1 had.
// Node only: no packages, no network, no writes. Exit code 1 on any difference.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const PINNED_BLOB = '6fed97e053ddfedfe460234249c6f4605090170e';
// Section 11, row by row: the case that carries the row's input. The v0.1 cell is read from SPEC.md itself, so a
// cell edited by hand, or a row added without its case, makes the run fail.
const CASE_OF_ROW = {
  'terminator2-agent case 1, verbatim': 'ce1-verbatim-honest-cache-launders-the-comparand',
  'terminator2-agent case 1, declared': 'ce1-declared-cache-names-its-upstream',
  'terminator2-agent case 2, declared': 'ce2-declared-partial-dependence',
  'Clara (bonyohana) case 1': 'ce3-verbatim-controller-contradicts-original-but-objection-cites-secondary',
  'Clara (bonyohana) case 2': 'ce4-verbatim-designated-source-superseded-by-verified-amendment-same-version',
  'v0.1 `dispute-value-match-does-not-transfer-source-authority`': 'v01-dispute-value-match-does-not-transfer-source-authority',
  'Equal observations without channel': 'v02-lineage-v01-equal-observations-without-channel',
  'New: controlling source contradicts both': 'v02-dispute-controller-contradicts-both',
  'New: cached root without upstream': 'v02-lineage-cached-root-without-upstream',
  'New: two direct reads of one instrument': 'v02-lineage-same-instrument-two-direct-readings',
  'New: channel outside the four values': 'v02-lineage-invalid-channel',
  'New: `supersedes` given as a list': 'v02-dispute-supersedes-list',
  'New: objection without source': 'v02-dispute-hunch-objection-labelled-none',
};
const spec = readFileSync(new URL('../SPEC.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const section = spec.slice(spec.indexOf('\n## 11. '), spec.indexOf('\n### 11.1'));
const ROWS = section.split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| Case |'))
  .map(l => l.split('|').map(s => s.trim())).map(([, row, cell]) => [row, CASE_OF_ROW[row], cell]);
if (ROWS.length === 0) { console.error('section 11 table not found in SPEC.md'); process.exit(1); }

const path = process.argv[2];
if (!path) { console.error('usage: node conformance/v01-rerun.mjs <path to guard.mjs>'); process.exit(2); }
const bytes = readFileSync(path);
const blob = createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
if (blob !== PINNED_BLOB) { console.error(`not the pinned v0.1 checker: git blob ${blob}, expected ${PINNED_BLOB}`); process.exit(1); }
const {inspectLineage, inspectDispute} = await import(pathToFileURL(path).href);
const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8')).cases;

let differences = 0;
for (const [row, id, cell] of ROWS) {
  const c = id && cases.find(x => x.id === id);
  if (!c) { console.log(`MISSING  ${row}: no case ${id ?? 'mapped to this row'}`); differences++; continue; }
  const got = (c.kind === 'dispute' ? inspectDispute(c.input) : inspectLineage(c.input)).status;
  const same = got === cell;
  if (!same) differences++;
  console.log(`${same ? 'same    ' : 'DIFFERS '} ${row}: v0.1 returns ${got}, the table says ${cell}`);
}
console.log(`${ROWS.length - differences} of ${ROWS.length} rows reproduce (v0.1 checker, git blob ${PINNED_BLOB})`);
if (differences) process.exitCode = 1;
