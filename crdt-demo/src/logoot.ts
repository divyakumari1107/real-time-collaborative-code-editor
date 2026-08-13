/**
 * logoot.ts
 *
 * A from-scratch implementation of a Logoot-style sequence CRDT — the same
 * family of algorithm (position-identifier based, as opposed to Yjs's
 * origin-pointer based YATA algorithm) used by several real collaborative
 * editors historically (Logoot was used in early versions of some
 * distributed wikis/editors).
 *
 * WHY THIS EXISTS
 * ----------------
 * The main app (client/ + server/) uses Yjs, a production-grade CRDT
 * library, as its real sync engine. This file is a separate, self-contained
 * implementation written to demonstrate *understanding* of how CRDTs
 * actually guarantee convergence, rather than just importing a library.
 *
 * CORE IDEA
 * ---------
 * Instead of "insert at index 5", every character gets a POSITION
 * IDENTIFIER: a list of (digit, siteId) pairs, e.g. [[100, "A"], [50, "B"]].
 * Position identifiers have a total order (compare digit-by-digit, like
 * comparing version numbers or decimal expansions), and — critically — you
 * can ALWAYS generate a new identifier that sits strictly between any two
 * existing ones, no matter how close together they are, by appending a
 * deeper digit level.
 *
 * Because every character's position is a plain, globally comparable value
 * (not a pointer to another character), inserting the array is just "insert
 * where the position sorts" — no special-casing for delivery order, no
 * "sibling vs. descendant" ambiguity. This sidesteps the class of ordering
 * bug you can hit with naive origin-pointer CRDTs (see git history / README
 * for a worked example we ran into and fixed by switching approaches).
 */

export type PositionId = Array<{ digit: number; site: string }>;

export interface LogootNode {
  position: PositionId;
  value: string;
  deleted: boolean;
}

const DIGIT_MAX = 1_000_000; // upper bound per level; keeps digits reasonably small
const BOUNDARY_STRATEGY_JITTER = 32; // avoids identical digits from same-site rapid typing

function comparePosition(a: PositionId, b: PositionId): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const da = a[i]?.digit ?? -1;
    const db = b[i]?.digit ?? -1;
    if (da !== db) return da - db;
    const sa = a[i]?.site ?? "";
    const sb = b[i]?.site ?? "";
    if (sa !== sb) return sa < sb ? -1 : 1;
  }
  return 0;
}

/**
 * Generates a new position strictly between `lo` and `hi` (either bound may
 * be null, meaning "start of document" / "end of document"). This is the
 * key primitive that makes Logoot work: no matter how many concurrent
 * inserts happen at the same spot, there's always room to slot a new one in
 * without renumbering anything else.
 */
function generateBetween(lo: PositionId | null, hi: PositionId | null, site: string): PositionId {
  const result: PositionId = [];
  let depth = 0;

  while (true) {
    const loDigit = lo?.[depth]?.digit ?? 0;
    const hiDigit = hi?.[depth]?.digit ?? DIGIT_MAX;

    if (hiDigit - loDigit > 1) {
      // Room to fit a digit strictly between lo and hi at this level.
      const jitter = Math.min(BOUNDARY_STRATEGY_JITTER, hiDigit - loDigit - 1);
      const digit = loDigit + 1 + Math.floor(Math.random() * jitter);
      result.push({ digit, site });
      return result;
    }

    // No room at this depth (they're adjacent, e.g. 5 and 6) — carry the
    // lower bound's digit forward and go one level deeper to find room.
    result.push({ digit: loDigit, site });
    depth++;
  }
}

export class LogootSequence {
  readonly siteId: string;
  private nodes: LogootNode[] = []; // always kept sorted by position

  constructor(siteId: string) {
    this.siteId = siteId;
  }

  get text(): string {
    return this.nodes
      .filter((n) => !n.deleted)
      .map((n) => n.value)
      .join("");
  }

  private visibleNodes(): LogootNode[] {
    return this.nodes.filter((n) => !n.deleted);
  }

  private findInsertIndex(position: PositionId): number {
    // Binary search for where this position belongs among all nodes
    // (including tombstones, so positions stay globally consistent).
    let low = 0;
    let high = this.nodes.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (comparePosition(this.nodes[mid].position, position) < 0) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  /** Insert `value` locally at visible index `visibleIndex`. Returns the op to broadcast. */
  localInsert(visibleIndex: number, value: string): LogootNode {
    const visible = this.visibleNodes();
    const loNode = visible[visibleIndex - 1] ?? null;
    const hiNode = visible[visibleIndex] ?? null;
    const position = generateBetween(loNode?.position ?? null, hiNode?.position ?? null, this.siteId);
    const node: LogootNode = { position, value, deleted: false };
    this.nodes.splice(this.findInsertIndex(position), 0, node);
    return node;
  }

  /** Mark the visible character at `visibleIndex` as deleted. Returns the op to broadcast. */
  localDelete(visibleIndex: number): PositionId | null {
    const visible = this.visibleNodes();
    const target = visible[visibleIndex];
    if (!target) return null;
    target.deleted = true;
    return target.position;
  }

  /**
   * Apply a remote insert. Fully order-independent: since `node.position` is
   * a self-contained, globally comparable value (not a pointer to another
   * operation), it can be inserted correctly no matter what order remote
   * operations arrive in — no buffering needed, unlike origin-pointer CRDTs.
   */
  applyRemoteInsert(node: LogootNode) {
    const idx = this.findInsertIndex(node.position);
    const existing = this.nodes[idx];
    if (existing && comparePosition(existing.position, node.position) === 0) return; // dedupe
    this.nodes.splice(idx, 0, { ...node });
  }

  applyRemoteDelete(position: PositionId) {
    const idx = this.findInsertIndex(position);
    const node = this.nodes[idx];
    if (node && comparePosition(node.position, position) === 0) node.deleted = true;
  }
}
