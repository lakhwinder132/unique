export type OllamaStreamItem =
  | { kind: "chunk"; value: unknown }
  | { kind: "done" };

export function getOllamaChatEndpoint(configuredUrl: string | undefined) {
  const value = configuredUrl?.trim();
  if (!value) {
    throw new Error(
      "OLLAMA_URL is not configured. Set it in the server runtime environment to the reachable Ollama base URL.",
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error("OLLAMA_URL must be a valid HTTP or HTTPS base URL.");
  }

  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error("OLLAMA_URL must be an HTTP or HTTPS base URL without credentials, query parameters, or a fragment.");
  }

  endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, "")}/api/chat`;
  return endpoint;
}

export async function* readOllamaStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<OllamaStreamItem> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const cancelReader = () => {
    void reader.cancel(signal?.reason).catch(() => undefined);
  };
  if (signal?.aborted) cancelReader();
  else signal?.addEventListener("abort", cancelReader, { once: true });

  const parseLine = (rawLine: string): OllamaStreamItem | null => {
    let line = rawLine.trim();
    if (!line || line.startsWith(":") || /^(event|id|retry):/.test(line)) return null;
    while (line.startsWith("data:")) {
      line = line.slice(5).trimStart();
    }
    if (!line) return null;
    if (line === "[DONE]") return { kind: "done" };

    try {
      return { kind: "chunk", value: JSON.parse(line) as unknown };
    } catch {
      throw new Error("Ollama returned an invalid streaming event.");
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separator = /\r\n|\r|\n/.exec(buffer);
      while (separator?.index !== undefined) {
        const item = parseLine(buffer.slice(0, separator.index));
        buffer = buffer.slice(separator.index + separator[0].length);
        if (item) yield item;
        separator = /\r\n|\r|\n/.exec(buffer);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const item = parseLine(buffer);
      if (item) yield item;
    }
  } finally {
    signal?.removeEventListener("abort", cancelReader);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
