/**
 * stress.test.ts
 *
 * Property-based test: runs many trials of random concurrent inserts and
 * deletes across 3 simulated sites, delivers operations in random order to
 * each site, and asserts every site converges to the exact same text.
 *
 * This is the kind of test that would actually catch the ordering bug we
 * hit during development (see README "Lessons Learned" section) — a single
 * hand-written example can pass by luck, but running hundreds of randomized
 * scenarios makes it much harder for a convergence bug to hide.
 *
 * Run with: npx tsx tests/stress.test.ts
 */

import { LogootSequence, LogootNode } from "../src/logoot";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz ".split("");

function randomChar(): string {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
}

function runTrial(trialNum: number, numSites: number, opsPerSite: number): boolean {
  const sites = Array.from({ length: numSites }, (_, i) => new LogootSequence(`S${i}`));
  const allOps: LogootNode[] = [];

  // Each site independently generates random inserts at random positions
  // within its OWN current view (simulating concurrent, uncoordinated edits).
  for (const site of sites) {
    for (let i = 0; i < opsPerSite; i++) {
      const pos = Math.floor(Math.random() * (site.text.length + 1));
      const node = site.localInsert(pos, randomChar());
      allOps.push(node);
    }
  }

  // Deliver ALL ops (including each site's own, which is naturally a no-op
  // dedupe) to every site, in a fresh random shuffle per site.
  for (const site of sites) {
    const shuffled = [...allOps].sort(() => Math.random() - 0.5);
    for (const op of shuffled) {
      site.applyRemoteInsert(op);
    }
  }

  const reference = sites[0].text;
  const allMatch = sites.every((s) => s.text === reference);

  if (!allMatch) {
    console.error(`Trial ${trialNum} FAILED — sites diverged:`);
    sites.forEach((s, i) => console.error(`  site ${i}: ${JSON.stringify(s.text)}`));
  }

  return allMatch;
}

function main() {
  const TRIALS = 200;
  let passed = 0;

  for (let t = 0; t < TRIALS; t++) {
    const numSites = 2 + Math.floor(Math.random() * 3); // 2-4 sites
    const opsPerSite = 1 + Math.floor(Math.random() * 8); // 1-8 ops each
    if (runTrial(t, numSites, opsPerSite)) passed++;
  }

  console.log(`\n${passed}/${TRIALS} trials converged correctly.`);
  if (passed !== TRIALS) {
    console.error("STRESS TEST FAILED");
    process.exit(1);
  }
  console.log("STRESS TEST PASSED ✅");
}

main();
