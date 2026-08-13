/**
 * yjsRoom.ts
 *
 * This is the heart of the real-time sync server. Each "room" corresponds to
 * one document (one file being edited). Every WebSocket connection that joins
 * a room:
 *   1. Gets the current Yjs document state synced to it
 *   2. Has its future edits broadcast (as compact binary updates) to everyone
 *      else in the room
 *   3. Shares "awareness" state (cursor position, name, color) with the room
 *
 * We implement the Yjs sync protocol manually here (rather than importing
 * y-websocket's server utils) so the logic is fully visible and explainable
 * in a resume / interview context.
 */

import { WebSocket } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { saveSnapshot, loadSnapshot } from "./persistence.js";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

export interface RoomConnection {
  ws: WebSocket;
  userId: string;
}

class Room {
  readonly name: string;
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;
  readonly conns: Map<WebSocket, RoomConnection> = new Map();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(name: string) {
    this.name = name;
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    // Whenever the doc changes, broadcast the update to everyone else,
    // and schedule a debounced save to persistent storage.
    this.doc.on("update", (update: Uint8Array, origin: WebSocket) => {
      this.broadcastUpdate(update, origin);
      this.scheduleSave();
    });

    this.awareness.on(
      "update",
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: WebSocket) => {
        const changedClients = added.concat(updated, removed);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
        );
        const message = encoding.toUint8Array(encoder);
        this.conns.forEach((conn) => {
          if (conn.ws !== origin && conn.ws.readyState === WebSocket.OPEN) {
            conn.ws.send(message);
          }
        });
      }
    );
  }

  private broadcastUpdate(update: Uint8Array, origin: WebSocket) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);
    this.conns.forEach((conn) => {
      if (conn.ws !== origin && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(message);
      }
    });
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    // Debounce: only persist 2s after the last edit, so we don't hammer
    // the database on every keystroke.
    this.saveTimer = setTimeout(() => {
      saveSnapshot(this.name, Y.encodeStateAsUpdate(this.doc)).catch((err) =>
        console.error(`[room:${this.name}] failed to save snapshot`, err)
      );
    }, 2000);
  }

  addConnection(ws: WebSocket, userId: string) {
    this.conns.set(ws, { ws, userId });

    // 1. Send this doc's current state to the newly joined client
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    ws.send(encoding.toUint8Array(encoder));

    // 2. Send current awareness states (who else is here) to the new client
    const states = this.awareness.getStates();
    if (states.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, Array.from(states.keys()))
      );
      ws.send(encoding.toUint8Array(awarenessEncoder));
    }
  }

  removeConnection(ws: WebSocket) {
    const conn = this.conns.get(ws);
    this.conns.delete(ws);
    if (conn) {
      // Remove this client's awareness state (cursor disappears for others)
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        Array.from(this.awareness.getStates().keys()).filter(
          (clientId) => this.awareness.getStates().get(clientId)?.userId === conn.userId
        ),
        null
      );
    }
  }

  handleMessage(ws: WebSocket, message: Uint8Array) {
    const decoder = decoding.createDecoder(message);
    const encoder = encoding.createEncoder();
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MESSAGE_SYNC: {
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, this.doc, ws);
        if (encoding.length(encoder) > 1) {
          ws.send(encoding.toUint8Array(encoder));
        }
        break;
      }
      case MESSAGE_AWARENESS: {
        awarenessProtocol.applyAwarenessUpdate(
          this.awareness,
          decoding.readVarUint8Array(decoder),
          ws
        );
        break;
      }
    }
  }

  isEmpty() {
    return this.conns.size === 0;
  }
}

const rooms = new Map<string, Room>();

export async function getOrCreateRoom(name: string): Promise<Room> {
  let room = rooms.get(name);
  if (!room) {
    room = new Room(name);
    const snapshot = await loadSnapshot(name);
    if (snapshot) {
      Y.applyUpdate(room.doc, snapshot);
    }
    rooms.set(name, room);
  }
  return room;
}

export function cleanupRoomIfEmpty(name: string) {
  const room = rooms.get(name);
  if (room && room.isEmpty()) {
    // Keep it around briefly in case of quick reconnects; simplest approach
    // here is to just leave it in memory since state was already persisted.
    // For a larger-scale app you'd evict it from memory after a timeout.
  }
}
