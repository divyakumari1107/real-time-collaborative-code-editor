/**
 * logoot.demo.ts
 *
 * Demonstrates convergence: two independent replicas (siteA, siteB) start
 * empty, make concurrent edits WITHOUT talking to each other in real time,
 * then exchange operations in different orders — and end up byte-identical.
 * This is the property that makes CRDTs usable for offline-first apps.
 *
 * Run with: npx tsx tests/rga.demo.ts
 */

import { LogootSequence, LogootNode, PositionId } from "../src/logoot";

type Op =
  | { type: "insert"; node: LogootNode }
  | { type: "delete"; position: PositionId };

function typeString(seq: LogootSequence, str: string, ops: Op[]) {
  for (const ch of str) {
    const node = seq.localInsert(seq.text.length, ch);
    ops.push({ type: "insert", node });
  }
}

function main() {
  const siteA = new LogootSequence("A");
  const siteB = new LogootSequence("B");

  const opsA: Op[] = [];
  const opsB: Op[] = [];

  // Both sites start from the same base text, simulated as siteA typing
  // first and siteB "catching up" before going offline and diverging.
  typeString(siteA, "Hello ", opsA);
  for (const op of opsA) {
    if (op.type === "insert") siteB.applyRemoteInsert(op.node);
  }
  console.log("Both sites synced to:", JSON.stringify(siteA.text), JSON.stringify(siteB.text));

  // Now simulate going offline: both sites edit concurrently, unaware of
  // each other, appending different words at the same visible position.
  const opsAOffline: Op[] = [];
  const opsBOffline: Op[] = [];
  typeString(siteA, "World", opsAOffline);
  typeString(siteB, "There", opsBOffline);

  console.log("\nAfter concurrent offline edits:");
  console.log("  siteA sees:", JSON.stringify(siteA.text));
  console.log("  siteB sees:", JSON.stringify(siteB.text));

  // Reconnect: exchange ops in OPPOSITE orders on purpose, to prove that
  // arrival order doesn't affect the final converged result.
  for (const op of opsBOffline) {
    if (op.type === "insert") siteA.applyRemoteInsert(op.node);
  }
  for (const op of opsAOffline.slice().reverse()) {
    if (op.type === "insert") siteB.applyRemoteInsert(op.node);
  }

  console.log("\nAfter merging (different delivery order on each side):");
  console.log("  siteA converged to:", JSON.stringify(siteA.text));
  console.log("  siteB converged to:", JSON.stringify(siteB.text));
  console.log(
    "\nConverged correctly:",
    siteA.text === siteB.text ? "YES ✅" : "NO ❌ (bug!)"
  );

  console.log(
    "\nNote: the interleaved result (rather than a clean 'World' + 'There' or\n" +
      "vice versa) is EXPECTED, not a bug — both users typed at the exact same\n" +
      "cursor position concurrently, with no coordination. Character-level CRDTs\n" +
      "(including production ones like Yjs) resolve this by deterministically\n" +
      "interleaving rather than silently dropping either user's keystrokes. What\n" +
      "matters for correctness is that every replica interleaves it THE SAME WAY."
  );
}

main();
