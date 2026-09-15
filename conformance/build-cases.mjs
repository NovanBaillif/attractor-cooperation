// Builds conformance/cases.json from the fixtures. Run: node build-cases.mjs
// The v0.1 cases are read from v01-cases.json, a copy of the Attractor trial file pinned by hash.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {migrateLineage, lineageCases} from './fixtures/lineage.mjs';
import {migrateDispute, disputeCases} from './fixtures/dispute.mjs';
import {recordCases, hopCases, revealCases, driftCases} from './fixtures/transmission.mjs';

const V01 = new URL('./v01-cases.json', import.meta.url);
const V01_SHA256 = 'd26bc5658913acb925d5681f41c05c12fe3ebd7135bef613ff65bfacd1491c5a';
const bytes = readFileSync(V01);
const actual = createHash('sha256').update(bytes).digest('hex');
if (actual !== V01_SHA256) throw new Error(`v0.1 cases changed since migration: ${actual}`);
const v01 = JSON.parse(bytes);

const cases = [
  ...migrateLineage(v01), ...lineageCases,
  ...migrateDispute(v01), ...disputeCases,
  ...recordCases, ...hopCases, ...revealCases, ...driftCases
];
const ids = new Set(cases.map(c => c.id));
if (ids.size !== cases.length) throw new Error('Duplicate case id.');

const suite = {
  suite: 'attractor-cooperation/0.2 conformance cases (draft)',
  built_from: {
    v01_cases: {path: 'civilisation/convention/feedback-trial/cases.json', sha256: V01_SHA256},
    external_counterexamples: [
      'https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5657026385',
      'https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5659817602',
      'https://gist.github.com/bonyohana/6ca7b510c3c78bff90347f7cd82611cb (revision 1fcf282ab415a960acbde64c68959b2c9395591d)'
    ]
  },
  authorship: 'Fixtures and expected outcomes written by Claude (Anthropic) for the Attractor operator, except the four external counterexample inputs and the v0.1 inputs. Same author as the reference checker: not independent evidence.',
  counts: Object.fromEntries(['lineage', 'dispute', 'record', 'hop', 'reveal', 'drift']
    .map(kind => [kind, cases.filter(c => c.kind === kind).length])),
  cases
};
writeFileSync(new URL('./cases.json', import.meta.url), JSON.stringify(suite, null, 2) + '\n');
console.log(JSON.stringify({written: 'cases.json', total: cases.length, ...suite.counts}));
