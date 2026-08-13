import { PresenceUser } from "../lib/useYjsRoom";

interface Props {
  peers: PresenceUser[];
  status: "connecting" | "connected" | "offline";
  synced: boolean;
}

export default function PresenceBar({ peers, status, synced }: Props) {
  return (
    <div className="presence-bar">
      <div className="status-pill" data-status={status}>
        <span className="dot" />
        {status === "connected" ? "Live" : status === "connecting" ? "Connecting…" : "Offline (editing locally)"}
        {!synced && status !== "connected" ? " · loading local copy" : ""}
      </div>

      <div className="avatar-stack">
        {peers.length === 0 && <span className="alone-msg">You're the only one here</span>}
        {peers.map((p) => (
          <div
            key={p.clientId}
            className="avatar"
            style={{ backgroundColor: p.color }}
            title={p.name}
          >
            {p.name.slice(0, 2).toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}
