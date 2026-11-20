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

  const bindEditor = (editor: MonacoTypes.editor.IStandaloneCodeEditor) => {
    if (!doc || !provider) return;
    const ytext = doc.getText("monaco");
    const model = editor.getModel();
    if (!model) return;

    bindingRef.current?.destroy();
    bindingRef.current = new MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      provider.awareness as any
    );
  };

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    bindEditor(editor);
  };

  // Re-bind when provider or doc becomes available or changes
  useEffect(() => {
    if (editorRef.current) {
      bindEditor(editorRef.current);
    }
    return () => {
      bindingRef.current?.destroy();
      bindingRef.current = undefined;
    };
  }, [doc, provider]);

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
