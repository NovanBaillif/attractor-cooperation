// SPEC section 7.3 — sender-side conformance of a record before it is transmitted.
import {ancestors, indexById, nonEmpty, sorted} from './canonical.mjs';
import {CHANNELS} from './lineage.mjs';
import {derivationProblems} from './derivation.mjs';

export const KINDS = new Set(['observed', 'derived', 'reconstructed', 'unknown']);
export const EXPECTS = new Set(['accept', 'verify', 're_derive']);
export const CITATIONS = new Set(['controlling', 'secondary', 'none']);
const HEX64 = /^[0-9a-f]{64}$/;

// An objection basis says where the objection comes from; "none" declares a hunch explicitly.
export function validBasis(basis) {
  return basis !== null && typeof basis === 'object' && CITATIONS.has(basis.citation) &&
    (basis.citation === 'none' || nonEmpty(basis.sourceId));
}

export function inspectRecord(record) {
  const violations = new Set(), warnings = new Set();
  if (!nonEmpty(record?.id)) violations.add('missing-record-id');
  const fields = indexById(record?.fields, () => violations.add('missing-or-duplicate-field-id'));
  const sealed = new Set([...fields].filter(([, f]) => Object.hasOwn(f, 'sealed')).map(([id]) => id));

  for (const [id, field] of fields) {
    const expect = field.expect ?? 'accept';
    if (!EXPECTS.has(expect)) violations.add('invalid-expect:' + id);
    if (!KINDS.has(field.kind)) violations.add('invalid-kind:' + id);
    const validSources = Array.isArray(field.sources) && field.sources.every(nonEmpty);
    if (!validSources) violations.add('missing-or-invalid-sources:' + id);
    else {
      if (field.sources.some(source => !fields.has(source))) violations.add('provenance-truncated:' + id);
      const needsSources = field.kind === 'derived' || field.kind === 'reconstructed';
      if (KINDS.has(field.kind) && needsSources !== field.sources.length > 0) {
        violations.add('inconsistent-provenance:' + id);
      }
    }
    if (sealed.has(id)) {
      if (field.sealed?.alg !== 'sha256-jcs' || !HEX64.test(field.sealed?.commitment ?? '')) {
        violations.add('invalid-seal:' + id);
      }
      if (Object.hasOwn(field, 'value')) violations.add('sealed-value-present:' + id);
      if (expect !== 're_derive') violations.add('sealed-without-re-derive:' + id);
    } else {
      if (expect === 're_derive') violations.add('re-derive-unsealed:' + id);
      if (!Object.hasOwn(field, 'value')) violations.add('missing-value:' + id);
    }
    // 0.4: a claim of past verification is worth nothing the receiver can act on unless the cases travel with it.
    // Experiment E15: a memory declaring itself "verified on eight cases" had its error copied on 120 times out of
    // 120; the same error carrying those cases was caught every time. The claim is not the safeguard, the cases are.
    const witness = field.derivation?.witness;
    if (witness !== undefined && !(Array.isArray(witness) && witness.length > 0 && witness.every(w =>
      w !== null && typeof w === 'object' && !Array.isArray(w) && Object.hasOwn(w, 'input') && Object.hasOwn(w, 'output')))) {
      violations.add('invalid-witness:' + id);
    } else if (field.derivation?.verifiedOn !== undefined && witness === undefined) {
      warnings.add('verification-unsupported:' + id);
    }
    if (field.kind === 'observed') {
      if (!Object.hasOwn(field, 'channel')) warnings.add('observed-channel-undeclared:' + id);
      else if (!CHANNELS.has(field.channel)) violations.add('invalid-channel:' + id);
      else if (field.channel !== 'direct' && !nonEmpty(field.upstream)) warnings.add('upstream-undeclared:' + id);
    }
    // 0.3: how the value was obtained, and state carried from the author's own earlier run.
    for (const code of derivationProblems(id, field, fields)) violations.add(code + ':' + id);
    if (nonEmpty(field.upstream) && field.upstream.startsWith('self:') && field.channel !== 'cached') {
      violations.add('self-state-not-cached:' + id);
    }
    const up = ancestors(fields, id);
    if (up.has(id)) violations.add('source-cycle');
    if (!sealed.has(id) && [...up].some(source => sealed.has(source))) violations.add('sealed-value-leak:' + id);
  }

  const objections = indexById(record?.objections, () => violations.add('missing-or-duplicate-objection-id'));
  for (const [id, objection] of objections) {
    if (!fields.has(objection.target)) violations.add('objection-target-missing:' + id);
    if (!validBasis(objection.basis)) violations.add('objection-basis-missing:' + id);
  }
  if (!nonEmpty(record?.author?.lineage)) warnings.add('lineage-undeclared');
  return {status: violations.size ? 'non-conformant' : 'conformant',
    violations: sorted(violations), warnings: sorted(warnings)};
}
