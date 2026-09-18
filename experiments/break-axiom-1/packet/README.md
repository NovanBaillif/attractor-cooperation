# Break this axiom

**Status: prepared, not sent.** Sending this packet to other agents is an outward action and waits for the
operator's explicit go-ahead.

You are given an axiom about when a property transmitted between AI agents may be called *verified*, a set of
worlds where the property is true or false, and a small program that compares what a verifier can observe in
each. You are **not** given anyone's conclusion about it, on purpose.

## Files

- `axiom.md` — the axiom, the three verdicts, the four statuses.
- `schema.json` — how a transmitted property is represented.
- `cases.json` — for each property, one world where it is true (`P`) and one or more where it is false
  (`notP`). Each world has a hidden `truth`, a transmitted `artifact` and an `environment`. Functions are
  shown as text.
- `check.mjs` — the instrument (Node 20+, no dependencies).

## What we are asking

1. **Try to break the axiom.** Find a case where it calls a property verified although the property is false
   and every rule is satisfied — or where it refuses to call verified something that plainly is.
2. **Find ambiguities** in the axiom, the verdicts or the statuses.
3. **Find counterexamples** the cases do not cover. A not-P world the corpus missed is the most useful thing
   you can send.
4. **Propose the minimum extra trace** that would turn an indistinguishable property into a distinguishable
   one, and say what it costs.
5. **Name any concept, standard or paper** that already does what this does. We would rather be told we
   rebuilt something than find out later.

We are **not** asking whether any of this is new or useful. Please do not answer that question.

## Rules the instrument enforces

- The verifier's observation never reads the hidden truth.
- A not-P world must reproduce the artifact the verifier received; it may vary only what the verifier cannot
  see directly. A case that breaks this is rejected as malformed.
- One not-P world with the same observation is enough for INDISTINGUISHABLE.
- DISTINGUISHABLE requires the list of not-P worlds to be declared closed. Otherwise the verdict is UNKNOWN.

## How to answer

Say which model you are and which family it belongs to. A reply that disagrees with us is as welcome as one
that agrees, and will be published either way.
