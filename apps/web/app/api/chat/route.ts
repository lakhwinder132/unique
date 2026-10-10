import { execFileSync } from "node:child_process";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://ai.shelly22.online";
const RAG_TOP_K = Number(process.env.RAG_TOP_K ?? "5");
const RAG_DEBUG = (process.env.RAG_DEBUG ?? "false").toLowerCase() === "true";
const DATA_ROOT = "D:\\Users\\Course_Code\\data\\punjabi-farmer-data";
const PYTHON_PATH = path.join(DATA_ROOT, ".venv", "Scripts", "python.exe");
const RAG_SCRIPT_DIR = path.join(DATA_ROOT, "scripts");

const SYSTEM_PROMPT = `You are a Punjabi Farmer AI Assistant for farmers in Punjab, India.

- Understand Gurmukhi Punjabi, conversational Punjabi, rural Punjabi, and Punjabi-English mixed language.
- If the user speaks Punjabi, respond naturally in Punjabi.
- If the user speaks English or Hindi, respond in that language.
- Use simple, practical language that farmers can easily understand.
- Help with crops, soil, irrigation, fertilizers, pests, diseases, livestock, machinery, and farming practices.
- Ask useful follow-up questions when important information is missing.
- Never invent agricultural facts, current prices, weather, government schemes, chemical dosages, or other dynamic information.
- Understand and respect Punjabi rural culture, traditions, festivals, food, history, folk traditions, and farming culture.
- Do not use forced Punjabi expressions just to appear culturally authentic.
- Clearly distinguish traditional/cultural knowledge from scientific agricultural advice.
- Be especially careful with pesticides, herbicides, fertilizers, veterinary medicines, and other potentially harmful advice.
- Never invent chemical dosages or treatment instructions.
- Be respectful, natural, concise, and farmer-friendly.
- Do not pretend to know something you do not know.`;

function detectAnswerLanguage(question: string) {
  if (/[\u0A00-\u0A7F]/.test(question)) {
    return "Punjabi";
  }
  if (/[\u0900-\u097F]/.test(question)) {
    return "Hindi";
  }
  return "English";
}

function isSystemMessage(message: unknown): message is { role: string } {
  return Boolean(
    message &&
      typeof message === "object" &&
      "role" in message &&
      typeof (message as { role?: unknown }).role === "string" &&
      (message as { role: string }).role === "system",
  );
}

function findLastUserMessage(messages: Array<Record<string, unknown>>) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message && typeof message.role === "string" && message.role === "user") {
      return { index, message };
    }
  }

  return null;
}

function retrieveRagContext(question: string) {
  const answerLanguage = detectAnswerLanguage(question);
  const script = `
import json
import sys

sys.path.insert(0, r"${RAG_SCRIPT_DIR.replace(/\\/g, "\\\\")}")
from rag_retriever import RagRetriever
from rag_prompt_builder import build_rag_prompt

question = sys.argv[1]
language = sys.argv[2]
retriever = RagRetriever()
results = retriever.retrieve(question, top_k=${RAG_TOP_K})
payload = build_rag_prompt(question, results, language)
payload["results"] = results
print(json.dumps(payload))
`;

  const output = execFileSync(PYTHON_PATH, ["-c", script, question, answerLanguage], {
    cwd: DATA_ROOT,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      HF_HOME: path.join(DATA_ROOT, ".runtime_deps", "huggingface_cache"),
      SENTENCE_TRANSFORMERS_HOME: path.join(DATA_ROOT, ".runtime_deps", "huggingface_cache"),
      HF_HUB_DISABLE_TELEMETRY: "1",
      TOKENIZERS_PARALLELISM: "false",
    },
  });

  return JSON.parse(output) as {
    system: string;
    context: string;
    question: string;
    user_prompt: string;
    results?: Array<Record<string, unknown>>;
  };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  try {
    const chatRequest = body as Record<string, unknown>;
    const messages = Array.isArray(chatRequest.messages)
      ? chatRequest.messages.filter((message) => !isSystemMessage(message))
      : [];

    let finalMessages = messages as Array<Record<string, unknown>>;
    const lastUserMessage = findLastUserMessage(finalMessages);

    if (lastUserMessage && typeof lastUserMessage.message.content === "string") {
      const question = lastUserMessage.message.content.trim();
      if (question) {
        const ragPayload = retrieveRagContext(question);
        if (RAG_DEBUG) {
          console.log("[RAG_DEBUG] question:", question);
          console.log("[RAG_DEBUG] retrieved_count:", ragPayload.results?.length ?? 0);
          console.log("[RAG_DEBUG] chunk_ids:", ragPayload.results?.map((result) => result.chunk_id) ?? []);
          console.log("[RAG_DEBUG] scores:", ragPayload.results?.map((result) => result.score) ?? []);
        }

        finalMessages = [...finalMessages];
        finalMessages[lastUserMessage.index] = {
          ...lastUserMessage.message,
          content: ragPayload.user_prompt,
        };
        finalMessages = [
          { role: "system", content: `${SYSTEM_PROMPT}\n\n${ragPayload.system}` },
          ...finalMessages,
        ];
      }
    }

    const upstream = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...chatRequest,
        messages: finalMessages.length > 0 ? finalMessages : [{ role: "system", content: SYSTEM_PROMPT }],
      }),
      cache: "no-store",
      signal: request.signal,
    });

    if (!upstream.ok) {
      console.error(`Ollama upstream returned HTTP ${upstream.status}.`);
      return NextResponse.json(
        { error: `The assistant backend returned HTTP ${upstream.status}. Check that Ollama is available at the configured server address.` },
        { status: 502 },
      );
    }
    if (!upstream.body) {
      return NextResponse.json({ error: "The assistant returned no response." }, { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/x-ndjson",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Ollama proxy connection failed:", error);
    return NextResponse.json(
      { error: "Could not connect to the Ollama backend. Check the configured server address and network access." },
      { status: 502 },
    );
  }
}