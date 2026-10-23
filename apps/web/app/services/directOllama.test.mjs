import assert from "node:assert/strict";
import test from "node:test";
import { generateDirectOllama, listDirectOllamaModels } from "./directOllama.ts";

test("loads installed models from the official tags endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return Response.json({ models: [{ name: "qwen3:1.7b" }, { name: "llama3" }] });
  };
  try {
    assert.deepEqual(
      await listDirectOllamaModels("http://3.7.252.21:11434/"),
      [{ name: "qwen3:1.7b" }, { name: "llama3" }],
    );
    assert.equal(requestedUrl, "http://3.7.252.21:11434/api/tags");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sends a selected model to generate and emits partial NDJSON responses", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = "";
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "http://ollama.test:11434/api/generate");
    requestBody = String(options.body);
    const chunks = [
      '{"response":"ਸਤਿ ","done":false}\n{"response":"ਸ੍ਰੀ ਅਕਾਲ","done":false}\n{"res',
      'ponse":"","done":true}',
    ];
    return new Response(new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      },
    }));
  };
  const updates = [];
  try {
    const result = await generateDirectOllama({
      baseUrl: "http://ollama.test:11434/",
      model: "qwen3:1.7b",
      prompt: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ",
      onChunk: (text) => updates.push(text),
    });
    assert.deepEqual(JSON.parse(requestBody), {
      model: "qwen3:1.7b",
      prompt: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ",
      stream: true,
    });
    assert.equal(result.text, "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ");
    assert.deepEqual(updates, ["ਸਤਿ ", "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ"]);
    assert.equal(typeof result.elapsedMs, "number");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports invalid models returned by Ollama", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: "model 'missing' not found" }, { status: 400 });
  try {
    await assert.rejects(
      generateDirectOllama({
        baseUrl: "http://ollama.test:11434",
        model: "missing",
        prompt: "hello",
        onChunk() {},
      }),
      /Select a model returned by \/api\/tags/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
