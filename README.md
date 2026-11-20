# ⚡ Real-Time Collaborative Code Editor

A production-style real-time collaborative code editor — like **Google Docs + VS Code**. Multiple people can edit the same file simultaneously, see each other's live cursors and colored selections, keep working offline, and receive AI-assisted completions, all synced through a **CRDT (Conflict-free Replicated Data Type)** core.

![Architecture Status](https://img.shields.io/badge/Architecture-CRDT%20%2B%20WebSockets-brightgreen)
![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-blue)
![Editor](https://img.shields.io/badge/Editor-Monaco%20Editor-007acc)
![Sync](https://img.shields.io/badge/Sync-Yjs%20CRDT-orange)
![Docker](https://img.shields.io/badge/Containerized-Docker%20Compose-2496ed)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

---

## 🌟 Key Features

- 🔄 **Real-Time Synchronization**: Edits propagate to all collaborators instantly via WebSockets and binary Yjs protocol.
- 👥 **Live Presence & Cursors**: See collaborators' cursors, selection highlights, and name tags in distinct colors as they type.
- 📴 **Offline-First Resilience**: Edit seamlessly without internet connection; changes are saved locally to IndexedDB and automatically merge without conflict on reconnect.
- 🕐 **Version History & Time-Travel**: Browse, inspect, and revert past document snapshots stored in SQLite.
- 🤖 **AI Co-Editor**: Inline code completion and plain-English code diff summaries (supports Claude, Gemini, or smart fallback engine).
- 🧠 **Standalone Custom CRDT (`crdt-demo/`)**: Includes a from-scratch Logoot-style sequence CRDT with 200 randomized stress tests proving convergence.

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐        WebSocket (Binary Yjs Sync)       ┌─────────────────────────────────┐
│        Client (Browser)         │◄────────────────────────────────────────►│        Server (Node.js)         │
│                                 │                                          │                                 │
│  React 18 + TypeScript          │        REST (Rooms, History, AI)         │  Express + WebSockets (`ws`)    │
│  Monaco Editor (VS Code core)   │◄────────────────────────────────────────►│  Yjs Room Sync Manager          │
│  Yjs Doc + Awareness            │                                          │  SQLite Persistence             │
│  IndexedDB (Offline Cache)      │                                          │                                 │
└─────────────────────────────────┘                                          └────────────────┬────────────────┘
                                                                                              │
                                                                                              ▼
                                                                             ┌─────────────────────────────────┐
                                                                             │  AI Engine (Claude/Gemini/Smart)│
                                                                             └─────────────────────────────────┘
```

---

## ⚡ 1-Click Quickstart (Docker Compose)

### 1. Launch with Docker (Recommended)
Make sure [Docker Desktop](https://www.docker.com/products/docker-desktop/) is running, then run:

```bash
docker compose up -d --build
```
*(On Windows, you can simply double-click **`run.bat`**)*

### 2. Access the Applications
* **Collaborative Editor**: [http://localhost:5173](http://localhost:5173)
* **Backend Health Check**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

Open [http://localhost:5173](http://localhost:5173), click **"+ New Document"**, and copy the URL into a second browser tab (or send it to a friend) to see real-time cursor tracking and typing sync!

---

## 🛠️ Local Development (Without Docker)

### 1. Server
```bash
cd server
npm install
npm run dev
```
Server runs at `http://localhost:4000`.

### 2. Client
```bash
cd client
npm install
npm run dev
```
Client runs at `http://localhost:5173`.

### 3. (Optional) Run Standalone CRDT Stress Test
```bash
cd crdt-demo
npm install
npm run stress     # 200 randomized convergence trials
```

---

## 📁 Repository Structure

```text
real-time-collaborative-code-editor/
├── docker-compose.yml          # Container orchestration (Server + Client)
├── run.bat                     # 1-click Windows launcher
├── upload_to_github.bat        # Git push automation helper
├── README.md                   # Complete documentation
├── client/                     # React 18 + TypeScript frontend
│   ├── Dockerfile
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx             # Main collaborative room layout
│       ├── Home.tsx            # Landing page (Create / Join room)
│       ├── components/
│       │   ├── CollabEditor.tsx # Monaco Editor + Yjs synchronization
│       │   ├── PresenceBar.tsx  # Collaborator avatars & presence
│       │   ├── AIAssistant.tsx  # AI code completion & diff explain
│       │   └── VersionHistory.tsx
│       └── lib/
│           ├── useYjsRoom.ts    # Yjs connection hook
│           └── wsProvider.ts    # Raw WebSocket Yjs sync provider
├── server/                     # Node.js + Express + WebSocket backend
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.ts            # Express server & WebSocket router
│       ├── yjsRoom.ts          # Yjs binary sync protocol handler
│       ├── persistence.ts      # SQLite document snapshots & history
│       └── ai.ts               # AI proxy (Claude / Gemini / Fallback)
└── crdt-demo/                  # From-scratch RGA/Logoot CRDT demo & tests
    ├── src/logoot.ts
    └── tests/stress.test.ts
```

---

## 📄 License
MIT License — free for educational, presentation, and interview use.
