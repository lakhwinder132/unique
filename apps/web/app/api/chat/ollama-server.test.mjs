import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getOllamaChatEndpoint, readOllamaStream } from "./ollama-server.ts";

test("uses the runtime Ollama URL and appends the chat path", () => {
  assert.equal(
    getOllamaChatEndpoint("http://localhost:11434").href,
    "http://localhost:11434/api/chat",
  );
});

test("normalizes trailing slashes and preserves a configured base path", () => {
  assert.equal(
    getOllamaChatEndpoint("http://localhost:11434/ollama///").href,
    "http://localhost:11434/ollama/api/chat",
  );
});

test("rejects missing or unsafe Ollama configuration", () => {
  assert.throws(() => getOllamaChatEndpoint(undefined), /OLLAMA_URL is not configured/);
  assert.throws(() => getOllamaChatEndpoint(""), /OLLAMA_URL is not configured/);
  assert.throws(() => getOllamaChatEndpoint("ftp://localhost:11434"), /HTTP or HTTPS/);
  assert.throws(() => getOllamaChatEndpoint("http://user:secret@localhost:11434"), /without credentials/);
});

test("chat route has no obsolete hardcoded Ollama IP fallback", async () => {
  const route = await readFile(new URL("./route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /3\.7\.66\.165:11434|ai\.shelly22\.online/);
  assert.match(route, /getOllamaChatEndpoint\(process\.env\.OLLAMA_URL\)/);
  assert.match(route, /fetch\(ollamaEndpoint,/);
  assert.match(route, /status: 500/);
  assert.match(route, /status: 502/);
});

test("reads token and completion events incrementally from NDJSON and SSE", async () => {
  const chunks = [
    new TextEncoder().encode('{"message":{"content":"Punjabi "},"done":false}\n'),
    new TextEncoder().encode('data: {"type":"token","text":"answer"}\r\n\r\n'),
    new TextEncoder().encode('data: {"type":"done","model":{"eval_count":3}}\n\n'),
  ];
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

  const items = [];
  for await (const item of readOllamaStream(body)) items.push(item);

  assert.deepEqual(items, [
    { kind: "chunk", value: { message: { content: "Punjabi " }, done: false } },
    { kind: "chunk", value: { type: "token", text: "answer" } },
    { kind: "chunk", value: { type: "done", model: { eval_count: 3 } } },
  ]);
});

test("aborting a stream cancels the Ollama response reader", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    pull() {},
    cancel() {
      cancelled = true;
    },
  });
  const controller = new AbortController();
  const iterator = readOllamaStream(body, controller.signal)[Symbol.asyncIterator]();
  const pendingRead = iterator.next();

  controller.abort();

  assert.deepEqual(await pendingRead, { value: undefined, done: true });
  assert.equal(cancelled, true);
});
