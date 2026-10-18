type StreamMetrics = {
  requestId: string;
  requestToHeadersMs: number;
  requestToFirstBackendEventMs: number | null;
  requestToFirstVisibleTextMs: number | null;
  totalResponseMs: number;
  succeeded: boolean;
  error?: string;
  serverTimings?: Record<string, number>;
  modelTimings?: Record<string, number | undefined>;
};

type StreamEvent = {
  type?: unknown;
  text?: unknown;
  message?: unknown;
  requestId?: unknown;
  timings?: unknown;
  model?: unknown;
  totalMs?: unknown;
  stage?: unknown;
};

type OllamaOptions = {
  prompt: string;
  weatherContext?: string;
  onChunk: (text: string) => void;
  onMetrics?: (metrics: StreamMetrics) => void;
  signal?: AbortSignal;
};

// randomUUID is unavailable in some browsers and on non-secure origins.
// Request IDs are for tracing only, so retain a UUID-shaped fallback there.
function createRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function numericRecord(value: unknown) {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] =>
      typeof entry[1] === "number" && Number.isFinite(entry[1]),
    ),
  );
}

export async function askOllama({
  prompt,
  weatherContext,
  onChunk,
  onMetrics,
  signal,
}: OllamaOptions) {
  const startedAt = performance.now();
  const requestId = createRequestId();
  let headersAt = startedAt;
  let firstBackendEventAt: number | null = null;
  let firstVisibleTextAt: number | null = null;
  let fullResponse = "";
  let pendingFrame: number | null = null;
  let serverTimings: Record<string, number> | undefined;
  let modelTimings: Record<string, number | undefined> | undefined;
  const flush = () => {
    if (pendingFrame !== null) {
      cancelAnimationFrame(pendingFrame);
      pendingFrame = null;
    }
    if (!fullResponse) return;
    if (firstVisibleTextAt === null) firstVisibleTextAt = performance.now();
    onChunk(fullResponse);
  };
  const reportMetrics = (succeeded: boolean, error?: string) => {
    onMetrics?.({
      requestId,
      requestToHeadersMs: Math.round(headersAt - startedAt),
      requestToFirstBackendEventMs: firstBackendEventAt === null ? null : Math.round(firstBackendEventAt - startedAt),
      requestToFirstVisibleTextMs: firstVisibleTextAt === null ? null : Math.round(firstVisibleTextAt - startedAt),
      totalResponseMs: Math.round(performance.now() - startedAt),
      succeeded,
      error,
      serverTimings,
      modelTimings,
    });
  };

  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
      body: JSON.stringify({ prompt, weatherContext }),
      signal,
      cache: "no-store",
    });
    headersAt = performance.now();
  } catch (error) {
    reportMetrics(false, error instanceof Error ? error.message : "The chat request failed.");
    throw error;
  }

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const message = isRecord(data) && typeof data.error === "string"
      ? data.error
      : `The assistant request failed with HTTP ${response.status}.`;
    reportMetrics(false, message);
    throw new Error(message);
  }
  if (!response.body) {
    const message = "The assistant returned no response stream.";
    reportMetrics(false, message);
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  const processEvent = (rawEvent: string) => {
    let data = rawEvent
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    while (data.startsWith("data:")) {
      data = data.slice(5).trimStart();
    }
    if (!data) return;

    let event: StreamEvent;
    try {
      event = JSON.parse(data) as StreamEvent;
    } catch {
      throw new Error("The assistant stream contained an invalid event.");
    }
    if (firstBackendEventAt === null) firstBackendEventAt = performance.now();

    if (event.type === "token" && typeof event.text === "string") {
      fullResponse += event.text;
      if (pendingFrame === null) {
        pendingFrame = requestAnimationFrame(() => {
          pendingFrame = null;
          if (firstVisibleTextAt === null) firstVisibleTextAt = performance.now();
          onChunk(fullResponse);
        });
      }
      return;
    }
    if (event.type === "error") {
      serverTimings = numericRecord(event.timings);
      throw new Error(typeof event.message === "string" ? event.message : "The assistant could not complete the response.");
    }
    if (event.type === "done") {
      completed = true;
      serverTimings = numericRecord(event.timings);
      modelTimings = numericRecord(event.model);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = /(?:\r\n|\r|\n){2}/.exec(buffer);
      while (separator?.index !== undefined) {
        processEvent(buffer.slice(0, separator.index));
        buffer = buffer.slice(separator.index + separator[0].length);
        separator = /(?:\r\n|\r|\n){2}/.exec(buffer);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) processEvent(buffer);
    flush();

    if (!completed) throw new Error("The assistant stream ended before the response was complete.");
    reportMetrics(true);
    return fullResponse;
  } catch (error) {
    flush();
    reportMetrics(false, error instanceof Error ? error.message : "Unknown stream error.");
    throw error;
  } finally {
    if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
