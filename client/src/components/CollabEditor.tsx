import { useEffect, useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { MonacoBinding } from "y-monaco";
import * as Y from "yjs";
import type { WebsocketSyncProvider } from "../lib/wsProvider";
import type * as MonacoTypes from "monaco-editor";

interface Props {
  doc: Y.Doc | undefined;
  provider: WebsocketSyncProvider | undefined;
  language: string;
}

export default function CollabEditor({ doc, provider, language }: Props) {
  const bindingRef = useRef<MonacoBinding>();
  const editorRef = useRef<MonacoTypes.editor.IStandaloneCodeEditor>();

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    if (!doc || !provider) return;

    const ytext = doc.getText("monaco");
    const model = editor.getModel();
    if (!model) return;

    // MonacoBinding wires up: text sync (Yjs <-> Monaco model) AND
    // remote cursor / selection decorations, driven by `provider.awareness`.
    bindingRef.current = new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      provider.awareness as any
    );
  };

  useEffect(() => {
    return () => bindingRef.current?.destroy();
  }, []);

  return (
    <Editor
      height="100%"
      language={language}
      theme="vs-dark"
      onMount={handleMount}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        automaticLayout: true,
        cursorBlinking: "smooth",
      }}
    />
  );
}
