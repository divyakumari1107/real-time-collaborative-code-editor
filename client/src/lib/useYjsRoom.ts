/**
 * useYjsRoom.ts
 *
 * This hook is the client-side counterpart to server/src/yjsRoom.ts.
 * It sets up:
 *   1. A Yjs document (the shared, CRDT-backed data structure)
 *   2. A raw WebSocket connection to our custom sync server (see
 *      lib/wsProvider.ts) — we don't use the stock `y-websocket` provider
 *      package so the wire protocol stays visible and hackable
 *   3. IndexedDB persistence so edits made offline aren't lost and get
 *      merged automatically once the connection comes back
 *   4. Awareness (presence) — cursor position, name, color per user
 */

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketSyncProvider } from "./wsProvider";
import { randomColor } from "./randomColor";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:4000";

export interface PresenceUser {
  clientId: number;
  name: string;
  color: string;
}

export function useYjsRoom(roomId: string, userName: string) {
  const docRef = useRef<Y.Doc>();
  const providerRef = useRef<WebsocketSyncProvider>();
  const persistenceRef = useRef<IndexeddbPersistence>();

  const [status, setStatus] = useState<"connecting" | "connected" | "offline">("connecting");
  const [synced, setSynced] = useState(false);
  const [peers, setPeers] = useState<PresenceUser[]>([]);

  if (!docRef.current) {
    docRef.current = new Y.Doc();
  }

  useEffect(() => {
    const doc = docRef.current!;

    // 1. Offline-first: hydrate from IndexedDB immediately, and keep saving
    // local edits there even while offline.
    const persistence = new IndexeddbPersistence(`collab-editor-${roomId}`, doc);
    persistenceRef.current = persistence;
    persistence.on("synced", () => setSynced(true));

    // 2. Connect to the server for real-time sync + presence.
    const provider = new WebsocketSyncProvider(`${WS_URL}/ws/${roomId}`, doc, {
      userId: `${userName}-${Math.random().toString(36).slice(2, 8)}`,
    });
    providerRef.current = provider;

    provider.awareness.setLocalStateField("user", {
      name: userName,
      color: randomColor(),
    });

    provider.on("status", (s: "connecting" | "connected" | "offline") => setStatus(s));

    provider.awareness.on("change", () => {
      const states = Array.from(provider.awareness.getStates().entries());
      setPeers(
        states
          .filter(([clientId]) => clientId !== doc.clientID)
          .map(([clientId, state]: [number, any]) => ({
            clientId,
            name: state.user?.name ?? "Anonymous",
            color: state.user?.color ?? "#999",
          }))
      );
    });

    return () => {
      provider.destroy();
      persistence.destroy();
    };
  }, [roomId, userName]);

  return {
    doc: docRef.current,
    provider: providerRef.current,
    status,
    synced,
    peers,
  };
}
