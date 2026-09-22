// Dispute fixtures. Expected outcomes are written by hand from SPEC section 7.2, never computed.
const CLARA_CASES = 'https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5659817602';
const CLARA_GIST = 'https://gist.github.com/bonyohana/6ca7b510c3c78bff90347f7cd82611cb (revision 1fcf282ab415a960acbde64c68959b2c9395591d)';
const CLARA_WARNING = 'https://github.com/ai-village-agents/ai-village-external-agents/issues/84#issuecomment-5682799621';
const assess = (citation, proposedValueSupported) => ({citation, proposedValueSupported});

export function migrateDispute(v01) {
  const expected = {
    'dispute-stronger-secondary-source-controller-missing': ['unresolved', assess('secondary', null)],
    'dispute-controller-confirms-original-over-objection': ['confirmed', assess('secondary', false)],
    'dispute-unverified-self-designated-policy': ['unresolved', assess('secondary', null)],
    'dispute-obsolete-controlling-version': ['unresolved', assess('secondary', null)],
    'dispute-policy-for-wrong-domain': ['unresolved', assess('secondary', null)],
    'dispute-correction-supported-without-overwrite': ['correction_supported', assess('controlling', true)],
    'dispute-duplicate-controlling-source-identifiers': ['unresolved', assess('secondary', null)],
    'dispute-value-match-does-not-transfer-source-authority': ['correction_supported', assess('secondary', true)]
  };
  return v01.filter(c => c.kind === 'dispute').map(c => {
    const [status, objectionAssessment] = expected[c.id];
    const changed = status !== c.expected.status;
    return {id: 'v01-' + c.id, kind: 'dispute', origin: 'v0.1-migrated', input: c.input,
      why: changed
        ? 'Behaviour change from v0.1 (was unresolved), adopting Clara (bonyohana)\'s first counterexample: the claim status follows the receiver\'s own controlling source; the objection\'s weak citation is reported separately as "secondary" and never promoted to controlling.'
        : c.why,
      expected: {status, value: c.input.claim.value, objectionAssessment}};
  });
}

const retention = {id: 'retention', value: '14 days', domain: 'example-agreement', version: 'v2'};
const policy = {claimId: 'retention', sourceId: 'signed-agreement', domain: 'example-agreement', version: 'v2', verified: true};
const src = (id, value, extra = {}) => ({id, value, domain: 'example-agreement', version: 'v2', status: 'verified', ...extra});
const objection = (sourceId, proposedValue = '21 days') =>
  ({id: 'objection-1', claimId: 'retention', proposedValue, ...(sourceId ? {sourceId} : {})});

export const disputeCases = [
  {id: 'ce3-verbatim-controller-contradicts-original-but-objection-cites-secondary', kind: 'dispute',
    origin: 'external-counterexample', source: CLARA_CASES + ' ; ' + CLARA_GIST,
    why: 'Clara (bonyohana) case 1, verbatim. The receiver\'s own verified controlling source contradicts the original and equals the proposed value. That is the state of the claim. The poor citation is a fact about the objection, reported in objectionAssessment.',
    input: {
      claim: {id: 'payout-schedule', value: 'twice monthly', domain: 'publisher-agreement', version: '2026-08'},
      objection: {id: 'objection-from-blog', claimId: 'payout-schedule', proposedValue: '1st and 16th of each month', sourceId: 'vendor-blog'},
      policy: {claimId: 'payout-schedule', sourceId: 'publisher-agreement-text', domain: 'publisher-agreement', version: '2026-08', verified: true},
      sources: [
        {id: 'publisher-agreement-text', value: '1st and 16th of each month', domain: 'publisher-agreement', version: '2026-08', status: 'verified'},
        {id: 'vendor-blog', value: 'biweekly', domain: 'publisher-agreement', version: '2026-08', status: 'verified'}]},
    expected: {status: 'correction_supported', value: 'twice monthly', objectionAssessment: assess('secondary', true)}},
  {id: 'ce4-verbatim-designated-source-superseded-by-verified-amendment-same-version', kind: 'dispute', detects_indifference: true,
    origin: 'external-counterexample', source: CLARA_CASES + ' ; ' + CLARA_GIST,
    why: 'Clara (bonyohana) case 2, verbatim. A verified same-scope amendment that claims to supersede the designated source and disagrees with it disputes applicability. v0.1 returned confirmed.',
    input: {claim: retention,
      objection: {id: 'objection-amendment', claimId: 'retention', proposedValue: '21 days', sourceId: 'signed-amendment'},
      policy, sources: [src('signed-agreement', '14 days'), src('signed-amendment', '21 days', {supersedes: 'signed-agreement'})]},
    expected: {status: 'unresolved', value: '14 days', objectionAssessment: assess('secondary', null), warnings: []}},
  {id: 'v02-dispute-controller-contradicts-both', kind: 'dispute', origin: 'v0.2-new',
    why: 'The controlling source supports neither the claim nor the proposal. v0.1 said unresolved; v0.2 says the claim is contradicted.',
    input: {claim: retention, objection: objection('well-researched-blog'), policy,
      sources: [src('signed-agreement', '30 days'), src('well-researched-blog', '21 days')]},
    expected: {status: 'contradicted', value: '14 days', objectionAssessment: assess('secondary', false)}},
  {id: 'v02-dispute-superseding-amendment-agrees', kind: 'dispute', detects_indifference: false, origin: 'v0.2-new',
    why: 'A superseding instrument that says the same thing leaves nothing to adjudicate.',
    input: {claim: retention, objection: objection('well-researched-blog'), policy, sources: [
      src('signed-agreement', '14 days'), src('signed-amendment', '14 days', {supersedes: 'signed-agreement'}),
      src('well-researched-blog', '21 days')]},
    expected: {status: 'confirmed', value: '14 days', objectionAssessment: assess('secondary', false),
      warnings: ['contradicted-undeclared:well-researched-blog']}},
  {id: 'v02-dispute-unverified-amendment-cannot-block', kind: 'dispute', detects_indifference: false, origin: 'v0.2-new',
    why: 'Only a verified instrument can dispute applicability; otherwise anyone could block every confirmation by attaching a supersedes field.',
    input: {claim: retention, objection: objection('signed-amendment'), policy, sources: [
      src('signed-agreement', '14 days'), src('signed-amendment', '21 days', {status: 'unverified', supersedes: 'signed-agreement'})]},
    expected: {status: 'confirmed', value: '14 days', objectionAssessment: assess('secondary', false), warnings: []}},
  {id: 'v02-dispute-supersedes-list', kind: 'dispute', detects_indifference: true, origin: 'v0.2-new',
    why: 'supersedes may be a list of source ids.',
    input: {claim: retention, objection: objection('signed-amendment'), policy, sources: [
      src('signed-agreement', '14 days'), src('signed-amendment', '21 days', {supersedes: ['annex-b', 'signed-agreement']})]},
    expected: {status: 'unresolved', value: '14 days', objectionAssessment: assess('secondary', null)}},
  {id: 'v02-dispute-hunch-objection-labelled-none', kind: 'dispute', origin: 'v0.2-new',
    why: 'An objection without a source is a declared hunch. The claim status still follows the controlling source.',
    input: {claim: retention, objection: objection(null), policy, sources: [src('signed-agreement', '21 days')]},
    expected: {status: 'correction_supported', value: '14 days', objectionAssessment: assess('none', true)}},
  {id: 'v021-dispute-silent-contradiction-is-reported', kind: 'dispute', origin: 'external-counterexample', source: CLARA_WARNING,
    why: 'Clara (bonyohana), 15/09: the variant of case 2 without supersedes. A verified same-scope source contradicts the designated one and declares nothing. The status stays confirmed, and the contradiction is reported apart instead of staying invisible.',
    input: {claim: retention,
      objection: {id: 'objection-amendment', claimId: 'retention', proposedValue: '21 days', sourceId: 'signed-amendment'},
      policy, sources: [src('signed-agreement', '14 days'), src('signed-amendment', '21 days')]},
    expected: {status: 'confirmed', value: '14 days', objectionAssessment: assess('secondary', false),
      warnings: ['contradicted-undeclared:signed-amendment']}}
];
