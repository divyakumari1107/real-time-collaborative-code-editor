import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useYjsRoom } from "./lib/useYjsRoom";
import CollabEditor from "./components/CollabEditor";
import PresenceBar from "./components/PresenceBar";
import AIAssistant from "./components/AIAssistant";
import VersionHistory from "./components/VersionHistory";

const LANGUAGES = ["javascript", "typescript", "python", "java", "cpp", "go", "rust", "html", "css"];

export default function App() {
  const { roomId = "" } = useParams();
  const [userName] = useState(() => `User-${Math.floor(Math.random() * 1000)}`);
  const [language, setLanguage] = useState("javascript");

  const { doc, provider, status, synced, peers } = useYjsRoom(roomId, userName);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          ⌘ Collab Editor
        </Link>
        <span className="room-id">
          Room: <code>{roomId}</code>
          <button
            className="copy-btn"
            onClick={() => navigator.clipboard.writeText(window.location.href)}
          >
            Copy invite link
          </button>
        </span>

        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <VersionHistory roomId={roomId} doc={doc} />
      </header>

      <PresenceBar peers={peers} status={status} synced={synced} />

      <main className="editor-layout">
        <div className="editor-pane">
          <CollabEditor doc={doc} provider={provider} language={language} />
        </div>
        <aside className="side-pane">
          <AIAssistant doc={doc} language={language} />
        </aside>
      </main>
    </div>
  );
}
