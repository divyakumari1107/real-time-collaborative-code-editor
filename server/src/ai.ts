/**
 * ai.ts
 *
 * Proxies requests to the Anthropic API so the API key never has to live in
 * the browser. Two endpoints:
 *   - POST /api/ai/complete   -> inline code suggestion (ghost text)
 *   - POST /api/ai/explain-diff -> plain-English summary of a code change
 */

import { Router } from "express";

const router = Router();
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

async function callClaude(systemPrompt: string, userPrompt: string) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set in the server environment");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
  return textBlock?.text ?? "";
}

// Inline completion: given code up to the cursor, suggest the next chunk.
router.post("/complete", async (req, res) => {
  try {
    const { codeBeforeCursor, language } = req.body as {
      codeBeforeCursor: string;
      language: string;
    };

    const suggestion = await callClaude(
      `You are a code completion engine embedded in an editor. ` +
        `The user is writing ${language || "code"}. ` +
        `Given the code so far, output ONLY the next few lines that should come next. ` +
        `No explanation, no markdown fences, just raw code.`,
      codeBeforeCursor
    );

    res.json({ suggestion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// Diff explainer: given old and new code, explain the change in plain English.
router.post("/explain-diff", async (req, res) => {
  try {
    const { before, after } = req.body as { before: string; after: string };

    const explanation = await callClaude(
      `You are a helpful pair-programming assistant. Explain code changes ` +
        `concisely (2-3 sentences max) for a teammate who just saw a live edit ` +
        `happen in a collaborative editor.`,
      `BEFORE:\n${before}\n\nAFTER:\n${after}\n\nWhat changed and why might it matter?`
    );

    res.json({ explanation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
