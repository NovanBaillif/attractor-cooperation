// SPEC section 7.1 — lineage check between two fields of one record.
import {indexById, nonEmpty, sorted} from './canonical.mjs';

const DERIVED = new Set(['derived', 'reconstructed']);
export const CHANNELS = new Set(['direct', 'cached', 'mirrored', 'republished']);

export function inspectLineage(input) {
  const problems = new Set(), warnings = new Set();
  const graph = indexById(input?.fields, () => problems.add('missing-or-duplicate-field-id'));

  function roots(id, visiting = new Set()) {
    if (!graph.has(id)) { problems.add('missing-field'); return []; }
    if (visiting.has(id)) { problems.add('source-cycle'); return []; }
    const field = graph.get(id);
    if (!Array.isArray(field.sources) || field.sources.some(s => !nonEmpty(s))) {
      problems.add('missing-or-invalid-sources'); return [];
    }
    if (field.kind === 'observed' && field.sources.length === 0) return [id];
    if (!DERIVED.has(field.kind) || field.sources.length === 0) {
      problems.add('unknown-or-inconsistent-provenance'); return [];
    }
    const path = new Set(visiting).add(id);
    return field.sources.flatMap(source => roots(source, path));
  }

  // A root is keyed by its declared upstream authority, otherwise by its own id.
  function describe(rootId) {
    const field = graph.get(rootId);
    if (Object.hasOwn(field, 'upstream') && !nonEmpty(field.upstream)) problems.add('invalid-upstream');
    if (Object.hasOwn(field, 'channel') && !CHANNELS.has(field.channel)) problems.add('invalid-channel');
    let verifiable = true;
    if (!Object.hasOwn(field, 'channel')) { warnings.add('observed-channel-undeclared'); verifiable = false; }
    else if (field.channel !== 'direct' && !nonEmpty(field.upstream)) {
      warnings.add('upstream-undeclared'); verifiable = false;
    }
    return {key: nonEmpty(field.upstream) ? field.upstream : rootId, verifiable};
  }

  function side(id) {
    const keys = new Map();
    for (const rootId of new Set(roots(id))) {
      const {key, verifiable} = describe(rootId);
      keys.set(key, (keys.get(key) ?? true) && verifiable);
    }
    return keys;
  }

  const left = side(input?.comparison?.left);
  const right = side(input?.comparison?.right);
  const result = (status, sharedSources = [], independentRoots = {left: [], right: []}) => ({
    status, sharedSources, independentRoots, problems: sorted(problems), warnings: sorted(warnings),
    interpretation: 'Declared source paths only; provenance is not authenticated.'
  });
  if (problems.size) return result('unknown');

  const shared = sorted([...left.keys()].filter(key => right.has(key)));
  const own = (a, b) => sorted([...a].filter(([key, ok]) => ok && !b.has(key)).map(([key]) => key));
  const independentRoots = {left: own(left, right), right: own(right, left)};
  if (shared.length === 0) {
    const allVerifiable = [...left.values(), ...right.values()].every(Boolean);
    return allVerifiable ? result('independent', [], independentRoots) : result('unknown');
  }
  const partial = independentRoots.left.length > 0 || independentRoots.right.length > 0;
  return result(partial ? 'dependent-partial' : 'dependent', shared, independentRoots);
}
