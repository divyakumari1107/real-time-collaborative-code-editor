/**
 * persistence.ts
 *
 * Stores Yjs document snapshots in SQLite so that documents survive server
 * restarts. Also keeps a lightweight version history table so the client
 * can offer "time travel" (Phase 5 of the roadmap).
 */

import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";

let dbPromise: Promise<Database> | null = null;

async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = open({
      filename: "./collab-editor.sqlite",
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS snapshots (
          room_name TEXT PRIMARY KEY,
          data BLOB NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_name TEXT NOT NULL,
          data BLOB NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rooms (
          name TEXT PRIMARY KEY,
          owner_id TEXT,
          created_at INTEGER NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

export async function saveSnapshot(roomName: string, data: Uint8Array) {
  const db = await getDb();
  const buf = Buffer.from(data);
  await db.run(
    `INSERT INTO snapshots (room_name, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(room_name) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    roomName,
    buf,
    Date.now()
  );
  // Also append to history so we can time-travel later. In a production app
  // you'd prune this table (e.g. keep last N or one per hour) to bound size.
  await db.run(
    `INSERT INTO history (room_name, data, created_at) VALUES (?, ?, ?)`,
    roomName,
    buf,
    Date.now()
  );
}

export async function loadSnapshot(roomName: string): Promise<Uint8Array | null> {
  const db = await getDb();
  const row = await db.get<{ data: Buffer }>(
    `SELECT data FROM snapshots WHERE room_name = ?`,
    roomName
  );
  return row ? new Uint8Array(row.data) : null;
}

export async function listHistory(roomName: string) {
  const db = await getDb();
  return db.all<{ id: number; created_at: number }[]>(
    `SELECT id, created_at FROM history WHERE room_name = ? ORDER BY created_at DESC LIMIT 50`,
    roomName
  );
}

export async function getHistoryEntry(id: number): Promise<Uint8Array | null> {
  const db = await getDb();
  const row = await db.get<{ data: Buffer }>(`SELECT data FROM history WHERE id = ?`, id);
  return row ? new Uint8Array(row.data) : null;
}

export async function ensureRoom(name: string, ownerId: string | null) {
  const db = await getDb();
  await db.run(
    `INSERT OR IGNORE INTO rooms (name, owner_id, created_at) VALUES (?, ?, ?)`,
    name,
    ownerId,
    Date.now()
  );
}
