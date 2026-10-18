type OllamaModel = {
  name: string;
};

type GenerateOptions = {
  baseUrl: string;
  model: string;
  prompt: string;
  onChunk: (text: string) => void;
};

const REQUEST_TIMEOUT_MS = 120_000;
const CONNECTION_TIMEOUT_MS = 10_000;

function getEndpoint(baseUrl: string, path: "api/tags" | "api/generate") {
  let endpoint: URL;
  try {
    endpoint = new URL(baseUrl.trim());
  } catch {
    throw new Error("Set NEXT_PUBLIC_OLLAMA_TEST_URL to the remote Ollama base URL.");
  }

  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error("The direct Ollama URL must be HTTP(S), without credentials or query parameters.");
  }

  endpoint.pathname = `${endpoint.pathname.replace(/\/+$/, "")}/${path}`;
  return endpoint;
}

function timeoutSignal(milliseconds: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), milliseconds);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function connectionError(error: unknown, endpoint: URL) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return new Error(`Ollama request timed out at ${endpoint.origin}.`);
  }
  if (error instanceof TypeError) {
    return new Error(
      `Could not reach ${endpoint.origin}. Check that Ollama is reachable and allows this page's origin in OLLAMA_ORIGINS; browser errors can also mean CORS or firewall blocking.`,
    );
  }
  return error instanceof Error ? error : new Error("The direct Ollama request failed.");
}

async function readError(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  const detail = body && typeof body === "object" && "error" in body && typeof body.error === "string"
    ? body.error
    : "";
  if ((response.status === 400 || response.status === 404) && /model|not found/i.test(detail)) {
    return `Ollama rejected the model name${detail ? `: ${detail}` : "."} Select a model returned by /api/tags.`;
  }
  return detail || `Ollama returned HTTP ${response.status}.`;
}

export async function listDirectOllamaModels(baseUrl: string): Promise<OllamaModel[]> {
  const endpoint = getEndpoint(baseUrl, "api/tags");
  const timeout = timeoutSignal(CONNECTION_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(endpoint, { signal: timeout.signal, cache: "no-store" });
  } catch (error) {
    throw connectionError(error, endpoint);
  } finally {
    timeout.clear();
  }

  if (!response.ok) throw new Error(await readError(response));
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("models" in payload) || !Array.isArray(payload.models)) {
    throw new Error("Ollama /api/tags returned an unexpected model list.");
  }
  const models = payload.models.flatMap((model): OllamaModel[] =>
    model && typeof model === "object" &&
    "name" in model && typeof model.name === "string" && model.name.trim()
      ? [{ name: model.name }]
      : [],
  );
  if (!models.length) throw new Error("Ollama is reachable, but no models are installed.");
  return models;
}

export async function generateDirectOllama({
  baseUrl,
  model,
  prompt,
  onChunk,
}: GenerateOptions) {
  const endpoint = getEndpoint(baseUrl, "api/generate");
  const timeout = timeoutSignal(REQUEST_TIMEOUT_MS);
  const startedAt = performance.now();
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: true }),
      signal: timeout.signal,
      cache: "no-store",
    });
  } catch (error) {
    timeout.clear();
    throw connectionError(error, endpoint);
  }

  if (!response.ok) {
    timeout.clear();
    throw new Error(await readError(response));
  }
  if (!response.body) {
    timeout.clear();
    throw new Error("Ollama returned no response stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullResponse = "";
  let completed = false;

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let event: unknown;
    try {
      event = JSON.parse(trimmed);
    } catch {
      throw new Error("Ollama returned an invalid /api/generate stream event.");
    }
    if (!event || typeof event !== "object") {
      throw new Error("Ollama returned an unexpected /api/generate stream event.");
    }
    if ("error" in event && typeof event.error === "string") {
      throw new Error(event.error);
    }
    if ("response" in event && typeof event.response === "string") {
      fullResponse += event.response;
      if (event.response) onChunk(fullResponse);
    }
    if ("done" in event && event.done === true) completed = true;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        processLine(buffer.slice(0, newline).replace(/\r$/, ""));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) processLine(buffer);
    if (!completed) throw new Error("Ollama's response stream ended before generation completed.");
    if (!fullResponse.trim()) throw new Error("Ollama completed the request without returning any response text.");
    return { text: fullResponse, elapsedMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    if (timeout.signal.aborted) {
      throw new Error(`Ollama generation timed out at ${endpoint.origin}.`);
    }
    throw error;
  } finally {
    timeout.clear();
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
