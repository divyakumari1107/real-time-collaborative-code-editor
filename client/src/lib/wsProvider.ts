/**
 * wsProvider.ts
 *
 * A minimal, self-written alternative to the `y-websocket` client provider.
 * Speaks the exact same tiny protocol as server/src/yjsRoom.ts:
 *   byte 0 = message type (0 = sync, 1 = awareness)
 *   remaining bytes = the corresponding y-protocols payload
 *
 * Handles automatic reconnection with exponential backoff, which is what
 * gives us "offline -> back online -> auto re-sync" behavior together with
 * IndexeddbPersistence in useYjsRoom.ts.
 */

import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

type StatusListener = (status: "connecting" | "connected" | "offline") => void;
type Listener = (...args: any[]) => void;

export class WebsocketSyncProvider {
  private url: string;
  private doc: Y.Doc;
  public awareness: Awareness;
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private shouldReconnect = true;
  private listeners: Record<string, Listener[]> = {};

  constructor(url: string, doc: Y.Doc, opts: { userId: string }) {
    this.url = `${url}?userId=${encodeURIComponent(opts.userId)}`;
    this.doc = doc;
    this.awareness = new Awareness(doc);

    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === this) return; // don't echo back updates we just received
      this.sendSyncUpdate(update);
    });

    this.awareness.on("update", ({ added, updated, removed }: any) => {
      const changed = added.concat(updated, removed);
      this.sendAwarenessUpdate(changed);
    });

    this.connect();

    window.addEventListener("beforeunload", () => {
      applyAwarenessUpdate(this.awareness, encodeAwarenessUpdate(this.awareness, []), this);
    });
  }

  on(event: string, cb: Listener) {
    (this.listeners[event] ??= []).push(cb);
  }

  private emit(event: string, ...args: any[]) {
    (this.listeners[event] ?? []).forEach((cb) => cb(...args));
  }

  private connect() {
    this.emit("status", "connecting");
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.emit("status", "connected");
      // Kick off sync by sending our current state vector
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(encoder, this.doc);
      this.ws?.send(encoding.toUint8Array(encoder));
    };

    this.ws.onmessage = (event) => {
      const message = new Uint8Array(event.data as ArrayBuffer);
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === MESSAGE_SYNC) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);
        if (encoding.length(encoder) > 1) {
          this.ws?.send(encoding.toUint8Array(encoder));
        }
      } else if (messageType === MESSAGE_AWARENESS) {
        applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), this);
      }
    };

    this.ws.onclose = () => {
      this.emit("status", "offline");
      if (this.shouldReconnect) {
        const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 15000);
        this.reconnectAttempt++;
        setTimeout(() => this.connect(), delay);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private sendSyncUpdate(update: Uint8Array) {
    if (this.ws?.readyState !== WebSocket.OPEN) return; // queued via doc state + IndexedDB while offline
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    this.ws.send(encoding.toUint8Array(encoder));
  }

  private sendAwarenessUpdate(changedClients: number[]) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(this.awareness, changedClients));
    this.ws.send(encoding.toUint8Array(encoder));
  }

  destroy() {
    this.shouldReconnect = false;
    this.ws?.close();
  }
}
