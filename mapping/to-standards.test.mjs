// The mapping is only useful if it is faithful: every span, every derivation, every diagnostic, and nothing
// invented. Run: node --test mapping/to-standards.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toWebAnnotations, toProv, toSarif} from './to-standards.mjs';
import {inspectProvenance} from '../reference/index.mjs';

const cases = JSON.parse(readFileSync(new URL('../conformance/cases.json', import.meta.url), 'utf8')).cases;
const provenance = cases.filter(c => c.kind === 'provenance');
const records = provenance.map(c => c.input.record).filter(Boolean);

test('every span of every provenance case becomes exactly one Web Annotation', () => {
  for (const record of records) {
    const spans = (record.fields ?? []).filter(f => typeof f?.derivation?.span?.quote === 'string');
    const annotations = toWebAnnotations(record);
    assert.equal(annotations.length, spans.length, record.id);
    for (const [i, a] of annotations.entries()) {
      assert.equal(a.type, 'Annotation');
      assert.equal(a['@context'], 'http://www.w3.org/ns/anno.jsonld');
      assert.equal(a.target.selector.type, 'TextQuoteSelector');
      assert.equal(a.target.selector.exact, spans[i].derivation.span.quote);
      assert.equal(a.target.source, spans[i].derivation.span.locator);
    }
  }
});

test('the annotation never adds a quote the record does not carry', () => {
  for (const record of records) {
    const quotes = new Set((record.fields ?? []).map(f => f?.derivation?.span?.quote).filter(Boolean));
    for (const a of toWebAnnotations(record)) assert.ok(quotes.has(a.target.selector.exact));
  }
});

test('PROV carries one entity per field, and derivation links only where the record declares them', () => {
  for (const record of records) {
    const prov = toProv(record);
    assert.equal(prov['@graph'].length, (record.fields ?? []).length, record.id);
    for (const [i, entity] of prov['@graph'].entries()) {
      const field = record.fields[i];
      assert.equal(entity['@type'], 'prov:Entity');
      const declared = Array.isArray(field.derivation?.inputs) ? field.derivation.inputs.length : 0;
      assert.equal((entity['prov:wasDerivedFrom'] ?? []).length, declared, `${record.id}/${field.id}`);
      if (field.derivation?.operation === 'quoted' && field.derivation.span?.locator) {
        assert.equal(entity['prov:wasQuotedFrom']['@id'], field.derivation.span.locator);
      } else {
        assert.equal(entity['prov:wasQuotedFrom'], undefined);
      }
    }
  }
});

test('SARIF reports every violation as an error and every warning as a warning, and invents no result', () => {
  for (const c of provenance) {
    const result = inspectProvenance(structuredClone(c.input));
    const sarif = toSarif(result);
    const errors = sarif.runs[0].results.filter(r => r.level === 'error');
    const warnings = sarif.runs[0].results.filter(r => r.level === 'warning');
    assert.equal(errors.length, (result.violations ?? []).length, c.id);
    assert.equal(warnings.length, (result.warnings ?? []).length, c.id);
    const notes = sarif.runs[0].results.filter(r => r.level === 'note');
    assert.equal(notes.length, Object.values(result.spans ?? {}).filter(s => s?.contact).length, c.id);
    assert.equal(sarif.version, '2.1.0');
  }
});

test('a record with no span and no derivation maps to nothing rather than to something invented', () => {
  const bare = {id: 'x', author: {actor: 'https://example.org/a'}, fields: [{id: 'f', value: 1, kind: 'observed', sources: []}]};
  assert.deepEqual(toWebAnnotations(bare), []);
  const entity = toProv(bare)['@graph'][0];
  assert.equal(entity['prov:wasDerivedFrom'], undefined);
  assert.equal(entity['prov:wasGeneratedBy'], undefined);
  assert.equal(entity['prov:wasAttributedTo']['@id'], 'https://example.org/a');
});
