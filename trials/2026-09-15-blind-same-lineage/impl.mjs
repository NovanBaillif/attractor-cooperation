// Independent implementation of Attractor Cooperation Profile 0.2 checks
// (SPEC.md sections 7.1-7.5 and 8.2), written from SPEC.md and
// schema/transmission.schema.json alone. Node.js 24, ESM, no dependencies
// beyond node:crypto.
//
// Exports: inspectLineage, inspectDispute, inspectRecord, inspectHop,
// inspectReveal, driftReport.
//
// See AMBIGUITIES.md for every place the spec text was unclear and the
// literal reading chosen here.

import { createHash } from 'node:crypto';

/* ------------------------------------------------------------------ */
/* Small generic helpers                                              */
/* ------------------------------------------------------------------ */

function isObj(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function isNonEmptyString(x) {
  return typeof x === 'string' && x.length >= 1;
}

// section 2: "Has a member: the JSON object contains that key, whatever
// its value, null included."
function hasMember(obj, key) {
  return isObj(obj) && Object.prototype.hasOwnProperty.call(obj, key);
}

function safeGet(obj, key) {
  return isObj(obj) ? obj[key] : undefined;
}

// section 2: "Sorted: duplicates removed, ascending order of UTF-16 code
// units (the default JavaScript string sort)."
function sortedUnique(iterable) {
  return Array.from(new Set(iterable)).sort();
}

// Pure deep clone (does not use JSON.stringify so that it does not
// silently drop values such as undefined that JSON.stringify would omit).
function deepClone(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(deepClone);
  const out = {};
  for (const k of Object.keys(v)) out[k] = deepClone(v[k]);
  return out;
}

// Shallow copy of a plain object omitting one key (used to compare
// objects "without basis" / "without expect").
function omitKey(obj, key) {
  const out = {};
  if (!isObj(obj)) return out;
  for (const k of Object.keys(obj)) {
    if (k !== key) out[k] = obj[k];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Canonical JSON (section 3.2) and SHA-256                           */
/* ------------------------------------------------------------------ */

class CanonError extends Error {}

// "The canonical form is RFC 8785 (JCS). ... object keys sorted by UTF-16
// code units, no insignificant whitespace, strings and numbers serialized
// as ECMAScript JSON.stringify does. Values that have no JSON
// representation cannot be canonicalized; a check that needs them fails
// as specified."
function canonicalize(value) {
  const inProgress = new WeakSet();

  function canon(v) {
    if (v === null) return 'null';
    const t = typeof v;
    if (t === 'boolean') return v ? 'true' : 'false';
    if (t === 'number') {
      if (Number.isFinite(v)) return JSON.stringify(v);
      return 'null'; // JSON.stringify(NaN|Infinity) === "null"
    }
    if (t === 'string') return JSON.stringify(v);
    if (t === 'undefined' || t === 'function' || t === 'symbol' || t === 'bigint') {
      throw new CanonError('value has no JSON representation');
    }
    if (Array.isArray(v)) {
      if (inProgress.has(v)) throw new CanonError('circular reference');
      inProgress.add(v);
      const parts = v.map((item) => {
        // JSON.stringify turns undefined/function/symbol array items into null.
        if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
          return 'null';
        }
        if (typeof item === 'bigint') throw new CanonError('bigint has no JSON representation');
        return canon(item);
      });
      inProgress.delete(v);
      return '[' + parts.join(',') + ']';
    }
    if (t === 'object') {
      if (inProgress.has(v)) throw new CanonError('circular reference');
      inProgress.add(v);
      const keys = Object.keys(v).filter((k) => {
        const item = v[k];
        return !(item === undefined || typeof item === 'function' || typeof item === 'symbol');
      });
      keys.sort();
      const parts = keys.map((k) => JSON.stringify(k) + ':' + canon(v[k]));
      inProgress.delete(v);
      return '{' + parts.join(',') + '}';
    }
    throw new CanonError('value has no JSON representation');
  }

  return canon(value);
}

function safeCanonicalize(value) {
  try {
    return canonicalize(value);
  } catch (e) {
    if (e instanceof CanonError) return null;
    throw e;
  }
}

function sha256Hex(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

// section 2: "JSON-equal: two values whose canonical forms (section 3.2)
// are identical. Object key order is ignored; array order is not."
//
// Ambiguity: when a value cannot be canonicalized at all (e.g. contains
// undefined, a function, or a cycle), we treat it as not JSON-equal to
// anything, including another equally non-canonicalizable value. See
// AMBIGUITIES.md.
function jsonEqual(a, b) {
  const ca = safeCanonicalize(a);
  const cb = safeCanonicalize(b);
  if (ca === null || cb === null) return false;
  return ca === cb;
}

/* ------------------------------------------------------------------ */
/* Indexing by id (fields / objections), shared across checks         */
/* ------------------------------------------------------------------ */

// "A field whose id is not a non-empty string, or repeats an indexed id,
// adds problem ... and is not indexed."
//
// Ambiguity: to keep the result independent of array order (as section 7
// requires), every occurrence of a duplicated id is excluded from the
// index, not just the "later" ones. See AMBIGUITIES.md.
function indexById(list) {
  const arr = Array.isArray(list) ? list : [];
  const counts = new Map();
  for (const item of arr) {
    const id = isObj(item) ? item.id : undefined;
    if (isNonEmptyString(id)) counts.set(id, (counts.get(id) || 0) + 1);
  }
  const index = new Map();
  let hadProblem = false;
  for (const item of arr) {
    const id = isObj(item) ? item.id : undefined;
    if (!isNonEmptyString(id) || counts.get(id) > 1) {
      hadProblem = true;
      continue;
    }
    index.set(id, item);
  }
  return { index, hadProblem };
}

// Transitive closure over an id->object index, following `.sources`
// arrays, only across edges that land on another indexed id (dangling
// ids are ignored, matching "Transitive sources are computed over
// indexed fields, following sources arrays and ignoring ids that name no
// field.") Cycles are broken defensively so this always terminates.
function computeClosure(index) {
  const memo = new Map();
  const state = new Map(); // 'visiting' | 'done'

  function closure(id) {
    if (memo.has(id)) return memo.get(id);
    if (state.get(id) === 'visiting') return new Set();
    state.set(id, 'visiting');
    const f = index.get(id);
    const raw = isObj(f) && Array.isArray(f.sources) ? f.sources : [];
    const edges = raw.filter((s) => isNonEmptyString(s) && index.has(s));
    const result = new Set();
    for (const s of edges) {
      result.add(s);
      for (const x of closure(s)) result.add(x);
    }
    state.set(id, 'done');
    memo.set(id, result);
    return result;
  }

  for (const id of index.keys()) closure(id);
  return memo;
}

// Shared rule used by 7.3's `objection-basis-missing:O` and 7.4's
// `contest-without-basis:F`.
function objectionBasisInvalid(o) {
  const basis = safeGet(o, 'basis');
  if (!isObj(basis)) return true;
  const citation = basis.citation;
  if (!['controlling', 'secondary', 'none'].includes(citation)) return true;
  if (citation !== 'none' && !isNonEmptyString(basis.sourceId)) return true;
  return false;
}

const VALID_CHANNELS = ['direct', 'cached', 'mirrored', 'republished'];
const VALID_KINDS = ['observed', 'derived', 'reconstructed', 'unknown'];
const VALID_EXPECTS = ['accept', 'verify', 're_derive'];
const VALID_ACTIONS = ['accept', 'verify', 're_derive', 'contest', 'modify', 'drop'];

/* ------------------------------------------------------------------ */
/* 7.1 Lineage                                                        */
/* ------------------------------------------------------------------ */

// roots(fieldId): section 7.1 step 2.
function lineageRoots(startId, index, problems) {
  function go(fieldId, path) {
    if (!index.has(fieldId)) {
      problems.add('missing-field');
      return new Set();
    }
    if (path.includes(fieldId)) {
      problems.add('source-cycle');
      return new Set();
    }
    const f = index.get(fieldId);
    const srcs = f.sources;
    const srcsValid = Array.isArray(srcs) && srcs.every((s) => isNonEmptyString(s));
    if (!srcsValid) {
      problems.add('missing-or-invalid-sources');
      return new Set();
    }
    if (f.kind === 'observed' && srcs.length === 0) {
      return new Set([fieldId]);
    }
    if (!(f.kind === 'derived' || f.kind === 'reconstructed') || srcs.length === 0) {
      problems.add('unknown-or-inconsistent-provenance');
      return new Set();
    }
    const newPath = [...path, fieldId];
    const out = new Set();
    for (const s of srcs) {
      for (const x of go(s, newPath)) out.add(x);
    }
    return out;
  }
  return go(startId, []);
}

// section 7.1 step 3, evaluated per root.
function lineageEvaluateRoot(rootId, index, problems, warnings) {
  const F = index.get(rootId);
  const hasUpstream = hasMember(F, 'upstream');
  const upstreamValid = hasUpstream && isNonEmptyString(F.upstream);
  if (hasUpstream && !upstreamValid) problems.add('invalid-upstream');

  const hasChannel = hasMember(F, 'channel');
  const channelValid = hasChannel && VALID_CHANNELS.includes(F.channel);
  if (hasChannel && !channelValid) problems.add('invalid-channel');

  const key = upstreamValid ? F.upstream : rootId;

  let verifiable = false;
  if (hasChannel && (F.channel === 'direct' || upstreamValid)) verifiable = true;

  if (!hasChannel) {
    warnings.add('observed-channel-undeclared');
  } else if (F.channel !== 'direct' && !upstreamValid) {
    warnings.add('upstream-undeclared');
  }

  return { key, verifiable };
}

function lineageSideKeyMap(rootIds, index, problems, warnings) {
  const map = new Map();
  for (const rid of rootIds) {
    const { key, verifiable } = lineageEvaluateRoot(rid, index, problems, warnings);
    map.set(key, map.has(key) ? map.get(key) && verifiable : verifiable);
  }
  return map;
}

/**
 * inspectLineage({fields, comparison: {left, right}}) — SPEC.md 7.1
 */
export function inspectLineage(input) {
  const inp = isObj(input) ? input : {};
  const comparison = isObj(inp.comparison) ? inp.comparison : {};
  const left = comparison.left;
  const right = comparison.right;

  const { index, hadProblem } = indexById(inp.fields);
  const problems = new Set();
  if (hadProblem) problems.add('missing-or-duplicate-field-id');

  const warnings = new Set();
  const leftRoots = lineageRoots(left, index, problems);
  const rightRoots = lineageRoots(right, index, problems);

  const leftMap = lineageSideKeyMap(leftRoots, index, problems, warnings);
  const rightMap = lineageSideKeyMap(rightRoots, index, problems, warnings);

  const problemsArr = sortedUnique(problems);
  const warningsArr = sortedUnique(warnings);

  if (problemsArr.length > 0) {
    return {
      status: 'unknown',
      sharedSources: [],
      independentRoots: { left: [], right: [] },
      problems: problemsArr,
      warnings: warningsArr,
      interpretation:
        'Problems in the declared field graph (missing, cyclic or inconsistently ' +
        'provenanced fields, or invalid upstream/channel declarations) block any ' +
        'conclusion about independence.',
    };
  }

  const leftKeys = new Set(leftMap.keys());
  const rightKeys = new Set(rightMap.keys());
  const sharedSources = sortedUnique(Array.from(leftKeys).filter((k) => rightKeys.has(k)));
  const indepLeft = sortedUnique(
    Array.from(leftKeys).filter((k) => leftMap.get(k) === true && !rightKeys.has(k))
  );
  const indepRight = sortedUnique(
    Array.from(rightKeys).filter((k) => rightMap.get(k) === true && !leftKeys.has(k))
  );

  let status;
  let independentRoots;
  let interpretation;

  if (sharedSources.length === 0) {
    const allLeftVerifiable = Array.from(leftKeys).every((k) => leftMap.get(k) === true);
    const allRightVerifiable = Array.from(rightKeys).every((k) => rightMap.get(k) === true);
    if (allLeftVerifiable && allRightVerifiable) {
      status = 'independent';
      independentRoots = { left: indepLeft, right: indepRight };
      interpretation = 'The two fields share no declared input, and every input is verifiable.';
    } else {
      status = 'unknown';
      independentRoots = { left: [], right: [] };
      interpretation =
        'The two fields share no declared input, but at least one input lacks a ' +
        'declared channel or upstream, so independence cannot be concluded.';
    }
  } else {
    if (indepLeft.length > 0 || indepRight.length > 0) {
      status = 'dependent-partial';
      interpretation =
        'The two fields share at least one declared input, but at least one side ' +
        'also carries a verifiable input the other lacks: weaker evidence, not independence.';
    } else {
      status = 'dependent';
      interpretation = 'The comparison cannot detect an error in the shared input.';
    }
    independentRoots = { left: indepLeft, right: indepRight };
  }

  return {
    status,
    sharedSources,
    independentRoots,
    problems: problemsArr,
    warnings: warningsArr,
    interpretation,
  };
}

/* ------------------------------------------------------------------ */
/* 7.2 Dispute                                                        */
/* ------------------------------------------------------------------ */

const DISPUTE_FINAL_STATUSES = ['confirmed', 'correction_supported', 'contradicted'];

/**
 * inspectDispute({claim, objection, policy, sources}) — SPEC.md 7.2
 */
export function inspectDispute(input) {
  const inp = isObj(input) ? input : {};
  const claim = inp.claim;
  const objectionIn = inp.objection;
  const policy = inp.policy;
  const effectiveSources = Array.isArray(inp.sources) ? inp.sources : [];

  let status = null;
  let reason = '';
  let controllingEstablished = false;
  let controlling = null;

  // Step 1: structure.
  const structureOk =
    isObj(claim) &&
    isObj(objectionIn) &&
    isObj(policy) &&
    isNonEmptyString(claim.id) &&
    isNonEmptyString(objectionIn.id) &&
    hasMember(claim, 'value') &&
    hasMember(objectionIn, 'proposedValue') &&
    isNonEmptyString(claim.domain) &&
    isNonEmptyString(claim.version);

  if (!structureOk) {
    status = 'unresolved';
    reason = 'claim, objection or policy is missing or malformed.';
  } else {
    // Step 2: policy.
    const policyOk =
      jsonEqual(objectionIn.claimId, claim.id) &&
      jsonEqual(policy.claimId, claim.id) &&
      policy.verified === true &&
      jsonEqual(policy.domain, claim.domain) &&
      jsonEqual(policy.version, claim.version);

    if (!policyOk) {
      status = 'unresolved';
      reason = 'local policy does not verify a controlling source for this claim, domain and version.';
    } else {
      // Step 3: source identity.
      const ids = effectiveSources.map((s) => safeGet(s, 'id'));
      const idsOk = ids.every((id) => isNonEmptyString(id)) && new Set(ids).size === ids.length;

      if (!idsOk) {
        status = 'unresolved';
        reason = 'sources declare invalid or duplicate ids.';
      } else {
        // Step 4: controlling source.
        const found = effectiveSources.find((s) => jsonEqual(safeGet(s, 'id'), policy.sourceId));
        const controllingOk =
          !!found &&
          found.status === 'verified' &&
          jsonEqual(safeGet(found, 'domain'), claim.domain) &&
          jsonEqual(safeGet(found, 'version'), claim.version) &&
          hasMember(found, 'value');

        if (!controllingOk) {
          status = 'unresolved';
          reason = 'no controlling source is established for this claim.';
        } else {
          controllingEstablished = true;
          controlling = found;

          // Step 5: precedence.
          const blocker = effectiveSources.find((s) => {
            if (jsonEqual(safeGet(s, 'id'), controlling.id)) return false; // "another source"
            if (safeGet(s, 'status') !== 'verified') return false;
            if (!jsonEqual(safeGet(s, 'domain'), claim.domain)) return false;
            if (!jsonEqual(safeGet(s, 'version'), claim.version)) return false;
            const sup = safeGet(s, 'supersedes');
            const listsControlling = Array.isArray(sup)
              ? sup.some((x) => jsonEqual(x, controlling.id))
              : jsonEqual(sup, controlling.id);
            if (!listsControlling) return false;
            if (!hasMember(s, 'value')) return false;
            if (jsonEqual(s.value, controlling.value)) return false; // must disagree to block
            return true;
          });

          if (blocker) {
            status = 'unresolved';
            reason =
              'a verified instrument in the same domain and version claims precedence over ' +
              'the controlling source and disagrees with it; local policy must decide which controls.';
          } else {
            // Step 6: status.
            if (jsonEqual(controlling.value, claim.value)) {
              status = 'confirmed';
              reason = 'the controlling source matches the claim.';
            } else if (jsonEqual(controlling.value, objectionIn.proposedValue)) {
              status = 'correction_supported';
              reason = 'the controlling source matches the proposed correction.';
            } else {
              status = 'contradicted';
              reason = 'the controlling source matches neither the claim nor the proposed correction.';
            }
          }
        }
      }
    }
  }

  const sourceId = safeGet(objectionIn, 'sourceId');
  let citation;
  if (!isNonEmptyString(sourceId)) {
    citation = 'none';
  } else if (controllingEstablished && jsonEqual(sourceId, controlling.id)) {
    citation = 'controlling';
  } else {
    citation = 'secondary';
  }

  const proposedValueSupported = DISPUTE_FINAL_STATUSES.includes(status)
    ? jsonEqual(controlling.value, safeGet(objectionIn, 'proposedValue'))
    : null;

  return {
    status,
    value: safeGet(claim, 'value'),
    original: deepClone(claim),
    objection: deepClone(objectionIn),
    reason,
    applied: false,
    objectionAssessment: { citation, proposedValueSupported },
  };
}

/* ------------------------------------------------------------------ */
/* 7.3 Record                                                         */
/* ------------------------------------------------------------------ */

const SEAL_COMMITMENT_RE = /^[0-9a-f]{64}$/;

/**
 * inspectRecord(record) — SPEC.md 7.3
 */
export function inspectRecord(record) {
  const rec = isObj(record) ? record : {};
  const violations = new Set();
  const warnings = new Set();

  if (!isNonEmptyString(rec.id)) violations.add('missing-record-id');

  const { index: fieldIndex, hadProblem: fieldIdProblem } = indexById(rec.fields);
  if (fieldIdProblem) violations.add('missing-or-duplicate-field-id');

  const { index: objIndex, hadProblem: objIdProblem } = indexById(rec.objections);
  if (objIdProblem) violations.add('missing-or-duplicate-objection-id');

  // Per-field checks (7.3 violations/warnings table).
  for (const [fid, f] of fieldIndex) {
    const hasExpect = hasMember(f, 'expect');
    if (hasExpect && !VALID_EXPECTS.includes(f.expect)) {
      violations.add(`invalid-expect:${fid}`);
    }

    const kindValid = VALID_KINDS.includes(f.kind);
    if (!kindValid) violations.add(`invalid-kind:${fid}`);

    const sources = f.sources;
    const sourcesValid = Array.isArray(sources) && sources.every((s) => isNonEmptyString(s));
    if (!sourcesValid) violations.add(`missing-or-invalid-sources:${fid}`);

    if (sourcesValid) {
      const truncated = sources.some((s) => !fieldIndex.has(s));
      if (truncated) violations.add(`provenance-truncated:${fid}`);

      if (kindValid) {
        const isDerivedLike = f.kind === 'derived' || f.kind === 'reconstructed';
        const inconsistent =
          (isDerivedLike && sources.length === 0) ||
          (!isDerivedLike && sources.length > 0); // observed/unknown with sources
        if (inconsistent) violations.add(`inconsistent-provenance:${fid}`);
      }
    }

    const hasSealed = hasMember(f, 'sealed');
    if (hasSealed) {
      const sealed = f.sealed;
      const algOk = isObj(sealed) && sealed.alg === 'sha256-jcs';
      const commitmentOk = isObj(sealed) && typeof sealed.commitment === 'string' && SEAL_COMMITMENT_RE.test(sealed.commitment);
      if (!algOk || !commitmentOk) violations.add(`invalid-seal:${fid}`);
    }

    const hasValue = hasMember(f, 'value');
    if (hasSealed && hasValue) violations.add(`sealed-value-present:${fid}`);

    const effectiveExpect = hasExpect ? f.expect : 'accept';
    if (hasSealed && effectiveExpect !== 're_derive') violations.add(`sealed-without-re-derive:${fid}`);
    if (effectiveExpect === 're_derive' && !hasSealed) violations.add(`re-derive-unsealed:${fid}`);
    if (!hasSealed && !hasValue) violations.add(`missing-value:${fid}`);

    if (f.kind === 'observed') {
      const hasChannel = hasMember(f, 'channel');
      if (hasChannel && !VALID_CHANNELS.includes(f.channel)) {
        violations.add(`invalid-channel:${fid}`);
      }
      if (!hasChannel) {
        warnings.add(`observed-channel-undeclared:${fid}`);
      } else if (VALID_CHANNELS.includes(f.channel) && f.channel !== 'direct' && !isNonEmptyString(f.upstream)) {
        warnings.add(`upstream-undeclared:${fid}`);
      }
    }
  }

  // sealed-value-leak: needs the transitive-sources closure over indexed fields.
  const closure = computeClosure(fieldIndex);
  for (const [fid, f] of fieldIndex) {
    const hasSealed = hasMember(f, 'sealed');
    if (hasSealed) continue;
    const reach = closure.get(fid) || new Set();
    let leaks = false;
    for (const sid of reach) {
      const sf = fieldIndex.get(sid);
      if (hasMember(sf, 'sealed')) {
        leaks = true;
        break;
      }
    }
    if (leaks) violations.add(`sealed-value-leak:${fid}`);
  }

  // source-cycle: bare code, true if any indexed field is its own transitive source.
  let anyCycle = false;
  for (const fid of fieldIndex.keys()) {
    const reach = closure.get(fid) || new Set();
    if (reach.has(fid)) {
      anyCycle = true;
      break;
    }
  }
  if (anyCycle) violations.add('source-cycle');

  // Per-objection checks.
  for (const [oid, o] of objIndex) {
    const targetOk = isNonEmptyString(o.target) && fieldIndex.has(o.target);
    if (!targetOk) violations.add(`objection-target-missing:${oid}`);

    if (objectionBasisInvalid(o)) violations.add(`objection-basis-missing:${oid}`);
  }

  // Record-level warning.
  const lineage = safeGet(rec.author, 'lineage');
  if (!isNonEmptyString(lineage)) warnings.add('lineage-undeclared');

  const violationsArr = sortedUnique(violations);
  const warningsArr = sortedUnique(warnings);

  return {
    status: violationsArr.length === 0 ? 'conformant' : 'non-conformant',
    violations: violationsArr,
    warnings: warningsArr,
  };
}

/* ------------------------------------------------------------------ */
/* 7.4 Hop                                                            */
/* ------------------------------------------------------------------ */

/**
 * inspectHop({sent, receipt}) — SPEC.md 7.4
 */
export function inspectHop(input) {
  const inp = isObj(input) ? input : {};
  const sent = isObj(inp.sent) ? inp.sent : {};
  const receipt = isObj(inp.receipt) ? inp.receipt : {};
  const R = isObj(receipt.record) ? receipt.record : {};

  const violations = new Set();
  const warnings = new Set();
  const counts = { accept: 0, verify: 0, re_derive: 0, contest: 0, modify: 0, drop: 0 };
  const pendingReveal = new Set();
  const modifiedFields = new Set();

  const { index: sentFieldIndex, hadProblem: sentFieldProblem } = indexById(sent.fields);
  const { index: sentObjIndex, hadProblem: sentObjProblem } = indexById(sent.objections);
  if (sentFieldProblem || sentObjProblem) violations.add('sent-record-invalid');

  const { index: RFieldIndex, hadProblem: RFieldProblem } = indexById(R.fields);
  const { index: RObjIndex, hadProblem: RObjProblem } = indexById(R.objections);
  if (RFieldProblem || RObjProblem) violations.add('received-record-invalid');

  const closureR = computeClosure(RFieldIndex);

  // Step 1: parent.
  if (!isNonEmptyString(sent.id) || !jsonEqual(R.parent, sent.id)) {
    violations.add('parent-missing');
  }

  // Step 2: dispositions, indexed by reference (first one counts).
  const dispositionsArr = Array.isArray(receipt.dispositions) ? receipt.dispositions : [];
  const dispByRef = new Map();
  for (const d of dispositionsArr) {
    const ref = isNonEmptyString(safeGet(d, 'field')) ? d.field : '';
    if (!sentFieldIndex.has(ref)) violations.add(`unknown-field-disposition:${ref}`);
    if (dispByRef.has(ref)) {
      violations.add(`duplicate-disposition:${ref}`);
    } else {
      dispByRef.set(ref, d);
    }
  }

  // Step 3: per sent field.
  const sentFieldIds = sortedUnique(sentFieldIndex.keys());
  for (const fid of sentFieldIds) {
    const f = sentFieldIndex.get(fid);
    const d = dispByRef.get(fid);

    if (!d) {
      violations.add(`missing-disposition:${fid}`);
      continue;
    }
    const action = d.action;
    if (!VALID_ACTIONS.includes(action)) {
      violations.add(`invalid-disposition:${fid}`);
      continue;
    }
    counts[action] += 1;

    const isSealed = hasMember(f, 'sealed');
    if (isSealed && action !== 're_derive' && action !== 'drop') {
      violations.add(`sealed-field-not-re-derived:${fid}`);
      continue;
    }

    const rf = RFieldIndex.get(fid);
    const kept = rf !== undefined && jsonEqual(omitKey(f, 'expect'), omitKey(rf, 'expect'));

    if (action === 'accept') {
      if (!kept) violations.add(`altered-on-accept:${fid}`);
    } else if (action === 'verify') {
      if (!kept) violations.add(`altered-on-verify:${fid}`);
      const basisRef = safeGet(d, 'basis');
      if (!isNonEmptyString(basisRef) || !RFieldIndex.has(basisRef)) {
        violations.add(`verify-without-basis:${fid}`);
      } else if (basisRef === fid || (closureR.get(basisRef) || new Set()).has(fid)) {
        violations.add(`circular-verification:${fid}`);
      } else {
        const lin = inspectLineage({ fields: R.fields, comparison: { left: fid, right: basisRef } });
        if (lin.status === 'dependent') warnings.add(`verification-dependent:${fid}`);
        else if (lin.status === 'dependent-partial') warnings.add(`verification-partially-dependent:${fid}`);
        else if (lin.status === 'unknown') warnings.add(`verification-unverifiable:${fid}`);
      }
    } else if (action === 're_derive') {
      if (!isSealed) warnings.add(`re-derivation-unprovable:${fid}`);
      if (rf === undefined || !hasMember(rf, 'value') || hasMember(rf, 'sealed')) {
        violations.add(`re-derivation-missing:${fid}`);
      } else if (isSealed) {
        pendingReveal.add(fid);
      }
    } else if (action === 'contest') {
      if (!kept) violations.add(`original-overwritten:${fid}`);
      const objRef = safeGet(d, 'objection');
      const oR = isNonEmptyString(objRef) ? RObjIndex.get(objRef) : undefined;
      const missingObjection =
        !isNonEmptyString(objRef) || !oR || oR.target !== fid || sentObjIndex.has(objRef);
      if (missingObjection) {
        violations.add(`contest-objection-missing:${fid}`);
      } else if (objectionBasisInvalid(oR)) {
        violations.add(`contest-without-basis:${fid}`);
      }
    } else if (action === 'modify') {
      modifiedFields.add(fid);
      if (rf === undefined) violations.add(`modified-field-missing:${fid}`);
      const basisRef = safeGet(d, 'basis');
      const basisValid = isNonEmptyString(basisRef) && RFieldIndex.has(basisRef);
      if (!basisValid) {
        violations.add(`modify-without-basis:${fid}`);
      } else if (rf !== undefined) {
        const rfSources = Array.isArray(rf.sources) ? rf.sources : [];
        if (!rfSources.includes(basisRef)) violations.add(`modification-provenance-omits-basis:${fid}`);
      }
      if (rf !== undefined && kept) warnings.add(`modify-without-change:${fid}`);
    } else if (action === 'drop') {
      if (!isNonEmptyString(safeGet(d, 'reason'))) violations.add(`drop-without-reason:${fid}`);
      if (rf !== undefined) violations.add(`dropped-field-present:${fid}`);
    }
  }

  // Step 4: every field of R whose declared sources include a dangling id.
  for (const [gid, g] of RFieldIndex) {
    if (Array.isArray(g.sources) && g.sources.some((s) => !RFieldIndex.has(s))) {
      violations.add(`provenance-truncated:${gid}`);
    }
  }

  // Step 5: objections carried unchanged.
  for (const [oid, o] of sentObjIndex) {
    const rO = RObjIndex.get(oid);
    if (!rO) {
      violations.add(`objection-lost:${oid}`);
      continue;
    }
    const sentBasis = hasMember(o, 'basis') ? o.basis : null;
    const rBasis = hasMember(rO, 'basis') ? rO.basis : null;
    if (!jsonEqual(sentBasis, rBasis)) violations.add(`objection-basis-lost:${oid}`);
    if (!jsonEqual(omitKey(o, 'basis'), omitKey(rO, 'basis'))) violations.add(`objection-altered:${oid}`);
  }

  // Step 6: ancestor-modified warning for every counted accept/verify disposition.
  for (const fid of sentFieldIds) {
    const d = dispByRef.get(fid);
    if (!d || !VALID_ACTIONS.includes(d.action)) continue;
    if (d.action !== 'accept' && d.action !== 'verify') continue;
    const reach = closureR.get(fid) || new Set();
    let ancestorModified = false;
    for (const sid of reach) {
      if (modifiedFields.has(sid)) {
        ancestorModified = true;
        break;
      }
    }
    if (ancestorModified) warnings.add(`ancestor-modified:${fid}`);
  }

  // Step 7: lineage declarations.
  const a = safeGet(sent.author, 'lineage');
  const b = safeGet(R.author, 'lineage');
  if (!isNonEmptyString(a) || !isNonEmptyString(b)) {
    warnings.add('lineage-undeclared');
  } else if (jsonEqual(a, b) && a !== 'human') {
    warnings.add('same-lineage');
  }

  const violationsArr = sortedUnique(violations);
  const warningsArr = sortedUnique(warnings);

  return {
    status: violationsArr.length === 0 ? 'conformant' : 'non-conformant',
    violations: violationsArr,
    warnings: warningsArr,
    counts,
    pendingReveal: sortedUnique(pendingReveal),
  };
}

/* ------------------------------------------------------------------ */
/* 7.5 Reveal                                                         */
/* ------------------------------------------------------------------ */

/**
 * inspectReveal({sent, receipt, reveal}) — SPEC.md 7.5
 */
export function inspectReveal(input) {
  const inp = isObj(input) ? input : {};
  const sent = isObj(inp.sent) ? inp.sent : {};
  const receipt = isObj(inp.receipt) ? inp.receipt : {};
  const reveal = isObj(inp.reveal) ? inp.reveal : {};
  const R = isObj(receipt.record) ? receipt.record : {};

  const violations = new Set();

  // Step 1.
  if (!isNonEmptyString(receipt.id) || !jsonEqual(reveal.target, receipt.id)) {
    violations.add('reveal-target-mismatch');
  }

  // Step 2.
  const receiptCanon = safeCanonicalize(receipt);
  let digestOk = false;
  if (receiptCanon !== null) {
    digestOk = safeGet(reveal, 'receiptDigest') === sha256Hex(receiptCanon);
  }
  if (!digestOk) violations.add('receipt-digest-mismatch');

  // Step 3: index reveal items by field, first one counts; flag invalid/duplicate.
  const revealsArr = Array.isArray(reveal.reveals) ? reveal.reveals : [];
  const fieldOccurrences = new Map();
  for (const item of revealsArr) {
    const f = safeGet(item, 'field');
    if (isNonEmptyString(f)) fieldOccurrences.set(f, (fieldOccurrences.get(f) || 0) + 1);
  }
  let dupOrInvalid = false;
  const revealByField = new Map();
  for (const item of revealsArr) {
    const f = safeGet(item, 'field');
    if (!isNonEmptyString(f)) {
      dupOrInvalid = true;
      continue;
    }
    if (fieldOccurrences.get(f) > 1) dupOrInvalid = true;
    if (!revealByField.has(f)) revealByField.set(f, item);
  }
  if (dupOrInvalid) violations.add('duplicate-or-invalid-reveal');

  // Step 4: the fields checked.
  const { index: sentFieldIndex } = indexById(sent.fields);
  const sentSealedIds = new Set();
  for (const [fid, f] of sentFieldIndex) {
    if (hasMember(f, 'sealed')) sentSealedIds.add(fid);
  }

  const dispositionsArr = Array.isArray(receipt.dispositions) ? receipt.dispositions : [];
  const checkedSet = new Set();
  for (const d of dispositionsArr) {
    if (isObj(d) && d.action === 're_derive' && isNonEmptyString(d.field) && sentSealedIds.has(d.field)) {
      checkedSet.add(d.field);
    }
  }
  const checkedFields = sortedUnique(checkedSet);

  const { index: RFieldIndex } = indexById(R.fields);

  const missing = [];
  const results = [];
  for (const F of checkedFields) {
    const item = revealByField.get(F);
    if (!item) {
      missing.push(F);
      continue;
    }
    const sentField = sentFieldIndex.get(F);
    const sealedCommitment = safeGet(sentField.sealed, 'commitment');

    let matches = false;
    if (isNonEmptyString(safeGet(item, 'salt')) && hasMember(item, 'value')) {
      const canon = safeCanonicalize({ field: F, salt: item.salt, value: item.value });
      if (canon !== null) matches = sha256Hex(canon) === sealedCommitment;
    }

    let commitment;
    let outcome;
    if (!matches) {
      violations.add(`commitment-mismatch:${F}`);
      commitment = 'mismatch';
      outcome = 'invalid';
    } else {
      commitment = 'match';
      const rf = RFieldIndex.get(F);
      const agree = rf !== undefined && hasMember(rf, 'value') && jsonEqual(rf.value, item.value);
      outcome = agree ? 'agree' : 'disagree';
    }
    results.push({ field: F, commitment, outcome });
  }

  const violationsArr = sortedUnique(violations);

  let status;
  if (violationsArr.length > 0) status = 'invalid';
  else if (missing.length > 0) status = 'incomplete';
  else status = 'verified';

  return { status, results, missing, violations: violationsArr };
}

/* ------------------------------------------------------------------ */
/* 8.2 Per-hop report                                                 */
/* ------------------------------------------------------------------ */

/**
 * driftReport({sent, receipt, reveal?}) — SPEC.md 8.2
 */
export function driftReport(input) {
  const inp = isObj(input) ? input : {};
  const sent = inp.sent;
  const receipt = inp.receipt;
  const reveal = inp.reveal;
  const hasReveal = reveal !== undefined;

  const recordResult = inspectRecord(sent);
  const hopResult = inspectHop({ sent, receipt });
  const revealResult = hasReveal ? inspectReveal({ sent, receipt, reveal }) : null;

  const violations = sortedUnique([
    ...recordResult.violations.map((v) => `sender/${v}`),
    ...hopResult.violations.map((v) => `receiver/${v}`),
    ...(hasReveal ? revealResult.violations.map((v) => `reveal/${v}`) : []),
  ]);

  const warnings = sortedUnique([
    ...recordResult.warnings.map((v) => `sender/${v}`),
    ...hopResult.warnings.map((v) => `receiver/${v}`),
  ]);

  const pendingReveal = hasReveal ? revealResult.missing : hopResult.pendingReveal;

  let agree = 0;
  let disagree = 0;
  if (hasReveal) {
    for (const r of revealResult.results) {
      if (r.outcome === 'agree') agree += 1;
      else if (r.outcome === 'disagree') disagree += 1;
    }
  }
  const counts = { ...hopResult.counts, re_derive_agree: agree, re_derive_disagree: disagree };

  let level;
  if (violations.length > 0) {
    level = 'red';
  } else if (
    warnings.length > 0 ||
    disagree > 0 ||
    pendingReveal.length > 0 ||
    hopResult.counts.contest > 0 ||
    hopResult.counts.modify > 0 ||
    hopResult.counts.drop > 0
  ) {
    level = 'orange';
  } else {
    level = 'green';
  }

  return { level, counts, violations, warnings, pendingReveal };
}

