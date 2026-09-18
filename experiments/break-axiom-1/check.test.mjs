// What the check must hold, including against itself.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observe, distinguishabilityCheck, statusFor, canonical, MalformedCase, VERDICTS} from './check.mjs';
import {CASES} from './cases/index.mjs';
import {runAdversarial} from './adversarial/index.mjs';

test('the observation never reads the hidden truth', () => {
  for (const c of CASES) {
    const world = structuredClone({...c.P, environment: undefined});
    world.environment = c.P.environment;
    const before = canonical(observe(world, c.verifier));
    world.truth = {tampered: true, anything: [1, 2, 3]};
    assert.equal(canonical(observe(world, c.verifier)), before, `${c.id}: changing the truth changed the observation`);
  }
});

test('one matching adversary is enough for INDISTINGUISHABLE, and it is named', () => {
  const c = CASES.find(x => x.id === 'rederived-under-probe');
  const r = distinguishabilityCheck(c);
  assert.equal(r.verdict, 'INDISTINGUISHABLE');
  assert.match(r.witness, /recognises probes/);
});

test('an open adversary space never yields DISTINGUISHABLE', () => {
  const c = {...CASES.find(x => x.id === 'quote-in-public-source'), adversariesClosed: false};
  assert.equal(distinguishabilityCheck(c).verdict, 'UNKNOWN');
});

test('a closed list that names nobody as its closer never yields DISTINGUISHABLE', () => {
  const c = {...CASES.find(x => x.id === 'quote-in-public-source')};
  delete c.closedBy;
  assert.equal(distinguishabilityCheck(c).verdict, 'UNKNOWN');
  const named = distinguishabilityCheck(CASES.find(x => x.id === 'quote-in-public-source'));
  assert.equal(named.verdict, 'DISTINGUISHABLE');
  assert.match(named.closedBy, /not re-closed by anyone else/);
});

test('an adversary that changes the received artifact is rejected, not silently compared', () => {
  const c = structuredClone(CASES.find(x => x.id === 'quote-in-gated-source'));
  c.notP[0].artifact = {spans: [{locator: 'https://example.org/tarif-2026', quote: 'autre chose'}]};
  assert.throws(() => distinguishabilityCheck(c), MalformedCase);
});

test('a sender writing claim:true never makes a status "verified"', () => {
  for (const c of CASES) {
    const world = {...c.P, artifact: {...c.P.artifact, claim: true, verified: true, sourced: true}};
    const variant = {...c, P: world, notP: c.notP.map(n => ({...n, artifact: world.artifact}))};
    const s = statusFor(variant, world).status;
    if (s === 'verified') {
      // Only these may reach "verified", and each through something the SENDER does not write: the verifier's
      // own fetch for the first two, a third-party log for the commit–reveal case (under its stated
      // assumption). Adding a case here must be a decision, which is why the list is explicit.
      assert.ok(['quote-in-public-source', 'source-accessible-to-v', 'not-copied-commit-reveal-sealed'].includes(c.id), `${c.id} reached verified`);
    }
  }
});

test('every case returns the verdict the corpus commits to', () => {
  for (const c of CASES) assert.equal(distinguishabilityCheck(c).verdict, c.expected, c.id);
});

test('every verdict is one of three words, never a score', () => {
  for (const c of CASES) assert.ok(VERDICTS.includes(distinguishabilityCheck(c).verdict));
});

test('the three counterexamples against the published profile still reproduce', () => {
  const results = runAdversarial();
  assert.equal(results.length, 3);
  for (const r of results) assert.equal(r.broken, true, `${r.id} no longer breaks the profile — if the profile was fixed, move it to resolved`);
  const a1 = results.find(r => r.id.startsWith('A1'));
  assert.deepEqual([a1.profile.contact, a1.profile.access, a1.profile.warnings.length], ['read', 'public', 0]);
});
