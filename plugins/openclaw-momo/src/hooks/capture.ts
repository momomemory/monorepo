import type { MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";

function getLastTurn(messages: unknown[]): unknown[] {
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (
      msg &&
      typeof msg === "object" &&
      (msg as Record<string, unknown>).role === "user"
    ) {
      lastUserIdx = i;
      break;
    }
  }

  return lastUserIdx >= 0 ? messages.slice(lastUserIdx) : messages;
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const text = (block as Record<string, unknown>).text;
      if (typeof text === "string" && text.length > 0) {
        parts.push(text);
      }
    }
    return parts.join("\n");
  }

  return "";
}

function stripInjectedContext(text: string): string {
  return text
    .replace(/<momo-context>[\s\S]*?<\/momo-context>\s*/g, "")
    .replace(/<supermemory-context>[\s\S]*?<\/supermemory-context>\s*/g, "")
    .trim();
}

export function buildCaptureHandler(
  client: MomoOpenClawClient,
  cfg: MomoOpenClawConfig,
  getSessionKey: () => string | undefined,
) {
  return async (event: Record<string, unknown>) => {
    if (
      !event.success ||
      !Array.isArray(event.messages) ||
      event.messages.length === 0
    ) {
      return;
    }

    const lastTurn = getLastTurn(event.messages);
    const extracted: Array<{ role: "user" | "assistant"; content: string }> = [];

    for (const msg of lastTurn) {
      if (!msg || typeof msg !== "object") continue;
      const row = msg as Record<string, unknown>;
      if (row.role !== "user" && row.role !== "assistant") continue;

      const text = extractTextContent(row.content);
      if (!text) continue;

      const finalText =
        cfg.captureMode === "all" ? stripInjectedContext(text) : text.trim();

      if (cfg.captureMode === "all" && finalText.length < 10) continue;

      extracted.push({
        role: row.role,
        content: finalText,
      });
    }

    if (extracted.length === 0) {
      return;
    }

    const sessionKey = getSessionKey();
    log.debug(
      `capturing ${extracted.length} messages (${sessionKey ?? "no-session-key"})`,
    );

    try {
      await client.ingestConversation(extracted, sessionKey, "episode");
    } catch (err) {
      log.error("capture failed", err);
    }
  };
}
