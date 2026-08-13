# Collab Code Editor

A real-time collaborative code editor — like Google Docs, but for code.
Multiple people can edit the same file simultaneously, see each other's live
cursors, keep working offline, and get AI-assisted suggestions, all synced
through a CRDT (Conflict-free Replicated Data Type) core.

Built to go deeper than a typical "wire up a library" project: it includes a
**from-scratch CRDT implementation** (`crdt-demo/`) written and stress-tested
separately from the production sync engine, specifically to demonstrate
understanding of *why* the algorithm works, not just that it does.

## Features

- 🔄 **Real-time sync** — edits propagate to all collaborators instantly via WebSocket + Yjs
- 👥 **Live presence** — see collaborators' cursors, selections, and names as they type
- 📴 **Offline-first** — keep editing with no connection; changes merge automatically on reconnect (IndexedDB + CRDT)
- 🕐 **Version history** — browse and restore past snapshots of a document
- 🤖 **AI co-editor** — inline code suggestions and plain-English change summaries via the Claude API
- 🧠 **Custom CRDT from scratch** — a separately-implemented, stress-tested Logoot-style sequence CRDT (`crdt-demo/`), proving the sync algorithm is understood, not just imported

## Architecture

```
┌─────────────┐        WebSocket (binary,        ┌─────────────┐
│   Browser    │◄──────Yjs sync protocol)────────►│    Server    │
│              │                                    │              │
│ React        │        REST (history, AI,          │ Express      │
│ Monaco Editor│◄──────rooms)──────────────────────►│ WebSocket    │
│ Yjs doc      │                                    │ Yjs docs     │
│ IndexedDB    │                                    │ SQLite       │
│ (offline)    │                                    │ (persistence)│
└─────────────┘                                    └──────┬───────┘
                                                            │
                                                            ▼
                                                    ┌──────────────┐
                                                    │ Anthropic API │
                                                    │ (AI features) │
                                                    └──────────────┘
```

- **`client/`** — React + TypeScript app. Monaco Editor bound to a Yjs
  document via a custom WebSocket provider (`client/src/lib/wsProvider.ts`).
  IndexedDB persists the document locally for offline editing.
- **`server/`** — Node.js + Express + `ws`. Implements the Yjs sync protocol
  by hand (`server/src/yjsRoom.ts`) so the wire format is fully visible
  rather than hidden inside a library. Persists document snapshots + a
  rolling history to SQLite. Proxies AI requests to the Anthropic API so the
  API key never touches the browser.
- **`crdt-demo/`** — A standalone, from-scratch CRDT implementation (no
  dependency on Yjs), with a randomized stress test proving convergence
  across concurrent, out-of-order edits. See its own
  [README](./crdt-demo/README.md) for the algorithm write-up and a real bug
  that was found and fixed while building it.

## Getting started

### 1. Server

```bash
cd server
cp .env.example .env
# edit .env and add your ANTHROPIC_API_KEY if you want the AI features
npm install
npm run dev
```

Server runs at `http://localhost:4000`.

### 2. Client

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Client runs at `http://localhost:5173`. Open it, click **New Document**,
then open the same URL in a second tab (or send it to a friend) to see live
collaboration.

### 3. (Optional) CRDT demo

```bash
cd crdt-demo
npm install
npm run demo     # one worked example
npm run stress    # 200 randomized convergence trials
```

## Tech stack

React · TypeScript · Vite · Monaco Editor · Yjs · Node.js · Express · `ws` ·
SQLite · Anthropic API

## Roadmap / possible extensions

- [ ] Multi-file workspaces (currently one document per room)
- [ ] Syntax-aware AI suggestions per language
- [ ] Voice chat alongside text sync (WebRTC audio)
- [ ] Role-based permissions (owner / editor / viewer) and shareable invite links with scoped access
- [ ] Swap the hand-rolled sync protocol for authenticated, rate-limited connections before any real deployment

## License

MIT — use this however you'd like.
