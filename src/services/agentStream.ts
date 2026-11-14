import type { AgentEvent } from "./agentContract";

const EVENT_TYPES = new Set(["status", "text", "block", "suggestions", "conversation", "cv", "done", "error"]);

function isAgentEvent(value: unknown): value is AgentEvent {
  return Boolean(value) && typeof value === "object" && EVENT_TYPES.has((value as { type?: unknown }).type as string);
}

/**
 * Incremental Server-Sent Events parser. Network chunks can split an event anywhere,
 * so text is buffered until a blank line ends the event. Unknown or malformed events are skipped.
 */
export function createSseParser(onEvent: (event: AgentEvent) => void) {
  let buffer = "";
  const flushEvent = (raw: string) => {
    const data = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data) return;
    try {
      const parsed: unknown = JSON.parse(data);
      if (isAgentEvent(parsed)) onEvent(parsed);
    } catch {
      // A malformed event is dropped rather than breaking the whole answer.
    }
  };
  return {
    feed(chunk: string) {
      buffer += chunk;
      let boundary = buffer.search(/\r?\n\r?\n/);
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, "");
        flushEvent(raw);
        boundary = buffer.search(/\r?\n\r?\n/);
      }
    },
    end() {
      if (buffer.trim()) flushEvent(buffer);
      buffer = "";
    },
  };
}
