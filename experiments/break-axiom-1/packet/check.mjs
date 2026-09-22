// Break Axiom 1 — the distinguishability check.
//
// Axiom 1: a property P may be called verified for a verifier V only if no world where P is false produces,
// for V, the same observation as the world where P is true.
//
// This is the definition of knowledge in epistemic logic (Hintikka 1962; Fagin, Halpern, Moses & Vardi,
// "Reasoning About Knowledge", 1995): V knows P iff P holds in every world V cannot tell apart from the actual
// one. It is also the shape of an indistinguishability game in cryptography: the adversary picks the worst
// not-P world. Nothing here is new; see prior-art.md. What is being tested is whether ATTRACTOR's own
// published states survive it.
//
// Three rules, enforced by construction and by test:
//   1. `observe` never reads `world.truth`. The hidden truth is what the verifier is trying to learn; if the
//      observation could see it, every check would pass trivially.
//   2. The verdict is existential over the adversary: ONE not-P world with the same observation is enough
//      for INDISTINGUISHABLE, and that world is returned as the witness.
//   3. DISTINGUISHABLE requires the adversary list to be declared closed. When it is open, "no witness found
//      among the listed adversaries" is reported as UNKNOWN — the absence of a counterexample is not a proof.
//      This is the experiment's rule applied to its own results. Since 0.5 a closure must also be non-empty,
//      name who closed it and state what it assumes; the verdict carries all three.
//   Separating one not-P world is necessary, never sufficient: `rederived-under-probe` separates the naive
//   copier and still fails on the copier that recognises probes.
import {createHash} from 'node:crypto';

export const VERDICTS = ['DISTINGUISHABLE', 'INDISTINGUISHABLE', 'UNKNOWN'];

// The representation boundary (asked for by Songbo Bu, by private mail, 19 Sept 2026, named with his permission for this point). Two artifacts are "the same" when their
// canonical forms are equal: objects compared with sorted keys, values as JSON. That is NOT a comparison of the
// original wire bytes — whitespace, key order, number spelling and encoding are erased before comparing. So this
// instrument only speaks about what survives canonicalisation. If a verifier could see a wire-level difference,
// the case must carry it as an explicit field of the artifact (for example `wire: '<the exact bytes>'`);
// otherwise that difference is outside the model and no verdict here covers it.
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value ?? null);
}
const sha = s => createHash('sha256').update(String(s)).digest('hex').slice(0, 16);

// What V can see of a world: the transmitted artifact, plus the results of V's OWN actions, bounded by V's
// capabilities. `world.truth` is deliberately not referenced anywhere in this function.
export function observe(world, verifier) {
  const artifact = world.artifact ?? {};
  const env = world.environment ?? {};
  const sources = env.sources ?? {};
  const spans = Array.isArray(artifact.spans) ? artifact.spans : [];
  const fetches = {};
  const quoteInSource = {};
  for (const span of spans) {
    const loc = span?.locator;
    if (typeof loc !== 'string') continue;
    if (!verifier.canFetch) { fetches[loc] = 'not-attempted'; quoteInSource[loc] = 'not-attempted'; continue; }
    const src = sources[loc];
    const allowed = src && (src.public || (verifier.credentials ?? []).includes(loc));
    if (!src) { fetches[loc] = 'not-found'; quoteInSource[loc] = 'unknown'; continue; }
    if (!allowed) { fetches[loc] = 'refused'; quoteInSource[loc] = 'unknown'; continue; }
    fetches[loc] = 'ok:' + sha(src.bytes);
    quoteInSource[loc] = typeof span.quote === 'string' && span.quote.length > 0
      ? String(src.bytes).includes(span.quote) : 'no-quote';
  }
  // Re-running a tool is an action of V, possible only when V holds that tool and the inputs.
  const reruns = {};
  for (const call of Array.isArray(artifact.toolCalls) ? artifact.toolCalls : []) {
    const tool = env.tools?.[call.tool];
    if (!(verifier.canRerun ?? []).includes(call.tool) || typeof tool !== 'function') { reruns[call.tool] = 'not-attempted'; continue; }
    reruns[call.tool] = canonical(tool(call.input));
  }
  // A perturbation probe: V sends deliberately altered inputs and reads the answer back. Only meaningful
  // when the world defines how the agent responds to a probe — that response is behaviour, which is
  // observable, unlike the internal procedure that produced it.
  const probe = verifier.perturb && typeof env.respondToProbe === 'function' ? canonical(env.respondToProbe(verifier.perturb)) : 'not-attempted';
  // An append-only log kept by a third party (the commit–reveal of SPEC 7.5): V reads the ORDER in which
  // events were recorded there. The log belongs to the environment, not to the sender, which is what makes
  // it evidence; what the sender writes about that order inside its artifact is only a claim.
  const logOrder = verifier.readsLog && Array.isArray(env.log) ? env.log.map(e => e.event) : 'not-attempted';
  // A membership check against the log as it stands NOW (a proof endpoint that validates against the live head).
  // It answers "is the entry in the log?", never "was it there at the time it claims" — see the live-head case.
  const inclusionNow = verifier.checksInclusionNow && Array.isArray(env.log)
    ? env.log.some(e => e.event === artifact.logEntry) : 'not-attempted';
  return {artifact: canonical(artifact), fetches, quoteInSource, reruns, probe, logOrder, inclusionNow};
}

// Test #001 asks: "if the property were false, could the RECEIVED artifact be exactly identical?" So the
// adversary must reproduce the artifact V actually received and may only vary what V cannot see directly —
// the hidden truth and the environment. A not-P world with a different artifact answers a different
// question: V would simply be holding another artifact. The first version of this corpus got that wrong on
// the gated-source case and concluded UNKNOWN from two different quotes; the rule below makes the mistake
// impossible to repeat.
export class MalformedCase extends Error {}

export function distinguishabilityCheck(kase) {
  const verifier = kase.verifier ?? {};
  const artifactP = canonical(kase.P?.artifact ?? {});
  for (const notP of kase.notP ?? []) {
    if (canonical(notP.artifact ?? {}) !== artifactP) {
      throw new MalformedCase(`${kase.id}: adversary "${notP.name}" changes the received artifact; it may only change what V cannot see`);
    }
  }
  const obsP = observe(kase.P, verifier);
  const oP = canonical(obsP);
  const differing = [];
  // The refuter of each not-P world: which of V's own observations would have come out differently had that
  // world been the real one. The operator's rule (Novan Baillif, 18 Sept 2026): replay the scene to try to
  // refute it; if the replay cannot fail, it is not the way to get the proof. A DISTINGUISHABLE verdict
  // therefore says, world by world, what would have made it fail.
  const refuters = [];
  for (const notP of kase.notP ?? []) {
    const obsN = observe(notP, verifier);
    const oN = canonical(obsN);
    if (oN === oP) return {verdict: 'INDISTINGUISHABLE', witness: notP.name ?? '(unnamed not-P world)', observation: oP};
    differing.push(notP.name ?? '(unnamed)');
    refuters.push({world: notP.name ?? '(unnamed)', fields: Object.keys(obsP).filter(k => canonical(obsP[k]) !== canonical(obsN[k]))});
  }
  if (!kase.adversariesClosed) {
    return {verdict: 'UNKNOWN', reason: `no witness among ${differing.length} listed adversaries, but the adversary space is open`, differing};
  }
  // A closed EMPTY list is vacuous (Songbo Bu, by private mail, 19 Sept 2026, named with his permission for this point): with no not-P world, nothing was separated, and
  // "no witness found" holds trivially. Up to 0.4 this returned DISTINGUISHABLE.
  if (differing.length === 0) {
    return {verdict: 'UNKNOWN', reason: 'the adversary list is declared closed but lists no not-P world: nothing was separated', differing};
  }
  // "Who closed the list?" (deep-seeker, The Colony, 18 Sept 2026). A closed list of not-P worlds is itself a
  // claim, made by whoever wrote it. A closure that names no closer is treated as open; a named one travels
  // with the verdict, so a reader can see that DISTINGUISHABLE means "as closed by X" and reopen it by adding
  // a world that reproduces the received artifact.
  if (typeof kase.closedBy !== 'string' || !kase.closedBy.trim()) {
    return {verdict: 'UNKNOWN', reason: 'the adversary list is declared closed, but nobody is named as having closed it', differing};
  }
  // A closure holds only under what it assumes (cassini, Longcat, mindgrapez on The Colony; a reviewer by private mail,
  // 18-19 Sept 2026). The assumptions travel with the verdict, next to who closed the list and what the verifier
  // could do: "distinguishable for this V, with these sensors, if these assumptions hold". A closure that states
  // no assumption is treated as open.
  const assumptions = Array.isArray(kase.assumptions) ? kase.assumptions.filter(a => typeof a === 'string' && a.trim()) : [];
  if (assumptions.length === 0) {
    return {verdict: 'UNKNOWN', reason: 'the adversary list is declared closed, but the closure states no assumption', differing};
  }
  return {verdict: 'DISTINGUISHABLE', closedBy: kase.closedBy, assumptions, sensorium: verifier, differing, refuters};
}

// The status a transmitted claim may carry, derived and never copied from the claim itself.
// `claim: true` written by the sender moves nothing: only the check does.
export function statusFor(kase, observedWorld) {
  const r = distinguishabilityCheck(kase);
  if (r.verdict !== 'DISTINGUISHABLE') return {status: r.verdict === 'INDISTINGUISHABLE' ? 'asserted' : 'unknown', because: r};
  const matchesP = canonical(observe(observedWorld, kase.verifier ?? {})) === canonical(observe(kase.P, kase.verifier ?? {}));
  return {status: matchesP ? 'verified' : 'contested', because: r};
}
