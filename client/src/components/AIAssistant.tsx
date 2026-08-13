import { useState } from "react";
import * as Y from "yjs";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

interface Props {
  doc: Y.Doc | undefined;
  language: string;
}

export default function AIAssistant({ doc, language }: Props) {
  const [suggestion, setSuggestion] = useState("");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState<"suggest" | "explain" | null>(null);
  const [lastSnapshot, setLastSnapshot] = useState("");

  const currentText = () => (doc ? doc.getText("monaco").toString() : "");

  const getSuggestion = async () => {
    setLoading("suggest");
    setSuggestion("");
    try {
      const res = await fetch(`${API_URL}/api/ai/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeBeforeCursor: currentText(), language }),
      });
      const data = await res.json();
      setSuggestion(data.suggestion || data.error || "No suggestion returned.");
    } catch (err) {
      setSuggestion("Couldn't reach the AI backend. Is the server running?");
    } finally {
      setLoading(null);
    }
  };

  const explainChange = async () => {
    setLoading("explain");
    setExplanation("");
    try {
      const after = currentText();
      const res = await fetch(`${API_URL}/api/ai/explain-diff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ before: lastSnapshot, after }),
      });
      const data = await res.json();
      setExplanation(data.explanation || data.error || "No explanation returned.");
      setLastSnapshot(after);
    } catch (err) {
      setExplanation("Couldn't reach the AI backend. Is the server running?");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="ai-panel">
      <h3>AI Co-Editor</h3>

      <button onClick={getSuggestion} disabled={loading !== null}>
        {loading === "suggest" ? "Thinking…" : "Suggest next lines"}
      </button>
      {suggestion && <pre className="ai-output">{suggestion}</pre>}

      <button onClick={explainChange} disabled={loading !== null}>
        {loading === "explain" ? "Reading diff…" : "Explain recent changes"}
      </button>
      {explanation && <p className="ai-output">{explanation}</p>}

      <p className="ai-hint">
        Powered by the Claude API — requires <code>ANTHROPIC_API_KEY</code> set on the server.
      </p>
    </div>
  );
}
