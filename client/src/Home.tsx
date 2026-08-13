import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Home() {
  const [joinId, setJoinId] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const createRoom = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rooms`, { method: "POST" });
      const { roomId } = await res.json();
      navigate(`/room/${roomId}`);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = () => {
    if (joinId.trim()) navigate(`/room/${joinId.trim()}`);
  };

  return (
    <div className="home">
      <div className="home-card">
        <h1>Collab Code Editor</h1>
        <p className="subtitle">Real-time collaborative coding, like Google Docs but for code.</p>

        <button className="primary-btn" onClick={createRoom} disabled={loading}>
          {loading ? "Creating..." : "+ New Document"}
        </button>

        <div className="divider">or</div>

        <div className="join-row">
          <input
            placeholder="Paste a room ID to join"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
          />
          <button onClick={joinRoom}>Join</button>
        </div>
      </div>
    </div>
  );
}
