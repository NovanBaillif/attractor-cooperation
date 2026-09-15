// SPEC section 4.2.1 — the derivation of a value (0.3): how the value itself was obtained, not only what was read.
import {nonEmpty} from './canonical.mjs';

export const OPERATIONS = new Set(['measured', 'quoted', 'copied', 'computed', 'reconciled']);
const COPY_CHANNELS = new Set(['cached', 'mirrored', 'republished']);
const idList = list => Array.isArray(list) && list.every(nonEmpty) && new Set(list).size === list.length;

// Codes for one field (without the ":id" suffix). Empty when the field declares no derivation.
export function derivationProblems(id, field, fields) {
  if (!Object.hasOwn(field, 'derivation')) return [];
  const d = field.derivation;
  if (d === null || typeof d !== 'object' || Array.isArray(d) || !OPERATIONS.has(d.operation) || !idList(d.inputs) ||
      (Object.hasOwn(d, 'available') && !idList(d.available)) || (Object.hasOwn(d, 'sufficient') && !idList(d.sufficient)) ||
      (Object.hasOwn(d, 'quote') && !nonEmpty(d.quote)) || (Object.hasOwn(d, 'locator') && !nonEmpty(d.locator)) ||
      (Object.hasOwn(d, 'approvedBy') && !nonEmpty(d.approvedBy))) {
    return ['invalid-derivation'];
  }
  const codes = [];
  const sources = Array.isArray(field.sources) ? field.sources : [];
  const available = d.available ?? [], sufficient = d.sufficient ?? [];
  const byOperation = {
    measured: () => field.kind === 'observed' && field.channel === 'direct' && d.inputs.length === 0,
    quoted: () => field.kind === 'observed' && d.inputs.length === 0,
    copied: () => (field.kind === 'observed' && COPY_CHANNELS.has(field.channel) && d.inputs.length === 0) ||
      (field.kind === 'derived' && d.inputs.length === 1),
    computed: () => (field.kind === 'derived' || field.kind === 'reconstructed') && d.inputs.length > 0,
    reconciled: () => (field.kind === 'derived' || field.kind === 'reconstructed') && d.inputs.length > 0
  };
  if (!byOperation[d.operation]() || d.inputs.some(input => !sources.includes(input)) ||
      sufficient.some(input => !d.inputs.includes(input)) ||
      available.some(other => other === id || !fields.has(other) || d.inputs.includes(other))) {
    codes.push('derivation-inconsistent');
  }
  if (d.operation === 'quoted' && (!nonEmpty(d.quote) || !nonEmpty(d.locator))) codes.push('quote-missing');
  return codes;
}

// True when the field, or any field among its transitive sources, declares a reconciled value.
export function reconciledAmong(graph, id, ancestorsOf) {
  return [id, ...ancestorsOf(graph, id)].some(other => graph.get(other)?.derivation?.operation === 'reconciled');
}
