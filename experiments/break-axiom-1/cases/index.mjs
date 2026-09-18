// The P / not-P pairs of Test #001, sections 3 and 5.
// Each world has a hidden `truth` (what actually happened), an `artifact` (what was transmitted) and an
// `environment` (what exists independently of the sender: sources, tools, how the agent answers a probe).
// `expected` is the verdict this corpus commits to; the test suite fails if the check ever disagrees, so a
// later change that flips a verdict has to be argued, not slipped in.
//
// Adversary lists are written to be as nasty as we could make them. Where a verdict is DISTINGUISHABLE, the
// case says why its adversary space is closed; where it cannot say so, the verdict is UNKNOWN by rule.

const TEXT = 'Tarif 2026. Riz long grain : 1,85 EUR le kilo. Livraison le mardi.';
const QUOTE = 'Riz long grain : 1,85 EUR le kilo';
const L = 'https://example.org/tarif-2026';
const span = (quote = QUOTE, locator = L) => ({locator, quote, retrievedAt: '2026-09-18T06:00:00Z', observedAs: 'anonymous'});
const pub = {sources: {[L]: {bytes: TEXT, public: true}}};
const gated = {sources: {[L]: {bytes: TEXT, public: false}}};

export const CASES = [
  {
    id: 'source-read',
    property: 'A read the source it cites',
    question: 'If A had not read the source, could the artifact be exactly identical?',
    verifier: {canFetch: true},
    P: {name: 'A fetched and read the source', truth: {aRead: true}, artifact: {spans: [span()]}, environment: pub},
    notP: [
      {name: 'A copied a correct quote from a cache, another agent or its training data', truth: {aRead: false, quoteFrom: 'cache'}, artifact: {spans: [span()]}, environment: pub},
    ],
    adversariesClosed: false,
    expected: 'INDISTINGUISHABLE',
    note: 'Reading is an internal act. Every trace it leaves — quote, locator, time — can be produced without it. No trace can fix this; only a narrower property can be verified (next case).',
  },
  {
    id: 'quote-in-public-source',
    property: 'The quoted bytes occur, now, in the source at the locator (public source)',
    question: 'If the quote were not in the source, could V observe the same thing?',
    verifier: {canFetch: true},
    P: {name: 'the quote is in the public source', truth: {quoteInSource: true}, artifact: {spans: [span()]}, environment: pub},
    notP: [
      {name: 'fabricated quote: the source never contained these bytes', truth: {quoteInSource: false}, artifact: {spans: [span()]},
        environment: {sources: {[L]: {bytes: 'Tarif 2026. Riz long grain : 1,45 EUR le kilo. Livraison le mardi.', public: true}}}},
      {name: 'quote was true in an earlier version; the page has since changed', truth: {quoteInSource: false}, artifact: {spans: [span()]},
        environment: {sources: {[L]: {bytes: 'Tarif 2026. Riz long grain : 2,10 EUR le kilo. Livraison le mardi.', public: true}}}},
    ],
    // The negation of "Q occurs in bytes(L) now" is exactly "Q does not occur in bytes(L) now", and V computes
    // that directly by fetching. There is no third world. Closed — for a verifier that can fetch a public source.
    adversariesClosed: true,
    expected: 'DISTINGUISHABLE',
    note: 'Verifiable, but only as a property of the evidence at fetch time, and only by a verifier who re-fetches. Says nothing about whether A read anything.',
  },
  {
    id: 'quote-in-gated-source',
    property: 'The quoted bytes occur in the source at the locator (source readable only with credentials V lacks)',
    question: 'If the quote were fabricated, could V observe the same thing?',
    verifier: {canFetch: true, credentials: []},
    P: {name: 'real quote, gated source', truth: {quoteInSource: true}, artifact: {spans: [span()]}, environment: gated},
    notP: [
      {name: 'fabricated quote: the gated source never contained these bytes', truth: {quoteInSource: false}, artifact: {spans: [span()]},
        environment: {sources: {[L]: {bytes: 'Tarif 2026. Riz long grain : 1,45 EUR le kilo. Livraison le mardi.', public: false}}}},
    ],
    adversariesClosed: false,
    expected: 'INDISTINGUISHABLE',
    note: 'Both fetches are refused; V holds the same artifact and the same refusal in both worlds. A verbatim quote from a source V cannot open is, for V, exactly as good as an invented one. The first version of this case returned UNKNOWN because its adversary changed the quote — a malformed case, now rejected by the check.',
  },
  {
    id: 'provenance-origin',
    property: 'The declared origin is the actual origin of the information (fetched live, not rebuilt from memory or a cache)',
    question: 'If the span had been reconstructed from memory, could the artifact and V\'s own re-fetch be identical?',
    verifier: {canFetch: true},
    P: {name: 'fetched live from the locator', truth: {origin: 'live-fetch'}, artifact: {spans: [span()]}, environment: pub},
    notP: [
      {name: 'rebuilt from memory, retrievedAt written afterwards', truth: {origin: 'memory'}, artifact: {spans: [span()]}, environment: pub},
      {name: 'served from a cache of the same source', truth: {origin: 'cache'}, artifact: {spans: [span()]}, environment: pub},
    ],
    adversariesClosed: false,
    expected: 'INDISTINGUISHABLE',
    note: 'Content can be checked against the source; origin cannot. `retrievedAt` is written by the sender. What V can verify is "these bytes are at this address now", never "this is where the sender got them".',
  },
  {
    id: 'source-accessible-to-v',
    property: 'The source is readable by V, now',
    question: 'If the source were not readable by V, could V observe the same thing?',
    verifier: {canFetch: true, credentials: []},
    P: {name: 'public source', truth: {accessible: true}, artifact: {spans: [span()]}, environment: pub},
    notP: [
      {name: 'A holds private credentials; the locator refuses V', truth: {accessible: false}, artifact: {spans: [span()]}, environment: gated},
      {name: 'the locator no longer exists', truth: {accessible: false}, artifact: {spans: [span()]}, environment: {sources: {}}},
    ],
    // The property is defined relative to V and to the moment of V's own fetch, which is what V observes.
    adversariesClosed: true,
    expected: 'DISTINGUISHABLE',
    note: 'Access is a relation between a source, a reader and a moment — not a property of the source. It is verifiable only as that relation, and only by the reader who fetches.',
  },
  {
    id: 'access-reported-by-sender',
    property: 'The source is public, as reported by a probe the SENDER ran',
    question: 'If the sender lied about its probe, could V observe the same thing without fetching?',
    verifier: {canFetch: false},
    P: {name: 'public source, honest probe report', truth: {accessible: true}, artifact: {spans: [span()], probe: {anonymous: 'same-bytes'}}, environment: pub},
    notP: [
      {name: 'private source, sender reports same-bytes anyway', truth: {accessible: false}, artifact: {spans: [span()], probe: {anonymous: 'same-bytes'}}, environment: gated},
    ],
    adversariesClosed: false,
    expected: 'INDISTINGUISHABLE',
    note: 'A probe result travelling inside the artifact is a sentence, not an observation. `access` is verified only from a probe the verifier ran itself.',
  },
  {
    id: 'context-isolated',
    property: 'Each prompt ran in a fresh, independent context',
    question: 'If the prompts had shared a context, could the artifact be exactly identical?',
    verifier: {canFetch: true},
    P: {name: 'fresh context per prompt', truth: {isolated: true}, artifact: {isolation: 'fresh-context-per-prompt', answers: ['12.5', '3', 'riz basmati']}, environment: {}},
    notP: [
      {name: 'one shared window, same answers', truth: {isolated: false}, artifact: {isolation: 'fresh-context-per-prompt', answers: ['12.5', '3', 'riz basmati']}, environment: {}},
    ],
    adversariesClosed: false,
    expected: 'INDISTINGUISHABLE',
    note: 'A procedure property that leaves no mark in the output. The `isolation` field is written by whoever ran the prompts — including ATTRACTOR\'s own replay program, which writes it for every run. It is an assertion and must be labelled one.',
  },
  {
    id: 'rederived-happy-path',
    property: 'B re-derived the value from the data instead of copying A\'s value',
    question: 'On an honest exchange, could B\'s output be identical whether it re-derived or copied?',
    verifier: {canFetch: true},
    P: {name: 'B re-derives 12.5 from the data', truth: {rederived: true}, artifact: {value: 12.5, from: 'prix_texte=" 12,50 "'}, environment: {}},
    notP: [
      {name: 'B copies A\'s 12.5', truth: {rederived: false}, artifact: {value: 12.5, from: 'prix_texte=" 12,50 "'}, environment: {}},
    ],
    adversariesClosed: false,
    expected: 'INDISTINGUISHABLE',
    note: 'When A is right, copying and re-deriving give the same answer. Re-derivation cannot be observed on the happy path — only under a perturbation.',
  },
  {
    id: 'rederived-under-probe',
    property: 'B re-derives, tested by planting a wrong value from A (a canary)',
    question: 'Could a copying B answer the canary the same way a re-deriving B does?',
    verifier: {canFetch: true, perturb: {aValue: 99.9, data: 'prix_texte=" 12,50 "'}},
    P: {name: 'B re-derives: ignores the canary, answers 12.5', truth: {rederived: true}, artifact: {protocol: 'canary'},
      environment: {respondToProbe: () => ({value: 12.5})}},
    notP: [
      {name: 'naive copier: repeats the canary', truth: {rederived: false}, artifact: {protocol: 'canary'},
        environment: {respondToProbe: p => ({value: p.aValue})}},
      {name: 'copier that recognises probes and re-derives only when probed', truth: {rederived: false}, artifact: {protocol: 'canary'},
        environment: {respondToProbe: () => ({value: 12.5})}},
    ],
    adversariesClosed: false,
    expected: 'INDISTINGUISHABLE',
    note: 'Against a naive copier the canary works. Against one that can tell a probe from a real input it does not: the second adversary is the witness. A perturbation test is only a test if the probe cannot be recognised — which is exactly why E15\'s false archive is shaped like any other archive.',
  },
  {
    id: 'tool-executed-predictable',
    property: 'The announced tool was actually executed (output is predictable)',
    question: 'If the agent had computed the output itself, could V observe the same thing, even by re-running the tool?',
    verifier: {canFetch: true, canRerun: ['convert']},
    P: {name: 'tool executed', truth: {executed: true}, artifact: {toolCalls: [{tool: 'convert', input: '12,50', output: '12.5'}]},
      environment: {tools: {convert: x => String(Number(String(x).replace(',', '.')))}}},
    notP: [
      {name: 'agent computed it without calling the tool', truth: {executed: false}, artifact: {toolCalls: [{tool: 'convert', input: '12,50', output: '12.5'}]},
        environment: {tools: {convert: x => String(Number(String(x).replace(',', '.')))}}},
    ],
    adversariesClosed: false,
    expected: 'INDISTINGUISHABLE',
    note: 'Re-running proves the output is correct. It does not prove the tool ran. Whenever the output is predictable, execution leaves no trace an honest re-run can tell apart.',
  },
];
