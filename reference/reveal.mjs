// SPEC section 7.5 — sealed re-derivation: commitment, binding to the receipt, outcome.
import {commitmentOf, digestOf, indexById, nonEmpty, same, sorted} from './canonical.mjs';

export function inspectReveal({sent, receipt, reveal} = {}) {
  const violations = new Set(), results = [], missing = [];
  const sentFields = indexById(sent?.fields, () => {});
  const fields = indexById(receipt?.record?.fields, () => {});
  if (!nonEmpty(receipt?.id) || reveal?.target !== receipt.id) violations.add('reveal-target-mismatch');
  let digest = null;
  try { digest = digestOf(receipt); } catch { digest = null; }
  if (digest === null || reveal?.receiptDigest !== digest) violations.add('receipt-digest-mismatch');

  // A field revealed twice is reported and none of its items is used.
  const items = indexById(reveal?.reveals, () => violations.add('duplicate-or-invalid-reveal'), item => item?.field);
  const reDerived = (Array.isArray(receipt?.dispositions) ? receipt.dispositions : [])
    .filter(d => d?.action === 're_derive' && Object.hasOwn(sentFields.get(d.field) ?? {}, 'sealed'))
    .map(d => d.field);

  for (const id of sorted(reDerived)) {
    const item = items.get(id);
    if (!item) { missing.push(id); continue; }
    let match = false;
    try {
      match = nonEmpty(item.salt) && Object.hasOwn(item, 'value') &&
        commitmentOf(id, item.salt, item.value) === sentFields.get(id).sealed?.commitment;
    } catch { match = false; }
    if (!match) violations.add('commitment-mismatch:' + id);
    const mine = fields.get(id);
    const agree = mine && Object.hasOwn(mine, 'value') && same(mine.value, item.value);
    results.push({field: id, commitment: match ? 'match' : 'mismatch',
      outcome: !match ? 'invalid' : agree ? 'agree' : 'disagree'});
  }
  return {status: violations.size ? 'invalid' : missing.length ? 'incomplete' : 'verified',
    results, missing: sorted(missing), violations: sorted(violations)};
}
