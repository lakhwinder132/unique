import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type ActivityEntry = {
  id: string;
  at: string;
  visitorId: string;
  request: string;
  region: { name: string; country: string; latitude: number; longitude: number } | null;
};

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LOG_BYTES = 20 * 1024 * 1024;
const DEFAULT_LOG_DIR = process.env.NODE_ENV === "production"
  ? "/var/lib/ollama-farmer/activity"
  : join(process.cwd(), "data", "activity");
const LOG_FILE = join(process.env.ACTIVITY_LOG_DIR || DEFAULT_LOG_DIR, "activity.jsonl");
let writeQueue: Promise<void> = Promise.resolve();
let lastPrunedAt = 0;

function isEntry(value: unknown): value is ActivityEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<ActivityEntry>;
  return typeof entry.id === "string" && typeof entry.at === "string"
    && typeof entry.visitorId === "string" && typeof entry.request === "string";
}

async function existingEntries() {
  try {
    const content = await readFile(LOG_FILE, "utf8");
    return content.split("\n").flatMap((line) => {
      if (!line) return [];
      try {
        const value: unknown = JSON.parse(line);
        return isEntry(value) ? [value] : [];
      } catch {
        return [];
      }
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

export async function storeActivity(entry: ActivityEntry) {
  const operation = async () => {
    await mkdir(dirname(LOG_FILE), { recursive: true, mode: 0o700 });
    const now = Date.now();
    let entries: ActivityEntry[] | null = null;
    if (now - lastPrunedAt >= 6 * 60 * 60 * 1000) {
      entries = (await existingEntries()).filter((item) => Date.parse(item.at) >= now - RETENTION_MS);
      await writeFile(LOG_FILE, entries.map((item) => JSON.stringify(item)).join("\n") + (entries.length ? "\n" : ""), { mode: 0o600 });
      lastPrunedAt = now;
    }
    try {
      if ((await stat(LOG_FILE)).size >= MAX_LOG_BYTES) {
        await writeFile(LOG_FILE, "", { mode: 0o600 });
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, { encoding: "utf8", mode: 0o600 });
  };
  const task = writeQueue.then(operation, operation);
  writeQueue = task.then(() => undefined, () => undefined);
  await task;
}

export async function getRecentActivity(limit = 200) {
  const entries = await existingEntries();
  const cutoff = Date.now() - RETENTION_MS;
  return entries.filter((entry) => Date.parse(entry.at) >= cutoff).slice(-limit).reverse();
}
