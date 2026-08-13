# CRDT From Scratch — Logoot-style Sequence CRDT

This module is a standalone, dependency-free implementation of a **sequence
CRDT** (the data structure that makes real-time collaborative text editing
possible without a central lock or authority). It exists separately from the
main app to make the algorithm easy to read, test, and explain — the main
app itself uses [Yjs](https://github.com/yjs/yjs) as its production sync
engine.

## Why write this at all if Yjs already exists?

Anyone can `npm install yjs` and wire it up. Writing a working (if smaller
scale) version from scratch — and getting it *provably correct* — is what
demonstrates actually understanding the problem: how do multiple people edit
the same document at the same time, with no central server deciding order,
and still guarantee everyone ends up seeing the exact same result?

## The algorithm: Logoot (position-identifier based)

Each character is assigned a **position identifier** — a list of
`(digit, siteId)` pairs — instead of an array index. Position identifiers
have a total order (compare digit by digit), and you can always generate a
new one that sits strictly between any two existing identifiers, no matter
how close together they are, by going one level deeper. See
[`src/logoot.ts`](./src/logoot.ts) for the full implementation and inline
comments.

Because a position identifier is a **self-contained, globally comparable
value** — not a pointer to another operation — a remote insert can be
applied correctly no matter what order operations arrive in. That's the
whole trick that makes offline editing + later sync work.

## A bug we hit (and why it's worth mentioning)

The first version of this module used a different CRDT family — an
**RGA (origin-pointer based)** approach, where each character points to the
character it was inserted after. During testing (`tests/logoot.demo.ts`
started life as `tests/rga.demo.ts`), a convergence test with two sites
typing different words at the same cursor position **failed**: one replica
ended up with `"Hello WThereorld"`, the other with `"Hello WorldThere"` —
different final text on each side, which defeats the entire point of a CRDT.

The bug: the naive integration algorithm only checked *immediate* siblings
sharing the same origin pointer, not the full descendant chain hanging off a
sibling that "won" the tie-break — a known subtlety of origin-pointer CRDTs
(it's part of why Yjs's actual algorithm, YATA, is more involved than the
original RGA paper). Rather than patch around it, this was switched to the
Logoot approach above, which sidesteps the issue entirely because ordering
is a pure value comparison, not a graph traversal.

This is documented here deliberately — a CRDT that "looks like it works" on
one hand-written example but silently diverges under different delivery
orders is a realistic and easy mistake to make, and catching it required
moving from "one example passes" to a randomized stress test.

## Running it

```bash
npm install
npm run demo     # single worked example, human-readable output
npm run stress    # 200 randomized trials of concurrent edits, asserts convergence
```

Expected stress test output:

```
200/200 trials converged correctly.
STRESS TEST PASSED ✅
```

## What this does NOT implement (scope, honestly stated)

- No network layer — this is pure in-memory logic, tested via direct
  function calls between simulated "sites". The main app's server
  (`server/src/yjsRoom.ts`) handles the real networking, via Yjs.
- No garbage collection of tombstones (deleted nodes stay in the array
  forever here). Production CRDTs need a strategy to prune these.
- Delete-then-insert-at-same-spot edge cases aren't specifically stress
  tested beyond what the random trials happen to cover.
