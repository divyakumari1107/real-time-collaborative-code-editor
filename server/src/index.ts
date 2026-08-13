import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { nanoid } from "nanoid";
import { getOrCreateRoom, cleanupRoomIfEmpty } from "./yjsRoom.js";
import { listHistory, getHistoryEntry, ensureRoom } from "./persistence.js";
import aiRouter from "./ai.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Create/register a room (document) explicitly, e.g. when a user clicks "New Document"
app.post("/api/rooms", async (req, res) => {
  const roomId = nanoid(10);
  await ensureRoom(roomId, req.body?.ownerId ?? null);
  res.json({ roomId });
});

// List saved history snapshots for time-travel UI
app.get("/api/rooms/:roomId/history", async (req, res) => {
  const rows = await listHistory(req.params.roomId);
  res.json(rows);
});

// Fetch a specific historical snapshot's content (as a Yjs update, base64-encoded)
app.get("/api/rooms/:roomId/history/:id", async (req, res) => {
  const data = await getHistoryEntry(parseInt(req.params.id));
  if (!data) return res.status(404).json({ error: "not found" });
  res.json({ data: Buffer.from(data).toString("base64") });
});

app.use("/api/ai", aiRouter);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", async (ws: WebSocket, req) => {
  // URL shape: /ws/<roomName>?userId=<id>
  const url = new URL(req.url ?? "", "http://localhost");
  const roomName = url.pathname.replace("/ws/", "");
  const userId = url.searchParams.get("userId") ?? nanoid(6);

  if (!roomName) {
    ws.close(4000, "room name required");
    return;
  }

  const room = await getOrCreateRoom(roomName);
  room.addConnection(ws, userId);

  ws.on("message", (data: Buffer) => {
    room.handleMessage(ws, new Uint8Array(data));
  });

  ws.on("close", () => {
    room.removeConnection(ws);
    cleanupRoomIfEmpty(roomName);
  });

  ws.on("error", (err) => {
    console.error(`[ws:${roomName}] error`, err);
  });
});

server.listen(PORT, () => {
  console.log(`Collab editor server listening on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws/<roomName>`);
});
