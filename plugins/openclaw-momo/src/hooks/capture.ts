import type { MomoOpenClawClient } from "../client";
import type { MomoOpenClawConfig } from "../config";
import { log } from "../logger";

type MessageRole = "user" | "assistant";

type ChatChunk = {
  role: MessageRole;
  content: string;
};

function findLastUserMessageIndex(messages: unknown[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const entry = messages[i];
    if (!entry || typeof entry !== "object") continue;
    if ((entry as Record<string, unknown>).role === "user") return i;
  }
  return -1;
}

function flattenMessageContent(content: unknown): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    const parts = content
      .map((block) => {
        if (!block || typeof block !== "object") return "";
        const text = (block as Record<string, unknown>).text;
        return typeof text === "string" ? text : "";
      })
      .filter((value) => value.length > 0);

    return parts.join("\n");
  }

  return "";
}

function removeInjectedSections(text: string): string {
  return text
    .replace(/<momo-context>[\s\S]*?<\/momo-context>/gi, "")
    .replace(/<supermemory-context>[\s\S]*?<\/supermemory-context>/gi, "")
    .trim();
}

function normalizeCapturedText(raw: string, mode: MomoOpenClawConfig["captureMode"]): string {
  const text = mode === "all" ? removeInjectedSections(raw) : raw.trim();
  return text;
}

function shouldIgnore(content: string, mode: MomoOpenClawConfig["captureMode"]): boolean {
  if (content.length === 0) return true;
  if (mode === "all" && content.length < 12) return true;
  return false;
}

function collectTurnMessages(
  eventMessages: unknown[],
  mode: MomoOpenClawConfig["captureMode"],
): ChatChunk[] {
  const start = findLastUserMessageIndex(eventMessages);
  const relevant = start >= 0 ? eventMessages.slice(start) : eventMessages;

  const chunks: ChatChunk[] = [];
  for (const row of relevant) {
    if (!row || typeof row !== "object") continue;

    const record = row as Record<string, unknown>;
    const role = record.role;
    if (role !== "user" && role !== "assistant") continue;

    const flattened = flattenMessageContent(record.content);
    const normalized = normalizeCapturedText(flattened, mode);

    if (shouldIgnore(normalized, mode)) continue;

    chunks.push({ role, content: normalized });
  }

  return chunks;
}

function isCaptureEvent(event: Record<string, unknown>): event is { messages: unknown[] } {
  if (!event.success) return false;
  if (!Array.isArray(event.messages)) return false;
  return event.messages.length > 0;
}

export function buildCaptureHandler(
  client: MomoOpenClawClient,
  cfg: MomoOpenClawConfig,
  getSessionKey: () => string | undefined,
) {
  return async (event: Record<string, unknown>) => {
    if (!isCaptureEvent(event)) {
      return;
    }

    const chunks = collectTurnMessages(event.messages, cfg.captureMode);
    if (chunks.length === 0) {
      log.debug("capture: nothing eligible to persist");
      return;
    }

    const sessionKey = getSessionKey();
    log.debug(`capture: persisting ${chunks.length} message chunks`);

    try {
      await client.ingestConversation(chunks, sessionKey, "episode");
    } catch (err) {
      log.error("capture failed", err);
    }
  };
}
