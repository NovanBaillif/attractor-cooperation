// SPEC section 7.6 — replay of a declared derivation by a third party (0.3).
// A replay can show that a declared input yields the value, or that a quotation is present in its source.
// It never shows that the value was produced that way, nor that it is independent of anything (section 7.1).
import {indexById, nonEmpty, same, sorted} from './canonical.mjs';

export function inspectReplay({record, replay} = {}) {
  const problems = new Set();
  const fields = indexById(record?.fields, () => problems.add('record-invalid'));
  const result = (status, reproduced = null) => ({status, reproduced, independence: 'not-established',
    problems: sorted(problems),
    interpretation: 'A replay tests a declaration. It does not show how the value was produced, nor its independence.'});

  const field = nonEmpty(replay?.field) ? fields.get(replay.field) : undefined;
  if (!field) { problems.add('replay-field-missing'); return result('invalid'); }
  const d = field.derivation;
  if (d === null || typeof d !== 'object' || Array.isArray(d)) { problems.add('derivation-undeclared'); return result('invalid'); }

  if (replay.method === 'sufficiency') {
    if (Object.hasOwn(field, 'sealed') || !Object.hasOwn(field, 'value')) { problems.add('value-unavailable'); return result('invalid'); }
    if (!nonEmpty(replay.input) || !fields.has(replay.input)) { problems.add('replay-input-invalid'); return result('invalid'); }
    if (!Object.hasOwn(replay, 'value')) { problems.add('replay-value-missing'); return result('invalid'); }
    const reproduced = same(replay.value, field.value);
    const declared = Array.isArray(d.sufficient) && d.sufficient.includes(replay.input);
    if (!declared) return result('undeclared', reproduced);
    return result(reproduced ? 'confirmed' : 'refuted', reproduced);
  }
  if (replay.method === 'quote') {
    if (d.operation !== 'quoted' || !nonEmpty(d.quote)) { problems.add('quote-undeclared'); return result('invalid'); }
    if (typeof replay.sourceText !== 'string') { problems.add('source-text-missing'); return result('invalid'); }
    const found = replay.sourceText.includes(d.quote);
    return result(found ? 'confirmed' : 'refuted', found);
  }
  problems.add('replay-method-invalid');
  return result('invalid');
}
