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
//      This is the experiment's rule applied to its own results.
import {createHash} from 'node:crypto';

export const VERDICTS = ['DISTINGUISHABLE', 'INDISTINGUISHABLE', 'UNKNOWN'];

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
  return {artifact: canonical(artifact), fetches, quoteInSource, reruns, probe, logOrder};
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
  const oP = canonical(observe(kase.P, verifier));
  const differing = [];
  for (const notP of kase.notP ?? []) {
    const oN = canonical(observe(notP, verifier));
    if (oN === oP) return {verdict: 'INDISTINGUISHABLE', witness: notP.name ?? '(unnamed not-P world)', observation: oP};
    differing.push(notP.name ?? '(unnamed)');
  }
  if (!kase.adversariesClosed) {
    return {verdict: 'UNKNOWN', reason: `no witness among ${differing.length} listed adversaries, but the adversary space is open`, differing};
  }
  return {verdict: 'DISTINGUISHABLE', differing};
}

// The status a transmitted claim may carry, derived and never copied from the claim itself.
// `claim: true` written by the sender moves nothing: only the check does.
export function statusFor(kase, observedWorld) {
  const r = distinguishabilityCheck(kase);
  if (r.verdict !== 'DISTINGUISHABLE') return {status: r.verdict === 'INDISTINGUISHABLE' ? 'asserted' : 'unknown', because: r};
  const matchesP = canonical(observe(observedWorld, kase.verifier ?? {})) === canonical(observe(kase.P, kase.verifier ?? {}));
  return {status: matchesP ? 'verified' : 'contested', because: r};
}
