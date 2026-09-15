// SPEC section 7.2 — status of a disputed claim against a locally designated controlling source.
import {nonEmpty, same, sorted} from './canonical.mjs';

const supersedesOf = source =>
  typeof source?.supersedes === 'string' ? [source.supersedes]
    : Array.isArray(source?.supersedes) ? source.supersedes.filter(nonEmpty) : [];

export function inspectDispute(input) {
  const {claim, objection, policy} = input || {};
  const original = structuredClone(claim ?? null);
  const preservedObjection = structuredClone(objection ?? null);
  let controlling = null;
  let warnings = [];

  const result = (status, reason) => {
    const cited = objection?.sourceId;
    const citation = !nonEmpty(cited) ? 'none'
      : controlling && cited === controlling.id ? 'controlling' : 'secondary';
    const decided = ['confirmed', 'correction_supported', 'contradicted'].includes(status);
    return {status, value: original?.value, original, objection: preservedObjection, reason,
      applied: false, objectionAssessment: {citation,
        proposedValueSupported: decided ? same(controlling.value, objection.proposedValue) : null},
      warnings};
  };

  if (!claim || !objection || !policy || !nonEmpty(claim.id) || !nonEmpty(objection.id) ||
      !Object.hasOwn(claim, 'value') || !Object.hasOwn(objection, 'proposedValue') ||
      !['domain', 'version'].every(key => nonEmpty(claim[key]))) {
    return result('unresolved', 'Missing claim, objection or local policy.');
  }
  if (objection.claimId !== claim.id || policy.claimId !== claim.id || policy.verified !== true ||
      policy.domain !== claim.domain || policy.version !== claim.version) {
    return result('unresolved', 'Unverified, stale or differently scoped local policy.');
  }
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const ids = sources.map(source => source?.id);
  if (ids.some(id => !nonEmpty(id)) || new Set(ids).size !== ids.length) {
    return result('unresolved', 'Source identity missing or in conflict.');
  }
  const candidate = sources.find(source => source.id === policy.sourceId);
  if (!candidate || candidate.status !== 'verified' || candidate.domain !== claim.domain ||
      candidate.version !== claim.version || !Object.hasOwn(candidate, 'value')) {
    return result('unresolved', 'Applicable source missing, unverified or out of scope.');
  }
  controlling = candidate;
  // 0.2.1 (Clara, bonyohana, issue #84): a verified same-scope source that contradicts the controlling one
  // without claiming precedence is reported, never allowed to change the status.
  const contradicting = sources.filter(source => source !== candidate && source.status === 'verified' &&
    source.domain === claim.domain && source.version === claim.version && Object.hasOwn(source, 'value') &&
    !same(source.value, candidate.value));
  warnings = sorted(contradicting.filter(source => !supersedesOf(source).includes(candidate.id))
    .map(source => 'contradicted-undeclared:' + source.id));
  const rival = contradicting.find(source => supersedesOf(source).includes(candidate.id));
  if (rival) {
    return result('unresolved', 'Applicable source disputed: a verified same-scope instrument claims precedence; local policy must adjudicate.');
  }
  if (same(candidate.value, claim.value)) {
    return result('confirmed', 'The controlling source supports the original claim.');
  }
  if (same(candidate.value, objection.proposedValue)) {
    return result('correction_supported', 'The controlling source supports the proposed value; the original remains intact.');
  }
  return result('contradicted', 'The controlling source contradicts the original and does not support the proposed value.');
}
