/**
 * Compaction logic for ingesting conversation summaries into Momo.
 *
 * Monitors session events and, when OpenCode compacts a session,
 * ingests the summary into Momo for long-term memory.
 */

import type { MomoClient } from "@momomemory/sdk";
import type { Event, AssistantMessage } from "@opencode-ai/sdk";

interface CompactionSessionState {
  lastCompaction: number;
  inProgress: boolean;
}

const COMPACTION_COOLDOWN_MS = 30_000;

const sessionStates = new Map<string, CompactionSessionState>();

function getState(sessionID: string): CompactionSessionState {
  let state = sessionStates.get(sessionID);
  if (!state) {
    state = { lastCompaction: 0, inProgress: false };
    sessionStates.set(sessionID, state);
  }
  return state;
}

/**
 * Handle events relevant to conversation compaction.
 * - On `session.compacted`: mark that a compaction just happened for a session
 * - On `message.updated`: when a summary message finishes, ingest it into Momo
 * - On `session.deleted`: clean up tracked state
 */
export async function handleCompactionEvent(
  event: Event,
  momo: MomoClient,
  containerTag: string,
): Promise<void> {
  switch (event.type) {
    case "session.compacted": {
      const { sessionID } = event.properties;
      const state = getState(sessionID);
      state.inProgress = true;
      break;
    }

    case "message.updated": {
      const { info } = event.properties;
      if (info.role !== "assistant") break;

      const msg = info as AssistantMessage;
      // Only process finished summary messages
      if (!msg.summary || !msg.finish) break;

      const state = getState(msg.sessionID);
      if (!state.inProgress) break;

      const now = Date.now();
      if (now - state.lastCompaction < COMPACTION_COOLDOWN_MS) {
        state.inProgress = false;
        break;
      }

      state.inProgress = false;
      state.lastCompaction = now;

      // The summary content is not directly on the message —
      // we ingest a marker so Momo knows a compaction occurred.
      // The actual summary text will flow through chat.message
      // hook on the next user interaction.
      try {
        await momo.conversations.ingest({
          messages: [
            {
              role: "assistant",
              content: `[Session compaction summary for session ${msg.sessionID}]`,
            },
          ],
          containerTag,
          sessionId: msg.sessionID,
          memoryType: "episode",
        });
      } catch {
        // Silently fail — compaction ingestion is best-effort
      }
      break;
    }

    case "session.deleted": {
      const { info } = event.properties;
      sessionStates.delete(info.id);
      break;
    }
  }
}

/** Visible for testing */
export function _resetState(): void {
  sessionStates.clear();
}
