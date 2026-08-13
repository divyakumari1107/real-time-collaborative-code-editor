import { useEffect, useState } from "react";
import * as Y from "yjs";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

interface HistoryEntry {
  id: number;
  created_at: number;
}

interface Props {
  roomId: string;
  doc: Y.Doc | undefined;
}

export default function VersionHistory({ roomId, doc }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [open, setOpen] = useState(false);

  const loadHistory = async () => {
    const res = await fetch(`${API_URL}/api/rooms/${roomId}/history`);
    setEntries(await res.json());
  };

  useEffect(() => {
    if (open) loadHistory();
  }, [open]);

  const restore = async (id: number) => {
    if (!doc) return;
    const res = await fetch(`${API_URL}/api/rooms/${roomId}/history/${id}`);
    const { data } = await res.json();
    const update = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));

    // Restoring = replace current text with the historical text. We do this
    // by diffing at the Y.Text level: clear then insert, so the change is
    // itself a normal, sync-able Yjs operation (other collaborators see it
    // as a live edit, not a silent overwrite).
    const historicalDoc = new Y.Doc();
    Y.applyUpdate(historicalDoc, update);
    const historicalText = historicalDoc.getText("monaco").toString();

    const ytext = doc.getText("monaco");
    doc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, historicalText);
    });
    setOpen(false);
  };

  return (
    <div className="version-history">
      <button onClick={() => setOpen((o) => !o)}>{open ? "Close History" : "Version History"}</button>
      {open && (
        <div className="history-list">
          {entries.length === 0 && <p>No saved versions yet — keep editing, snapshots autosave.</p>}
          {entries.map((e) => (
            <div key={e.id} className="history-entry">
              <span>{new Date(e.created_at).toLocaleString()}</span>
              <button onClick={() => restore(e.id)}>Restore</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
