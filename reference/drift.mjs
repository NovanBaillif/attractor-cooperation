// SPEC section 8 — the per-hop report shown to the human operator.
import {inspectRecord} from './record.mjs';
import {inspectHop} from './hop.mjs';
import {inspectReveal} from './reveal.mjs';

export function driftReport({sent, receipt, reveal} = {}) {
  const sender = inspectRecord(sent);
  const hop = inspectHop({sent, receipt});
  const revealed = reveal !== undefined && reveal !== null ? inspectReveal({sent, receipt, reveal}) : null;
  const outcomes = revealed ? revealed.results.map(r => r.outcome) : [];
  const agree = outcomes.filter(o => o === 'agree').length;
  const disagree = outcomes.filter(o => o === 'disagree').length;
  const violations = [
    ...sender.violations.map(v => 'sender/' + v),
    ...hop.violations.map(v => 'receiver/' + v),
    ...(revealed ? revealed.violations : []).map(v => 'reveal/' + v)
  ].sort();
  const warnings = [...sender.warnings.map(w => 'sender/' + w), ...hop.warnings.map(w => 'receiver/' + w)].sort();
  const pendingReveal = revealed ? revealed.missing : hop.pendingReveal;
  const attention = warnings.length > 0 || disagree > 0 || pendingReveal.length > 0 ||
    hop.counts.contest + hop.counts.modify + hop.counts.drop > 0;
  return {level: violations.length ? 'red' : attention ? 'orange' : 'green',
    counts: {...hop.counts, re_derive_agree: agree, re_derive_disagree: disagree},
    violations, warnings, pendingReveal};
}
