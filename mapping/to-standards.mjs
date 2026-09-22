// Emit what this profile carries in the vocabularies that already exist, instead of asking anyone to learn ours.
//
// Decision of 22 September 2026 (operator: "I get the impression we are redoing norms that already exist").
// Our own prior-art audit had already found it: of fifteen concepts examined, ten are named in published
// standards. So the profile stops being a vocabulary and becomes a thin layer: every member that has an
// equivalent is emitted as that equivalent, and only a small kernel stays ours.
//
//   node mapping/to-standards.mjs <record.json>        -> {annotations, prov, sarif}
//   import {toWebAnnotations, toProv, toSarif} from './mapping/to-standards.mjs'
//
// Node only: no packages, no network, no writes.
//
// What is emitted, and where the terms come from:
//   spans        -> W3C Web Annotation Data Model (2017): TextQuoteSelector.exact, TimeState.sourceDate.
//   derivation   -> W3C PROV-O: prov:Entity, prov:wasDerivedFrom, prov:wasQuotedFrom, prov:wasGeneratedBy.
//   diagnostics  -> OASIS SARIF 2.1.0: runs[].results[] with ruleId, level, message, locations.
//
// What is NOT emitted, because no vocabulary found carries it (the kernel of section "What still looks
// specific" in PRIOR-ART.md): a status derived and never declared, a disposition of the receiver kept apart
// from the sender's provenance, and the indistinguishability control of Test #001.

// The four values the provenance check can derive for a span. `unknown` is a result like the others and is
// reported: a span whose access nobody probed must not vanish from the diagnostics.
const CONTACT_RULE = {read: 'attractor.span.read', fetched: 'attractor.span.fetched',
  cited: 'attractor.span.cited', unknown: 'attractor.span.unknown'};

/** Every span of a record as a W3C Web Annotation. */
export function toWebAnnotations(record) {
  const out = [];
  for (const field of record?.fields ?? []) {
    const span = field?.derivation?.span;
    if (!span || typeof span.quote !== 'string') continue;
    out.push({
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      type: 'Annotation',
      id: `urn:attractor:${record.id}:${field.id}:span`,
      motivation: 'linking',
      creator: record.author?.actor ?? null,
      created: span.retrievedAt ?? null,
      body: {type: 'TextualBody', value: field.value === undefined ? null : field.value,
        purpose: 'describing'},
      target: {
        source: span.locator,
        selector: {type: 'TextQuoteSelector', exact: span.quote},
        ...(span.retrievedAt ? {state: {type: 'TimeState', sourceDate: span.retrievedAt}} : {}),
      },
    });
  }
  return out;
}

/** The derivation of every field as PROV-O, in JSON-LD. */
export function toProv(record) {
  const graph = [];
  for (const field of record?.fields ?? []) {
    const entity = {'@id': `urn:attractor:${record.id}:${field.id}`, '@type': 'prov:Entity'};
    if (record.author?.actor) entity['prov:wasAttributedTo'] = {'@id': record.author.actor};
    const derivation = field.derivation ?? {};
    const inputs = Array.isArray(derivation.inputs) ? derivation.inputs : [];
    if (inputs.length) entity['prov:wasDerivedFrom'] = inputs.map(id => ({'@id': `urn:attractor:${record.id}:${id}`}));
    if (derivation.operation === 'quoted' && derivation.span?.locator) {
      entity['prov:wasQuotedFrom'] = {'@id': derivation.span.locator};
    }
    if (field.channel && field.channel !== 'direct' && field.upstream) {
      entity['prov:hadPrimarySource'] = {'@id': field.upstream};
    }
    if (derivation.operation) {
      entity['prov:wasGeneratedBy'] = {'@type': 'prov:Activity', 'prov:label': derivation.operation};
    }
    graph.push(entity);
  }
  return {'@context': {prov: 'http://www.w3.org/ns/prov#'}, '@graph': graph};
}

/** Violations and warnings of a check result as SARIF 2.1.0. */
export function toSarif(result, {tool = 'attractor-cooperation reference checker', version = '0.5'} = {}) {
  const results = [];
  const push = (list, level) => {
    for (const item of list ?? []) {
      const text = String(item);
      const [ruleId, ...rest] = text.split(':');
      results.push({ruleId: `attractor.${ruleId}`, level,
        message: {text: rest.length ? `${ruleId}: ${rest.join(':')}` : text}});
    }
  };
  push(result?.violations, 'error');
  push(result?.warnings, 'warning');
  for (const [fieldId, span] of Object.entries(result?.spans ?? {})) {
    const ruleId = CONTACT_RULE[span?.contact];
    if (ruleId) results.push({ruleId, level: 'note',
      message: {text: `${fieldId}: contact ${span.contact}, access ${span.access}${span.terminal ? ', terminal' : ''}`}});
  }
  return {version: '2.1.0', $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{tool: {driver: {name: tool, version, informationUri: 'https://github.com/NovanBaillif/attractor-cooperation'}},
      results}]};
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const {readFileSync} = await import('node:fs');
  const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const record = input.record ?? input;
  const {inspectProvenance} = await import('../reference/index.mjs');
  let diagnostics = null;
  try { diagnostics = inspectProvenance(input.record ? input : {record}); } catch { /* a record alone may not satisfy the check */ }
  console.log(JSON.stringify({annotations: toWebAnnotations(record), prov: toProv(record),
    sarif: diagnostics ? toSarif(diagnostics) : null}, null, 2));
}
