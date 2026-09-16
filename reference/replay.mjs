// SPEC section 7.6 — replay of a declared derivation by a third party (0.3).
// A replay can show that a declared input yields the value, or that a quotation is present in its source.
// It never shows that the value was produced that way, nor that it is independent of anything (section 7.1).
import {indexById, nonEmpty, same, sorted} from './canonical.mjs';

export function inspectReplay({record, replay} = {}) {
  const problems = new Set(), warnings = new Set();
  const fields = indexById(record?.fields, () => problems.add('record-invalid'));
  // 0.3.1: a replay is only a second sample if its seat differs from the author's (terminator2-agent).
  if (!nonEmpty(replay?.lineage)) warnings.add('replayer-lineage-undeclared');
  else if (replay.lineage === record?.author?.lineage && replay.lineage !== 'human') warnings.add('same-lineage-replay');
  const result = (status, reproduced = null, extra = {}) => ({status, reproduced, ...extra, independence: 'not-established',
    problems: sorted(problems), warnings: sorted(warnings),
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
  // 0.4: worked cases the author declares its own procedure reproduces. A receiver runs them and says what it got.
  // Experiment E15 (16/09/2026): a stated rule and its written reasons never stopped a false memory from being
  // copied on, in 240 calls out of 240; worked cases that the stated rule fails stopped it every time.
  if (replay.method === 'witness') {
    const witness = d.witness;
    if (!Array.isArray(witness) || witness.length === 0) { problems.add('witness-undeclared'); return result('invalid'); }
    if (!witness.every(w => w !== null && typeof w === 'object' && !Array.isArray(w) && Object.hasOwn(w, 'input') && Object.hasOwn(w, 'output'))) {
      problems.add('witness-invalid'); return result('invalid');
    }
    if (!Array.isArray(replay.produced) || replay.produced.length !== witness.length) { problems.add('replay-produced-invalid'); return result('invalid'); }
    const matched = witness.filter((w, i) => same(w.output, replay.produced[i])).length;
    const reproduced = matched === witness.length;
    // The author's own cases contradict the author's own declaration: nothing about the replayer is in question.
    if (!reproduced) warnings.add('self-refuting-witness');
    return result(reproduced ? 'confirmed' : 'refuted', reproduced, {cases: {matched, total: witness.length}});
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
