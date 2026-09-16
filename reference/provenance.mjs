// SPEC section 7.7 — what a citation actually establishes (0.5 draft).
// Only the span is written: the verbatim bytes, where they sit, when they were fetched and under whose authority.
// contact, access and terminal are DERIVED here and never read from the record: a provenance flag is the most
// compressed form of its own evidence, so it is the field most likely to arrive with nothing behind it
// (terminator2-agent, https://github.com/ai-village-agents/ai-village-external-agents/issues/85#issuecomment-5694802000).
// No network: `access` is computed from a probe result the caller supplies, exactly as 7.6 takes a replay result.
import {indexById, nonEmpty, sorted} from './canonical.mjs';

export const CONTACT = new Set(['cited', 'fetched', 'read', 'unknown']);
export const ACCESS = new Set(['public', 'gated', 'unknown']);
export const DERIVED = ['contact', 'access', 'terminal'];
// A span that says, on its face, that the support is somewhere else. This does not certify that the span
// supports the claim — that axis is not decidable from the artifact and the profile does not pretend to settle it.
const DEFERS = /\b(as required by|as set out in|pursuant to|per section|see also|see |refer to|cf\.|ibid\.?|supra|op\. cit\.)|§\s*\d|\[\d+\]|\(\d{4}\)/i;

export function contactOf(span) {
  if (span === null || typeof span !== 'object' || Array.isArray(span)) return 'unknown';
  if (nonEmpty(span.quote) && nonEmpty(span.locator)) return 'read';
  if (nonEmpty(span.locator) && nonEmpty(span.retrievedAt) && nonEmpty(span.observedAs)) return 'fetched';
  if (nonEmpty(span.locator)) return 'cited';
  return 'unknown';
}
// The probe is one anonymous re-fetch of the locator, reported by whoever ran it.
export function accessOf(probe) {
  if (probe === null || typeof probe !== 'object' || Array.isArray(probe)) return 'unknown';
  if (probe.anonymous === 'same-bytes') return 'public';
  if (probe.anonymous === 'different-bytes' || probe.anonymous === 'refused') return 'gated';
  return 'unknown';
}
export function terminalOf(span) {
  if (span === null || typeof span !== 'object' || Array.isArray(span) || !nonEmpty(span.quote)) return 'unknown';
  return !DEFERS.test(span.quote);
}

export function inspectProvenance({record, probes} = {}) {
  const violations = new Set(), warnings = new Set();
  const fields = indexById(record?.fields, () => violations.add('record-invalid'));
  const given = probes !== null && typeof probes === 'object' && !Array.isArray(probes) ? probes : {};
  const spans = {};
  for (const [id, field] of fields) {
    const d = field.derivation;
    if (d === null || typeof d !== 'object' || Array.isArray(d)) continue;
    // The three derived members are computed, never written. Writing one is a violation and not a warning:
    // the reassuring value must cost the most to write, and the cheapest way to enforce that is to forbid the pen.
    for (const member of DERIVED) if (Object.hasOwn(d, member)) violations.add(`derived-field-written:${id}`);
    if (!Object.hasOwn(d, 'span')) continue;
    const span = d.span;
    if (span === null || typeof span !== 'object' || Array.isArray(span)) { violations.add(`invalid-span:${id}`); continue; }
    if (!nonEmpty(span.locator)) violations.add(`span-without-locator:${id}`);
    if (nonEmpty(span.quote) && !nonEmpty(span.observedAs)) warnings.add(`authority-undeclared:${id}`);
    const contact = contactOf(span), access = accessOf(given[id]), terminal = terminalOf(span);
    // A gated span is a real span and still `read`. What it is not is transmissible: a downstream reader
    // cannot become a witness to it, so the claim is checkable only by the party asserting it.
    if (contact === 'read' && access === 'gated') warnings.add(`span-not-transmissible:${id}`);
    if (contact === 'read' && access === 'unknown') warnings.add(`access-unprobed:${id}`);
    if (contact === 'read' && terminal === false) warnings.add(`span-defers:${id}`);
    spans[id] = {contact, access, terminal};
  }
  return {status: violations.size ? 'non-conformant' : 'conformant', spans,
    violations: sorted(violations), warnings: sorted(warnings),
    interpretation: 'A span says what was read and whether anyone else can read it. It does not establish that the span supports the claim.'};
}
