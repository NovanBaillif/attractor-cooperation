// SPEC section 7.4 — receiver-side conformance of one hop: record A, receipt of B.
import {ancestors, indexById, nonEmpty, omit, same, sorted} from './canonical.mjs';
import {inspectLineage} from './lineage.mjs';
import {validBasis} from './record.mjs';

export const ACTIONS = ['accept', 'verify', 're_derive', 'contest', 'modify', 'drop'];
const LINEAGE_WARNING = {
  'dependent': 'verification-dependent',
  'dependent-partial': 'verification-partially-dependent',
  'unknown': 'verification-unverifiable'
};

export function inspectHop({sent, receipt} = {}) {
  const V = new Set(), W = new Set(), pending = [];
  const counts = Object.fromEntries(ACTIONS.map(action => [action, 0]));
  const received = receipt?.record ?? {};
  const sentFields = indexById(sent?.fields, () => V.add('sent-record-invalid'));
  const sentObjections = indexById(sent?.objections, () => V.add('sent-record-invalid'));
  const fields = indexById(received.fields, () => V.add('received-record-invalid'));
  const objections = indexById(received.objections, () => V.add('received-record-invalid'));
  if (!nonEmpty(sent?.id) || received.parent !== sent.id) V.add('parent-missing');

  // A field with several dispositions is reported and not evaluated: no disposition "wins".
  const all = Array.isArray(receipt?.dispositions) ? receipt.dispositions : [];
  const refOf = d => nonEmpty(d?.field) ? d.field : '';
  for (const d of all) if (!sentFields.has(refOf(d))) V.add('unknown-field-disposition:' + refOf(d));
  const repeated = new Set();
  const dispositions = indexById(all.filter(d => sentFields.has(refOf(d))), id => repeated.add(id), refOf);
  for (const id of repeated) V.add('duplicate-disposition:' + id);

  // A carried field is compared with its original, ignoring only the sender's "expect" request.
  const kept = id => fields.has(id) && same(omit(sentFields.get(id), 'expect'), omit(fields.get(id), 'expect'));
  const modified = new Set();

  for (const [id, field] of sentFields) {
    if (repeated.has(id)) continue;
    const d = dispositions.get(id);
    if (!d) { V.add('missing-disposition:' + id); continue; }
    if (!ACTIONS.includes(d.action)) { V.add('invalid-disposition:' + id); continue; }
    counts[d.action] += 1;
    const sealed = Object.hasOwn(field, 'sealed');
    if (sealed && d.action !== 're_derive' && d.action !== 'drop') {
      V.add('sealed-field-not-re-derived:' + id); continue;
    }
    const mine = fields.get(id);
    if (d.action === 'accept' && !kept(id)) V.add('altered-on-accept:' + id);
    if (d.action === 'verify') {
      if (!kept(id)) V.add('altered-on-verify:' + id);
      if (!nonEmpty(d.basis) || !fields.has(d.basis)) V.add('verify-without-basis:' + id);
      else if (d.basis === id || ancestors(fields, d.basis).has(id)) V.add('circular-verification:' + id);
      else {
        const {status} = inspectLineage({fields: received.fields, comparison: {left: id, right: d.basis}});
        if (LINEAGE_WARNING[status]) W.add(LINEAGE_WARNING[status] + ':' + id);
      }
    }
    if (d.action === 're_derive') {
      if (!sealed) W.add('re-derivation-unprovable:' + id);
      if (!mine || !Object.hasOwn(mine, 'value') || Object.hasOwn(mine, 'sealed')) V.add('re-derivation-missing:' + id);
      else if (sealed) pending.push(id);
    }
    if (d.action === 'contest') {
      if (!kept(id)) V.add('original-overwritten:' + id);
      const objection = objections.get(d.objection);
      if (!objection || objection.target !== id || sentObjections.has(d.objection)) {
        V.add('contest-objection-missing:' + id);
      } else if (!validBasis(objection.basis)) V.add('contest-without-basis:' + id);
    }
    if (d.action === 'modify') {
      modified.add(id);
      if (!mine) V.add('modified-field-missing:' + id);
      if (!nonEmpty(d.basis) || !fields.has(d.basis)) V.add('modify-without-basis:' + id);
      else if (mine && !(Array.isArray(mine.sources) && mine.sources.includes(d.basis))) {
        V.add('modification-provenance-omits-basis:' + id);
      }
      if (mine && same(omit(field, 'expect'), omit(mine, 'expect'))) W.add('modify-without-change:' + id);
    }
    if (d.action === 'drop') {
      if (!nonEmpty(d.reason)) V.add('drop-without-reason:' + id);
      if (fields.has(id)) V.add('dropped-field-present:' + id);
    }
  }

  for (const [id, field] of fields) {
    if (Array.isArray(field.sources) && field.sources.some(source => !fields.has(source))) {
      V.add('provenance-truncated:' + id);
    }
  }
  for (const [id, objection] of sentObjections) {
    const carried = objections.get(id);
    if (!carried) { V.add('objection-lost:' + id); continue; }
    if (!same(objection.basis ?? null, carried.basis ?? null)) V.add('objection-basis-lost:' + id);
    if (!same(omit(objection, 'basis'), omit(carried, 'basis'))) V.add('objection-altered:' + id);
  }
  for (const [id, d] of dispositions) {
    if ((d.action === 'accept' || d.action === 'verify') &&
        [...ancestors(fields, id)].some(source => modified.has(source))) W.add('ancestor-modified:' + id);
  }
  const a = sent?.author?.lineage, b = received.author?.lineage;
  if (!nonEmpty(a) || !nonEmpty(b)) W.add('lineage-undeclared');
  else if (a === b && a !== 'human') W.add('same-lineage');

  return {status: V.size ? 'non-conformant' : 'conformant', violations: sorted(V),
    warnings: sorted(W), counts, pendingReveal: sorted(pending)};
}
