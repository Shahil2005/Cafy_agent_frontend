import { auth } from "./firebase";
import { getBackendUrl } from "./apiConfig";
import type {
  AgentConversationSummary,
  AgentErrorCode,
  AgentEvent,
  AgentStoredMessage,
} from "./agentContract";
import { createSseParser } from "./agentStream";

const KNOWN_ERRORS = new Set<AgentErrorCode>(["INVALID_INPUT", "CV_UNREADABLE", "PLAN_REQUIRED", "LIMIT_REACHED", "AI_UNAVAILABLE", "INTERNAL"]);

async function authHeader(): Promise<Record<string, string> | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

/**
 * Sends one message and reports each live event as it arrives. The server keeps the
 * conversation, so only its id travels with the message. Every failure ends in an `error` event.
 */
export async function streamAgentTurn(options: {
  message: string;
  conversationId?: string;
  /** A CV the user picked from their profile, already read to text in the browser. */
  cv?: { name: string; text: string; sourceId?: string };
  /** Regenerate / Try again: the server replaces the previous answer instead of saving a duplicate. */
  regenerate?: boolean;
  signal: AbortSignal;
  onEvent: (event: AgentEvent) => void;
}): Promise<void> {
  const { onEvent, signal } = options;
  let finished = false;
  const emit = (event: AgentEvent) => {
    if (event.type === "done" || event.type === "error") finished = true;
    onEvent(event);
  };
  try {
    const headers = await authHeader();
    if (!headers) {
      emit({ type: "error", code: "INTERNAL", message: "Please sign in again to continue.", retryable: false });
      return;
    }
    const response = await fetch(`${getBackendUrl()}/api/agent/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...headers },
      body: JSON.stringify({
        message: options.message,
        ...(options.conversationId ? { conversationId: options.conversationId } : {}),
        ...(options.cv ? { cv: options.cv } : {}),
        ...(options.regenerate ? { regenerate: true } : {}),
      }),
      signal,
      cache: "no-store",
    });
    if (response.status === 429 && !(await response.clone().json().catch(() => ({})) as { error?: string }).error?.startsWith("LIMIT")) {
      // Per-minute rate limit (not the daily cap): friendly and retryable.
      emit({ type: "error", code: "INTERNAL", message: "You're sending messages quickly. Please wait a minute, then try again.", retryable: true });
      return;
    }
    if (response.status === 409) {
      // Another tab is still getting an answer: only one answer at a time per user.
      emit({ type: "error", code: "INTERNAL", message: "CAFY is still answering your last message (maybe in another tab). Please wait a moment, then try again.", retryable: true });
      return;
    }
    if (!response.ok || !response.body) {
      const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      const code = KNOWN_ERRORS.has(body.error as AgentErrorCode) ? (body.error as AgentErrorCode) : "INTERNAL";
      emit({
        type: "error",
        code,
        message: body.message || "CAFY could not answer right now. Please try again.",
        retryable: code !== "PLAN_REQUIRED" && code !== "LIMIT_REACHED",
      });
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = createSseParser(emit);
    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
    }
    // The server may keep working after `done` (memory upkeep); the answer is complete, so stop reading.
    if (finished) await reader.cancel().catch(() => undefined);
    else parser.end();
    if (!finished && !signal.aborted)
      emit({ type: "error", code: "NETWORK", message: "The connection dropped before the answer finished.", retryable: true });
  } catch {
    if (signal.aborted || finished) return;
    emit({ type: "error", code: "NETWORK", message: "We could not reach CAFY. Check your connection and try again.", retryable: true });
  }
}

async function agentRequest<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const headers = await authHeader();
  if (!headers) throw new Error("Please sign in again to continue.");
  const response = await fetch(`${getBackendUrl()}/api/agent${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) }, cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Your conversations could not be loaded. Please try again.");
  return response.status === 204 ? null : ((await response.json()) as T);
}

export async function listAgentConversations(): Promise<AgentConversationSummary[]> {
  const result = await agentRequest<{ conversations: AgentConversationSummary[] }>("/conversations");
  return result?.conversations ?? [];
}

export async function loadAgentConversation(id: string): Promise<{ id: string; title: string; cvName?: string; messages: AgentStoredMessage[] } | null> {
  return agentRequest(`/conversations/${encodeURIComponent(id)}`);
}

export async function deleteAgentConversation(id: string): Promise<void> {
  await agentRequest(`/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function sendAgentFeedback(entry: { conversationId: string; answerIndex: number; rating: "up" | "down"; reason?: "wrong" | "not_useful" | "too_long" | "other" }): Promise<void> {
  await agentRequest("/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) });
}

/**
 * Asks the server to remove the agent's own copies of CVs the user has deleted from their profile.
 * Best-effort: failures are ignored, and the server re-checks next time the chat opens.
 */
export async function cleanupAgentCvData(): Promise<void> {
  try {
    await agentRequest("/cv-cleanup", { method: "POST" });
  } catch {
    // Non-blocking by design.
  }
}
