import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";

const DATA_ROOT = "D:\\Users\\Course_Code\\data\\punjabi-farmer-data";
const PYTHON_PATH = path.join(DATA_ROOT, ".venv", "Scripts", "python.exe");
const RAG_SCRIPT_DIR = path.join(DATA_ROOT, "scripts");
const RAG_TOP_K = Number(process.env.RAG_TOP_K ?? "5");
const REQUEST_TIMEOUT_MS = 180000;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export type RagPayload = {
  system: string;
  user_prompt: string;
  results?: Array<Record<string, unknown>>;
};

type WorkerReply = {
  type?: unknown;
  id?: unknown;
  payload?: unknown;
  error?: unknown;
};

type PendingRequest = {
  resolve: (payload: RagPayload) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  signal?: AbortSignal;
  abortHandler?: () => void;
};

type QueuedRequest = {
  id: string;
  question: string;
  answerLanguage: string;
};

const workerSource = `
import json
import sys
from contextlib import redirect_stdout

sys.path.insert(0, r"${RAG_SCRIPT_DIR.replace(/\\/g, "\\\\")}")
with redirect_stdout(sys.stderr):
    from rag_retriever import RagRetriever
    from rag_prompt_builder import build_rag_prompt
    retriever = RagRetriever()

print(json.dumps({"type": "ready"}), flush=True)
for line in sys.stdin:
    try:
        request = json.loads(line)
        with redirect_stdout(sys.stderr):
            results = retriever.retrieve(request["question"], top_k=${RAG_TOP_K})
            payload = build_rag_prompt(request["question"], results, request["language"])
            payload["results"] = results
        print(json.dumps({"id": request["id"], "payload": payload}, ensure_ascii=False), flush=True)
    except Exception as error:
        print(json.dumps({"id": request.get("id"), "error": str(error)}, ensure_ascii=False), flush=True)
`;

class RagWorker {
  private child: ChildProcessWithoutNullStreams | null = null;
  private ready = false;
  private outputBuffer = "";
  private queue: QueuedRequest[] = [];
  private pending = new Map<string, PendingRequest>();
  private idleTimer: NodeJS.Timeout | null = null;

  request(question: string, answerLanguage: string, signal?: AbortSignal) {
    return new Promise<RagPayload>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException("RAG request was cancelled.", "AbortError"));
        return;
      }

      const id = randomUUID();
      const timeout = setTimeout(() => {
        this.removePending(id);
        reject(new Error("RAG retrieval timed out."));
      }, REQUEST_TIMEOUT_MS);
      const pending: PendingRequest = { resolve, reject, timeout, signal };
      if (signal) {
        pending.abortHandler = () => {
          this.removePending(id);
          reject(new DOMException("RAG request was cancelled.", "AbortError"));
        };
        signal.addEventListener("abort", pending.abortHandler, { once: true });
      }
      this.pending.set(id, pending);
      this.queue.push({ id, question, answerLanguage });
      this.clearIdleTimer();
      try {
        this.start();
        this.flushQueue();
      } catch (error) {
        this.removePending(id);
        reject(error instanceof Error ? error : new Error("Could not start the RAG worker."));
      }
    });
  }

  private start() {
    if (this.child) return;
    const child = spawn(PYTHON_PATH, ["-u", "-c", workerSource], {
      cwd: DATA_ROOT,
      stdio: "pipe",
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        HF_HOME: path.join(DATA_ROOT, ".runtime_deps", "huggingface_cache"),
        SENTENCE_TRANSFORMERS_HOME: path.join(DATA_ROOT, ".runtime_deps", "huggingface_cache"),
        HF_HUB_DISABLE_TELEMETRY: "1",
        TOKENIZERS_PARALLELISM: "false",
      },
    });
    this.child = child;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.readOutput(chunk));
    child.stderr.on("data", (chunk: string) => {
      const detail = chunk.trim();
      if (detail) console.warn("[rag-worker] Python:", detail.slice(0, 1000));
    });
    child.on("error", (error) => this.fail(child, new Error(`Could not start the RAG worker: ${error.message}`)));
    child.on("exit", (code, signal) => {
      if (this.child !== child) return;
      this.fail(child, new Error(`RAG worker exited unexpectedly (code ${code ?? "unknown"}, signal ${signal ?? "none"}).`));
    });
    process.once("exit", () => {
      if (this.child === child) child.kill();
    });
  }

  private readOutput(chunk: string) {
    this.outputBuffer += chunk;
    const lines = this.outputBuffer.split("\n");
    this.outputBuffer = lines.pop() ?? "";
    for (const line of lines) this.processLine(line);
  }

  private processLine(line: string) {
    if (!line.trim()) return;
    let reply: WorkerReply;
    try {
      reply = JSON.parse(line) as WorkerReply;
    } catch (error) {
      console.error("[rag-worker] Invalid worker output:", error);
      this.fail(this.child, new Error("The RAG worker returned invalid output."));
      return;
    }

    if (reply.type === "ready") {
      this.ready = true;
      console.info("[rag-worker] Retriever ready.");
      this.flushQueue();
      if (this.pending.size === 0 && this.queue.length === 0) this.scheduleIdleShutdown();
      return;
    }
    if (typeof reply.id !== "string") {
      this.fail(this.child, new Error("The RAG worker returned an invalid response."));
      return;
    }

    const pending = this.pending.get(reply.id);
    if (!pending) return;
    this.removePending(reply.id);
    if (typeof reply.error === "string") {
      pending.reject(new Error(reply.error));
      return;
    }
    const payload = reply.payload;
    if (
      !payload ||
      typeof payload !== "object" ||
      !("system" in payload) ||
      typeof payload.system !== "string" ||
      !("user_prompt" in payload) ||
      typeof payload.user_prompt !== "string" ||
      ("results" in payload && !Array.isArray(payload.results))
    ) {
      pending.reject(new Error("RAG returned an invalid retrieval result."));
      return;
    }
    const result: RagPayload = {
      system: payload.system,
      user_prompt: payload.user_prompt,
      results: "results" in payload && Array.isArray(payload.results)
        ? payload.results.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
        : undefined,
    };
    pending.resolve(result);
  }

  private flushQueue() {
    if (!this.ready || !this.child || this.child.stdin.destroyed) return;
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request || !this.pending.has(request.id)) continue;
      const writable = this.child.stdin.write(`${JSON.stringify({
        id: request.id,
        question: request.question,
        language: request.answerLanguage,
      })}\n`);
      if (!writable) {
        this.child.stdin.once("drain", () => this.flushQueue());
        return;
      }
    }
  }

  private removePending(id: string) {
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    if (pending.signal && pending.abortHandler) {
      pending.signal.removeEventListener("abort", pending.abortHandler);
    }
    this.pending.delete(id);
    this.queue = this.queue.filter((request) => request.id !== id);
    if (this.pending.size === 0 && this.queue.length === 0 && this.ready) this.scheduleIdleShutdown();
  }

  private scheduleIdleShutdown() {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (this.pending.size > 0 || this.queue.length > 0 || !this.child) return;
      this.child.kill();
      this.child = null;
      this.ready = false;
      this.outputBuffer = "";
      console.info("[rag-worker] Stopped after 30 minutes idle.");
    }, IDLE_TIMEOUT_MS);
    this.idleTimer.unref();
  }

  private clearIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private fail(child: ChildProcessWithoutNullStreams | null, error: Error) {
    if (child && this.child !== child) return;
    const currentChild = this.child;
    this.child = null;
    this.ready = false;
    this.outputBuffer = "";
    this.queue = [];
    this.clearIdleTimer();
    if (currentChild && !currentChild.killed) currentChild.kill();
    for (const [id, pending] of this.pending) {
      this.removePending(id);
      pending.reject(error);
    }
  }
}

declare global {
  var __kisanRagWorker: RagWorker | undefined;
}

const worker = globalThis.__kisanRagWorker ?? (globalThis.__kisanRagWorker = new RagWorker());

export function retrieveRagContext(question: string, answerLanguage: string, signal?: AbortSignal) {
  return worker.request(question, answerLanguage, signal);
}
