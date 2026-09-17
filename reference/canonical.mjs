// Canonical JSON (RFC 8785 / JCS form for the JSON values used by this profile) and SHA-256.
// Reference implementation of attractor-cooperation/0.5. Not a truth, identity or authority verifier.
import {createHash} from 'node:crypto';

export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort()
      .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  if (value === undefined || (typeof value === 'number' && !Number.isFinite(value))) {
    throw new TypeError('Value has no JSON representation.');
  }
  return JSON.stringify(value);
}

export const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
export const commitmentOf = (field, salt, value) => sha256(canonical({field, salt, value}));
export const digestOf = value => sha256(canonical(value));

// JSON equality: same canonical form (object key order ignored, array order kept).
export function same(a, b) {
  try { return canonical(a) === canonical(b); } catch { return false; }
}

export const nonEmpty = value => typeof value === 'string' && value.length > 0;
export const sorted = values => [...new Set(values)].sort();

export function omit(object, key) {
  const copy = {...object};
  delete copy[key];
  return copy;
}

// Map of id -> item. An empty id, or an id that occurs more than once, is reported through
// onProblem and no occurrence of it is indexed: which duplicate "wins" never depends on order.
export function indexById(items, onProblem, key = item => item?.id) {
  const list = Array.isArray(items) ? items : [];
  const seen = new Map();
  for (const item of list) {
    const id = key(item);
    if (nonEmpty(id)) seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  const map = new Map();
  for (const item of list) {
    const id = key(item);
    if (!nonEmpty(id) || seen.get(id) > 1) onProblem(id);
    else map.set(id, item);
  }
  return map;
}

// Every id reachable from a field by following sources one or more times (cycles tolerated).
// An id that names no field is included, but has no sources of its own.
export function ancestors(graph, id) {
  const seen = new Set();
  const stack = [...(Array.isArray(graph.get(id)?.sources) ? graph.get(id).sources : [])];
  while (stack.length) {
    const next = stack.pop();
    if (typeof next !== 'string' || seen.has(next)) continue;
    seen.add(next);
    const field = graph.get(next);
    if (Array.isArray(field?.sources)) stack.push(...field.sources);
  }
  return seen;
}
