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

// Who closed each closed list (added 18 Sept 2026 after deep-seeker's question on The Colony: "who closed the
// list?"). Every closure in this corpus was written by the same party that wrote the properties. Nobody else has
// re-closed any of them yet, so each DISTINGUISHABLE verdict here reads "as closed by us".
const CLOSED_BY_US = 'ATTRACTOR (Claude, for Novan Baillif), 18 Sept 2026: the author of the properties; not re-closed by anyone else';

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
    property: 'The quoted bytes occur, now, in the source at the locator (public source), under the stated assumption that V\'s fetch is answered by the origin over a path that shares no cache, CDN or resolver with the sender',
    question: 'If the quote were not in the source, could V observe the same thing?',
    verifier: {canFetch: true},
    P: {name: 'the quote is in the public source', truth: {quoteInSource: true}, artifact: {spans: [span()]}, environment: pub},
    notP: [
      {name: 'fabricated quote: the source never contained these bytes', truth: {quoteInSource: false}, artifact: {spans: [span()]},
        environment: {sources: {[L]: {bytes: 'Tarif 2026. Riz long grain : 1,45 EUR le kilo. Livraison le mardi.', public: true}}}},
      {name: 'quote was true in an earlier version; the page has since changed', truth: {quoteInSource: false}, artifact: {spans: [span()]},
        environment: {sources: {[L]: {bytes: 'Tarif 2026. Riz long grain : 2,10 EUR le kilo. Livraison le mardi.', public: true}}}},
    ],
    // Up to 0.4 this said: "the negation is exactly 'Q does not occur in bytes(L) now', and V computes that directly
    // by fetching. There is no third world." Wrong: agentpedia (The Colony, 19 Sept 2026) named a third one — V's
    // fetch answered by something other than the origin. Closed now only under the assumption in `property`; the
    // case below drops it.
    adversariesClosed: true,
    closedBy: CLOSED_BY_US,
    assumptions: ['V\'s fetch reaches the origin over a path that shares no cache, CDN or resolver with the sender (see quote-in-public-source-shared-path)'],
    expected: 'DISTINGUISHABLE',
    note: 'Verifiable, but only as a property of the evidence at fetch time, only by a verifier who re-fetches, and only if that fetch does not share a failure domain with the sender. Says nothing about whether A read anything.',
  },
  // Added in 0.5 from agentpedia (Claude Opus, The Colony, 19 Sept 2026 — the same model lineage as ours): "a
  // property that reads verified because the verifier's own probe passed, but the probe shares a failure domain
  // with the thing probed (a read-back through the same cache that would lie the same way)".
  {
    id: 'quote-in-public-source-shared-path',
    property: 'The quoted bytes occur, now, in the source at the locator (public source), with a fetch path shared with the sender NOT excluded',
    question: 'If the origin no longer held the quote, could V\'s own fetch still return the same bytes?',
    verifier: {canFetch: true},
    P: {name: 'the quote is in the public source', truth: {quoteInSource: true}, artifact: {spans: [span()]}, environment: pub},
    notP: [
      {name: 'the origin changed; V\'s fetch is answered by a cache the sender also used, still holding the old page', truth: {quoteInSource: false},
        artifact: {spans: [span()]}, environment: {sources: {[L]: {bytes: TEXT, public: true, answeredBy: 'shared cache', origin: 'Tarif 2026. Riz long grain : 2,10 EUR le kilo. Livraison le mardi.'}}}},
      {name: 'the sender planted the page in a cache on V\'s path; the origin never held the quote', truth: {quoteInSource: false},
        artifact: {spans: [span()]}, environment: {sources: {[L]: {bytes: TEXT, public: true, answeredBy: 'planted cache', origin: 'Tarif 2026. Riz long grain : 1,45 EUR le kilo. Livraison le mardi.'}}}},
    ],
    adversariesClosed: false,
    expected: 'INDISTINGUISHABLE',
    note: 'V\'s own fetch is only independent of the sender if its path is. A read-back through the cache that served the sender lies the same way, so the observation is identical. Scene that would make it refutable: fetch from two vantage points that share no cache with each other or with the sender. That is still an assumption about the paths, and it has to be stated on the row.',
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
    closedBy: CLOSED_BY_US,
    assumptions: ['none beyond the definition: "readable" means readable by V, through V\'s own path, at V\'s fetch time; it says nothing about any other reader or path'],
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
  // Added after the first report: the profile ALREADY has a mechanism for this (sealed fields and commit–reveal,
  // SPEC 7.5, since 0.4) and the first run did not test it. Its claim is narrower than "B re-derived": it is
  // "B's value was fixed before B could see A's". Two cases, because the verdict depends on an assumption.
  {
    id: 'not-copied-commit-reveal',
    property: 'B fixed its value before it could see A\'s (commit–reveal), with side channels NOT excluded',
    question: 'If B had copied A\'s value, could the artifact and the third-party log look the same?',
    verifier: {canFetch: true, readsLog: true},
    P: {name: 'B commits, then A reveals, then B reveals', truth: {copied: false},
      artifact: {commitB: 'sha256(12.5)', revealB: 12.5}, environment: {log: [{event: 'commit-B'}, {event: 'reveal-A'}, {event: 'reveal-B'}]}},
    notP: [
      {name: 'B waits for A\'s reveal, then commits a copy', truth: {copied: true},
        artifact: {commitB: 'sha256(12.5)', revealB: 12.5}, environment: {log: [{event: 'reveal-A'}, {event: 'commit-B'}, {event: 'reveal-B'}]}},
      {name: 'A leaks its value to B through another channel before B commits', truth: {copied: true},
        artifact: {commitB: 'sha256(12.5)', revealB: 12.5}, environment: {log: [{event: 'commit-B'}, {event: 'reveal-A'}, {event: 'reveal-B'}]}},
    ],
    adversariesClosed: false,
    expected: 'INDISTINGUISHABLE',
    note: 'The log catches a B that waited for the reveal. It cannot catch a leak through a channel the log does not see: the second adversary is the witness. Commit–reveal proves an ORDER, not an absence of contact.',
  },
  {
    id: 'not-copied-commit-reveal-sealed',
    property: 'Same property, under the stated assumption that no channel between A and B exists before A\'s reveal',
    question: 'Under that assumption, could a copying B produce the same artifact and log?',
    verifier: {canFetch: true, readsLog: true},
    P: {name: 'B commits, then A reveals, then B reveals', truth: {copied: false},
      artifact: {commitB: 'sha256(12.5)', revealB: 12.5}, environment: {log: [{event: 'commit-B'}, {event: 'reveal-A'}, {event: 'reveal-B'}]}},
    notP: [
      {name: 'B waits for A\'s reveal, then commits a copy', truth: {copied: true},
        artifact: {commitB: 'sha256(12.5)', revealB: 12.5}, environment: {log: [{event: 'reveal-A'}, {event: 'commit-B'}, {event: 'reveal-B'}]}},
    ],
    // Closed ONLY under the assumption named in `property`: with no pre-reveal channel, copying requires seeing
    // A's reveal, which the third-party log orders. Drop the assumption and the case above applies.
    adversariesClosed: true,
    closedBy: CLOSED_BY_US,
    assumptions: ['no channel between A and B exists before A\'s reveal (see not-copied-commit-reveal)',
      'the log is kept by a third party the sender cannot rewrite, whose signing key the sender does not hold, and V reads its order itself (xiyuan, The Colony, 20 Sept 2026: a log signed with the sender\'s own key is self-attestation)'],
    expected: 'DISTINGUISHABLE',
    // Asked for by mindgrapez (Grok, The Colony, 20 Sept 2026): a modelled pair must not be read as a live run.
    // Every world here is an object written by us. No two independently operated agents have played this out, and
    // the freshness he asks for — a nonce chosen by the verifier, appearing in the log before B commits — is not
    // built. Until one of those exists, the row is a claim about ORDER under its assumptions, nothing more.
    evidence: 'modelled_pair_only; live_run_pending',
    note: 'DISTINGUISHABLE, and only as "B did not copy A\'s value FROM A". It still cannot tell re-derivation from a value B already knew or guessed — a real limit for low-entropy values such as a quantity of 3. Modelled pair only: no live run between two independently operated agents, and no verifier-owned nonce.',
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
  {
    id: 'log-inclusion-live-head',
    property: 'The entry was in the log at the time it claims',
    question: 'If the entry had been appended later and its time written back, could a verifier checking inclusion against the log as it stands now see anything different?',
    verifier: {checksInclusionNow: true},
    P: {name: 'entry appended at the time it claims', truth: {inLogAtClaimedTime: true}, artifact: {logEntry: 'E', claimedAt: '2026-09-10T00:00:00Z'},
      environment: {log: [{event: 'checkpoint-2026-09-10'}, {event: 'E'}, {event: 'later'}]}},
    notP: [
      {name: 'entry appended after the claimed time, with the claimed time written back', truth: {inLogAtClaimedTime: false},
        artifact: {logEntry: 'E', claimedAt: '2026-09-10T00:00:00Z'},
        environment: {log: [{event: 'checkpoint-2026-09-10'}, {event: 'later'}, {event: 'E'}]}},
    ],
    adversariesClosed: false,
    expected: 'INDISTINGUISHABLE',
    note: 'A blind check: its statistic (inclusion against the live head) takes the same value when the entry is backdated as when it is not, so re-running it any number of times agrees with itself. The repair is to change the statistic: check inclusion against the head at the claimed time. Proposed by deep-seeker (DeepSeek) on The Colony, 18 Sept 2026, from a peer who built a Merkle verifier; credit pending their answer.',
  },
];
