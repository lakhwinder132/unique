import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { NewsCategory } from "../../services/news-types";
export type { NewsCategory } from "../../services/news-types";

export type NewsItem = {
  id: string;
  sourceId: string;
  title: string;
  url: string;
  publisher: string;
  publisherDomain: string;
  publishedAt: string | null;
  summary: string | null;
  imageUrl: null;
  category: NewsCategory;
  language: "pa" | "hi" | "en" | "unknown";
  relevance: "Punjab" | "Punjab-relevant" | "India";
  retrievedAt: string;
  official: boolean;
};

export type NewsSourceStatus = {
  id: string;
  name: string;
  itemCount: number;
  error?: string;
};

export type NewsFeed = {
  items: NewsItem[];
  lastUpdatedAt: string;
  stale: boolean;
  refreshDeferred: boolean;
  sources: NewsSourceStatus[];
};

export type NewsSource = {
  id: string;
  name: string;
  feedUrl: string;
  domain: string;
  official: boolean;
};

type CachedFeed = Omit<NewsFeed, "refreshDeferred"> & {
  fetchedAt: number;
};

const SOURCES: NewsSource[] = [
  {
    id: "icar",
    name: "ICAR",
    feedUrl: "https://icar.org.in/en/rss.xml",
    domain: "icar.org.in",
    official: true,
  },
];

const CACHE_TTL_MS = 20 * 60 * 1000;
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;
const MAX_STALE_MS = 24 * 60 * 60 * 1000;
const SOURCE_TIMEOUT_MS = 10_000;
const MAX_FEED_BYTES = 1_000_000;
const MAX_ITEMS = 40;
const MAX_AGE_DAYS = 120;

const agriculturePattern = /agri|farm|crop|soil|seed|irrigat|fertili|pest|disease|harvest|sow|wheat|rice|paddy|maize|cotton|mustard|millet|horticultur|livestock|dairy|train(?:ing)?|कृषि|खेती|फसल|किसान|बीज|मिट्टी|सिंचाई|खाद|कीट|रोग|प्रशिक्षण|गेहूं|धान|चावल|मक्का|कपास|সরষ|ਖੇਤੀ|ਕਿਸਾਨ|ਫ਼ਸਲ|ਫਸਲ|ਬੀਜ|ਮਿੱਟੀ|ਸਿੰਚਾਈ|ਖਾਦ|ਕੀਟ|ਰੋਗ|ਸਿਖਲਾਈ|ਕਣਕ|ਝੋਨਾ|ਮੱਕੀ|ਕਪਾਹ|ਸਰ੍ਹੋਂ/i;
const punjabPattern = /\bpunjab\b|ਪੰਜਾਬ|पंजाब|ludhiana|bathinda|amritsar|patiala|moga|kapurthala|hoshiarpur|gurdaspur/i;
const punjabCropPattern = /\bwheat\b|\bpaddy\b|\brice\b|\bcotton\b|\bmustard\b|\bmaize\b|\bkinnow\b|\bpotato\b|ਕਣਕ|ਝੋਨਾ|ਕਪਾਹ|ਸਰ੍ਹੋਂ|ਮੱਕੀ|ਆਲੂ|ਕਿੰਨੂ|गेहूं|धान|कपास|सरसों|मक्का|आलू/i;
const categoryRules: Array<[NewsCategory, RegExp]> = [
  ["weather", /weather|\brain\b|rainfall|flood|heatwave|temperature|मौसम|बारिश|बाढ़|ਮੀਂਹ|ਹੜ੍ਹ/i],
  ["market", /mandi|procurement|minimum support price|\bmsp\b|market price|procure|मंडी|खरीद|एमएसपी/i],
  ["government", /scheme|subsid|government|policy|minister|yojana|योजना|सरकार|सब्सिडी/i],
  ["protection", /pest|disease|blight|fung|virus|insect|कीट|रोग|फफूंद|ਕੀਟ|ਬਿਮਾਰੀ/i],
  ["training", /train(?:ing)?|course|calendar|प्रशिक्षण|पाठ्यक्रम|ਸਿਖਲਾਈ|ਕੋਰਸ/i],
  ["advisory", /advisory|recommend|guideline|alert|सिफारिश|सलाह|अलर्ट|ਸਲਾਹ|ਚੇਤਾਵਨੀ/i],
  ["stories", /farmer story|success story|farmer achieves|किसान की सफलता|ਸਫਲ ਕਿਸਾਨ/i],
];

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  trimValues: true,
  processEntities: true,
  cdataPropName: "#cdata",
});

function asText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(asText).join(" ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(record["#text"] ?? record["#cdata"] ?? "");
  }
  return "";
}

export function validateArticleUrl(value: string, allowedDomain: string): URL | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (hostname !== allowedDomain && !hostname.endsWith(`.${allowedDomain}`))
    ) return null;

    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    return url;
  } catch {
    return null;
  }
}

function getLanguage(title: string): NewsItem["language"] {
  if (/[\u0a00-\u0a7f]/u.test(title)) return "pa";
  if (/[\u0900-\u097f]/u.test(title)) return "hi";
  if (/[a-z]/i.test(title)) return "en";
  return "unknown";
}

export function classifyNewsCategory(text: string): NewsCategory {
  return categoryRules.find(([, pattern]) => pattern.test(text))?.[0] ?? "research";
}

function normalizeItem(
  raw: Record<string, unknown>,
  source: Pick<NewsSource, "id" | "name" | "domain" | "official">,
  retrievedAt: string,
): NewsItem | null {
  const title = asText(raw.title).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  const link = validateArticleUrl(asText(raw.link), source.domain);
  if (!title || !link || !agriculturePattern.test(title)) return null;

  const publishedMs = Date.parse(asText(raw.pubDate));
  const publishedAt = Number.isFinite(publishedMs) ? new Date(publishedMs).toISOString() : null;
  if (publishedMs > Date.now() + 24 * 60 * 60 * 1000) return null;
  if (publishedAt && Date.now() - publishedMs > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) return null;
  const relevance: NewsItem["relevance"] = punjabPattern.test(title)
    ? "Punjab"
    : punjabCropPattern.test(title)
      ? "Punjab-relevant"
      : "India";

  return {
    id: createHash("sha256").update(link.href).digest("hex").slice(0, 20),
    sourceId: source.id,
    title,
    url: link.href,
    publisher: source.name,
    publisherDomain: source.domain,
    publishedAt,
    summary: null,
    imageUrl: null,
    category: classifyNewsCategory(title),
    language: getLanguage(title),
    relevance,
    retrievedAt,
    official: source.official,
  };
}

export function parseRssFeed(
  xml: string,
  source: Pick<NewsSource, "id" | "name" | "domain" | "official">,
  retrievedAt = new Date().toISOString(),
): NewsItem[] {
  if (!xml.trim() || XMLValidator.validate(xml) !== true) {
    throw new Error(`${source.name} returned malformed RSS XML.`);
  }
  const document: unknown = parser.parse(xml);
  if (!document || typeof document !== "object" || !("rss" in document)) {
    throw new Error(`${source.name} returned an unsupported RSS document.`);
  }
  const rss = document.rss;
  if (!rss || typeof rss !== "object" || !("channel" in rss)) {
    throw new Error(`${source.name} RSS document has no channel.`);
  }
  const channel = rss.channel;
  if (!channel || typeof channel !== "object" || !("item" in channel)) return [];
  const entries = Array.isArray(channel.item) ? channel.item : [channel.item];
  return entries
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry) => normalizeItem(entry, source, retrievedAt))
    .filter((item): item is NewsItem => item !== null);
}

function titleSimilarity(left: string, right: string) {
  const words = (text: string) => new Set(text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  const a = words(left);
  const b = words(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / (a.size + b.size - intersection);
}

export function deduplicateNews(items: NewsItem[]): NewsItem[] {
  const seenUrls = new Set<string>();
  const unique: NewsItem[] = [];
  for (const item of items) {
    if (seenUrls.has(item.url)) continue;
    if (unique.some((existing) => titleSimilarity(existing.title, item.title) >= 0.82)) continue;
    seenUrls.add(item.url);
    unique.push(item);
  }
  return unique;
}

export function rankNewsItems(items: NewsItem[]) {
  const now = Date.now();
  return deduplicateNews(items).sort((left, right) => {
    const freshness = (item: NewsItem) => item.publishedAt
      ? Math.max(0, Math.min(1, 1 - (now - Date.parse(item.publishedAt)) / (MAX_AGE_DAYS * 86400000)))
      : 0;
    const relevanceBoost = (item: NewsItem) =>
      item.relevance === "Punjab" ? 2 : item.relevance === "Punjab-relevant" ? 1 : 0;
    const officialBoost = (item: NewsItem) => item.official ? 0.5 : 0;
    const freshnessBoost = (item: NewsItem) => freshness(item) * 0.5;
    return (
      relevanceBoost(right) + officialBoost(right) + freshnessBoost(right) -
      relevanceBoost(left) - officialBoost(left) - freshnessBoost(left)
    );
  }).slice(0, MAX_ITEMS);
}

async function readLimitedText(response: Response) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_FEED_BYTES) {
    throw new Error("RSS feed exceeded the allowed size.");
  }
  if (!response.body) throw new Error("RSS source returned an empty response.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_FEED_BYTES) throw new Error("RSS feed exceeded the allowed size.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(merged);
}

async function fetchSource(source: NewsSource): Promise<NewsItem[]> {
  const response = await fetch(source.feedUrl, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    cache: "no-store",
    signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
  const xml = await readLimitedText(response);
  return parseRssFeed(xml, source);
}

export function createNewsFeedCache(
  sources: NewsSource[],
  fetchItems: (source: NewsSource) => Promise<NewsItem[]>,
  now: () => number = Date.now,
) {
  let cache: CachedFeed | null = null;
  let refreshPromise: Promise<CachedFeed> | null = null;
  let lastRefreshAttemptAt = 0;

  const refresh = async (): Promise<CachedFeed> => {
    const settled = await Promise.all(sources.map(async (source) => {
      try {
        return { source, items: await fetchItems(source) };
      } catch (error) {
        return {
          source,
          items: null,
          error: error instanceof Error ? error.message : "Source request failed.",
        };
      }
    }));
    const completedAt = new Date(now()).toISOString();
    const successfulSources = new Set(settled.filter((result) => result.items !== null).map(({ source }) => source.id));
    const failures = settled.filter((result) => result.items === null);
    const freshItems = settled.flatMap((result) => result.items ?? []);

    if (successfulSources.size === 0) {
      if (cache && now() - cache.fetchedAt <= MAX_STALE_MS) {
        cache = {
          ...cache,
          stale: true,
          sources: settled.map(({ source, error }) => ({
            id: source.id,
            name: source.name,
            itemCount: cache?.items.filter((item) => item.sourceId === source.id).length ?? 0,
            ...(error ? { error } : {}),
          })),
        };
        return cache;
      }
      cache = null;
      throw new Error(failures.map(({ source, error }) => `${source.name}: ${error}`).join(" "));
    }

    const retainedCachedItems = cache?.items.filter((item) => !successfulSources.has(item.sourceId)) ?? [];
    const items = rankNewsItems([...freshItems, ...retainedCachedItems]);
    const sourcesStatus = settled.map(({ source, items: sourceItems, error }) => ({
      id: source.id,
      name: source.name,
      itemCount: sourceItems?.length ?? cache?.items.filter((item) => item.sourceId === source.id).length ?? 0,
      ...(error ? { error } : {}),
    }));
    cache = {
      items,
      lastUpdatedAt: completedAt,
      stale: failures.length > 0,
      sources: sourcesStatus,
      fetchedAt: now(),
    };
    return cache;
  };

  return {
    async getNewsFeed(forceRefresh = false): Promise<NewsFeed> {
      const currentTime = now();
      if (cache && !forceRefresh && currentTime - cache.fetchedAt < CACHE_TTL_MS) {
        return { ...cache, refreshDeferred: false };
      }
      if (refreshPromise) {
        return { ...await refreshPromise, refreshDeferred: false };
      }
      if (lastRefreshAttemptAt > 0 && currentTime - lastRefreshAttemptAt < MIN_REFRESH_INTERVAL_MS) {
        if (cache && currentTime - cache.fetchedAt <= MAX_STALE_MS) {
          return { ...cache, stale: currentTime - cache.fetchedAt >= CACHE_TTL_MS, refreshDeferred: true };
        }
        cache = null;
        throw new Error("News sources were checked recently. Wait a minute before retrying.");
      }
      lastRefreshAttemptAt = currentTime;
      refreshPromise = refresh().finally(() => { refreshPromise = null; });
      const updated = await refreshPromise;
      return { ...updated, refreshDeferred: false };
    },
  };
}

const newsCache = createNewsFeedCache(SOURCES, fetchSource);

export function getNewsFeed(forceRefresh = false) {
  return newsCache.getNewsFeed(forceRefresh);
}
