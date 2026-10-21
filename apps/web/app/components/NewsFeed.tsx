"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  Bug,
  CloudSun,
  Landmark,
  Microscope,
  RefreshCw,
  Sprout,
  Wheat,
} from "lucide-react";
import type { NewsCategory, NewsFeed as NewsFeedData, NewsItem } from "../api/news/news-service";
import { filterNewsItems, type NewsCategoryFilter } from "../services/news-types";
import "./news.css";

type NewsFeedProps = {
  language: "pa" | "hi" | "en";
};

const copy = {
  pa: {
    title: "ਖੇਤੀ ਦੀਆਂ ਖ਼ਬਰਾਂ",
    subtitle: "ਅਧਿਕਾਰਤ ਖੇਤੀਬਾੜੀ ਅਪਡੇਟ ਅਤੇ ਖੋਜ",
    pau: "PAU ਹਫ਼ਤਾਵਾਰੀ ਸਲਾਹ",
    refresh: "ਤਾਜ਼ਾ ਕਰੋ",
    loading: "ਖੇਤੀ ਦੀਆਂ ਅਪਡੇਟ ਲਿਆ ਰਹੇ ਹਾਂ…",
    empty: "ਇਸ ਵੇਲੇ ਕੋਈ ਤਾਜ਼ਾ ਖੇਤੀ ਅਪਡੇਟ ਨਹੀਂ ਮਿਲੀ।",
    error: "ਖ਼ਬਰਾਂ ਇਸ ਵੇਲੇ ਉਪਲਬਧ ਨਹੀਂ ਹਨ।",
    retry: "ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ",
    updated: "ਆਖ਼ਰੀ ਅਪਡੇਟ",
    stale: "ਸਰੋਤ ਨਾਲ ਸੰਪਰਕ ਨਹੀਂ ਹੋ ਸਕਿਆ। ਹੇਠਾਂ ਕੈਸ਼ ਕੀਤੀਆਂ ਖ਼ਬਰਾਂ ਹਨ।",
    deferred: "ਹਾਲ ਹੀ ਵਿੱਚ ਤਾਜ਼ਾ ਕੀਤਾ ਗਿਆ ਸੀ; ਮੌਜੂਦਾ ਕੈਸ਼ ਦਿਖਾਇਆ ਜਾ ਰਿਹਾ ਹੈ।",
    all: "ਸਭ",
    open: "ਮੂਲ ਸਰੋਤ ਪੜ੍ਹੋ",
    explain: "AI ਨਾਲ ਸਮਝੋ",
    official: "ਅਧਿਕਾਰਤ ਸਰੋਤ",
    punjab: "ਪੰਜਾਬ",
    punjabRelevant: "ਪੰਜਾਬੀ ਫ਼ਸਲਾਂ ਨਾਲ ਸਬੰਧਤ",
    india: "ਭਾਰਤ",
    noDate: "ਤਾਰੀਖ਼ ਨਹੀਂ ਦਿੱਤੀ",
    excerpt: "ਸਰੋਤ ਤੋਂ ਛੋਟਾ ਅੰਸ਼",
    details: "ਪੂਰੀ ਜਾਣਕਾਰੀ ਲਈ ਮੂਲ ਸਰੋਤ ਖੋਲ੍ਹੋ।",
    categories: {
      advisory: "ਸਲਾਹ",
      weather: "ਮੌਸਮ ਅਤੇ ਅਲਰਟ",
      market: "ਮੰਡੀ ਅਤੇ ਖਰੀਦ",
      government: "ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ",
      protection: "ਕੀੜੇ ਅਤੇ ਬਿਮਾਰੀਆਂ",
      training: "ਸਿਖਲਾਈ",
      research: "ਖੇਤੀ ਖੋਜ",
      stories: "ਕਿਸਾਨਾਂ ਦੀਆਂ ਕਹਾਣੀਆਂ",
    },
    sourceNote: "ਸਿਰਲੇਖ ਮੂਲ ਸਰੋਤ ਦੀ ਭਾਸ਼ਾ ਵਿੱਚ ਹਨ। ‘AI ਨਾਲ ਸਮਝੋ’ ਨਾਲ ਆਪਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਵਿਆਖਿਆ ਮੰਗੋ।",
  },
  hi: {
    title: "खेती की खबरें",
    subtitle: "आधिकारिक कृषि अपडेट और शोध",
    pau: "PAU साप्ताहिक सलाह",
    refresh: "ताज़ा करें",
    loading: "कृषि अपडेट ला रहे हैं…",
    empty: "अभी कोई नई कृषि अपडेट नहीं मिली।",
    error: "खबरें अभी उपलब्ध नहीं हैं।",
    retry: "फिर कोशिश करें",
    updated: "आखिरी अपडेट",
    stale: "स्रोत से संपर्क नहीं हो सका। नीचे कैश की गई खबरें हैं।",
    deferred: "हाल में अपडेट किया गया था; मौजूदा कैश दिखाया जा रहा है।",
    all: "सभी",
    open: "मूल स्रोत पढ़ें",
    explain: "AI से समझें",
    official: "आधिकारिक स्रोत",
    punjab: "पंजाब",
    punjabRelevant: "पंजाब की फसलों से संबंधित",
    india: "भारत",
    noDate: "तारीख उपलब्ध नहीं",
    excerpt: "स्रोत से संक्षिप्त अंश",
    details: "पूरी जानकारी के लिए मूल स्रोत खोलें।",
    categories: {
      advisory: "सलाह",
      weather: "मौसम और चेतावनी",
      market: "मंडी और खरीद",
      government: "सरकारी योजनाएँ",
      protection: "कीट और रोग",
      training: "प्रशिक्षण",
      research: "कृषि शोध",
      stories: "किसानों की कहानियाँ",
    },
    sourceNote: "शीर्षक मूल स्रोत की भाषा में हैं। ‘AI से समझें’ से अपनी भाषा में व्याख्या माँगें।",
  },
  en: {
    title: "Agriculture updates",
    subtitle: "Official agricultural updates and research",
    pau: "PAU weekly advisory",
    refresh: "Refresh",
    loading: "Loading agricultural updates…",
    empty: "No recent agricultural updates were found.",
    error: "News is temporarily unavailable.",
    retry: "Try again",
    updated: "Last updated",
    stale: "A source could not be reached. Showing cached updates below.",
    deferred: "Feeds were refreshed recently; showing the current cache.",
    all: "All",
    open: "Read original source",
    explain: "Explain with AI",
    official: "Official source",
    punjab: "Punjab",
    punjabRelevant: "Relevant to Punjab crops",
    india: "India",
    noDate: "Date not provided",
    excerpt: "Short source excerpt",
    details: "Open the original source for the full update.",
    categories: {
      advisory: "Advisories",
      weather: "Weather & alerts",
      market: "Markets & procurement",
      government: "Government",
      protection: "Pests & diseases",
      training: "Training",
      research: "Research",
      stories: "Farmer stories",
    },
    sourceNote: "Headlines stay in the source language. Use “Explain with AI” to ask for an explanation in your selected language.",
  },
} as const;

const categories: NewsCategory[] = [
  "advisory",
  "weather",
  "market",
  "government",
  "protection",
  "training",
  "research",
  "stories",
];
type NewsCopy = {
  title: string;
  subtitle: string;
  pau: string;
  refresh: string;
  loading: string;
  empty: string;
  error: string;
  retry: string;
  updated: string;
  stale: string;
  deferred: string;
  all: string;
  open: string;
  explain: string;
  official: string;
  punjab: string;
  punjabRelevant: string;
  india: string;
  noDate: string;
  details: string;
  categories: Record<NewsCategory, string>;
  sourceNote: string;
};

const localizedCopy: Record<NewsFeedProps["language"], NewsCopy> = copy;
const categoryIcons = {
  advisory: Sprout,
  weather: CloudSun,
  market: Wheat,
  government: Landmark,
  protection: Bug,
  training: BookOpenText,
  research: Microscope,
  stories: BookOpenText,
} satisfies Record<NewsCategory, typeof Sprout>;

function localizedDate(value: string | null, language: NewsFeedProps["language"], noDate: string) {
  if (!value) return noDate;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return noDate;
  return new Intl.DateTimeFormat(language === "pa" ? "pa-IN" : language === "hi" ? "hi-IN" : "en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function explainUrl(item: NewsItem, language: NewsFeedProps["language"], categoryLabel: string) {
  const responseLanguage = language === "pa" ? "simple Punjabi" : language === "hi" ? "simple Hindi" : "English";
  const prompt = [
    `Explain this ${categoryLabel.toLowerCase()} update in ${responseLanguage}.`,
    "Only the headline, publisher, and source link are provided. Do not imply that you have read the article. Separate the reported headline from your interpretation, and say if the headline alone is insufficient. Do not assume it applies to the user's farm or invent eligibility, deadlines, prices, or farming advice.",
    `Headline: ${item.title}`,
    `Publisher: ${item.publisher}`,
    item.summary ? `Short source excerpt (original language): ${item.summary}` : "",
    `Original source: ${item.url}`,
  ].filter(Boolean).join("\n");
  return `/?explain=${encodeURIComponent(prompt)}`;
}

function NewsCard({
  item,
  language,
  strings,
  featured = false,
}: {
  item: NewsItem;
  language: NewsFeedProps["language"];
  strings: NewsCopy;
  featured?: boolean;
}) {
  const Icon = categoryIcons[item.category] ?? Sprout;
  const categoryLabel = strings.categories[item.category];
  return (
    <article className={`news-card${featured ? " is-featured" : ""}`}>
      <div className={`news-card-art category-${item.category}`} aria-hidden="true">
        <Icon size={featured ? 30 : 23} strokeWidth={1.7} />
        <span>{categoryLabel}</span>
      </div>
      <div className="news-card-content">
        <div className="news-card-meta">
          <span>{item.publisher}</span>
          {item.official && <span className="news-official">{strings.official}</span>}
          <span className="news-region">
            {item.relevance === "Punjab"
              ? strings.punjab
              : item.relevance === "Punjab-relevant"
                ? strings.punjabRelevant
                : strings.india}
          </span>
        </div>
        <h3 lang={item.language === "unknown" ? undefined : item.language}>{item.title}</h3>
        {item.summary && <p className="news-summary">{item.summary}</p>}
        {!item.summary && <p className="news-summary">{strings.details}</p>}
        <div className="news-card-footer">
          <time dateTime={item.publishedAt ?? undefined}>
            {localizedDate(item.publishedAt, language, strings.noDate)}
          </time>
          <div className="news-card-actions">
            <a href={item.url} target="_blank" rel="noopener noreferrer">{strings.open}</a>
            <Link href={explainUrl(item, language, categoryLabel)}>{strings.explain}</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function NewsFeed({ language }: NewsFeedProps) {
  const strings = localizedCopy[language];
  const [feed, setFeed] = useState<NewsFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState<NewsCategoryFilter>("all");
  const [visibleCount, setVisibleCount] = useState(8);

  const loadFeed = useCallback(async (refresh = false, signal?: AbortSignal) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/news${refresh ? "?refresh=1" : ""}`, {
        cache: "no-store",
        signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : strings.error;
        throw new Error(message);
      }
      if (!payload || typeof payload !== "object" || !("items" in payload) || !Array.isArray(payload.items)) {
        throw new Error(strings.error);
      }
      setFeed(payload as NewsFeedData);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : strings.error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [strings.error]);

  useEffect(() => {
    const controller = new AbortController();
    void loadFeed(false, controller.signal);
    return () => controller.abort();
  }, [loadFeed]);

  const filteredItems = useMemo(
    () => filterNewsItems(feed?.items ?? [], activeCategory),
    [activeCategory, feed],
  );
  const displayedItems = filteredItems.slice(0, visibleCount);
  const featured = displayedItems[0] ?? null;
  const additionalItems = featured ? displayedItems.slice(1) : [];

  return (
    <section className="news-section news-full" aria-labelledby="news-page-title">
      <div className="news-section-heading">
        <div>
          <p className="news-eyebrow">{strings.subtitle}</p>
          <h2 id="news-page-title">{strings.title}</h2>
        </div>
        <p className="news-source-note">{strings.sourceNote}</p>
        <div className="news-heading-actions">
          <a className="news-pau-link" href="https://pau.edu/index.php?_act=manageSandesh&DO=viewAdvisory" target="_blank" rel="noopener noreferrer">
            {strings.pau}
          </a>
          <button type="button" className="news-refresh" onClick={() => void loadFeed(true)} disabled={refreshing || loading}>
            <RefreshCw size={15} className={refreshing ? "is-spinning" : ""} />
            {strings.refresh}
          </button>
        </div>
      </div>

      <div className="news-category-list" aria-label={strings.title}>
        <button type="button" className={activeCategory === "all" ? "is-active" : ""} onClick={() => { setActiveCategory("all"); setVisibleCount(8); }}>
          {strings.all}
        </button>
        {categories.map((category) => (
          <button type="button" className={activeCategory === category ? "is-active" : ""} key={category} onClick={() => { setActiveCategory(category); setVisibleCount(8); }}>
            {strings.categories[category]}
          </button>
        ))}
      </div>

      {feed?.lastUpdatedAt && (
        <div className="news-feed-status" role="status">
          <span>{strings.updated}: {localizedDate(feed.lastUpdatedAt, language, strings.noDate)}</span>
          {feed.stale && <span>{strings.stale}</span>}
          {feed.refreshDeferred && <span>{strings.deferred}</span>}
          {feed.sources.some((source) => source.error) && (
            <span>{feed.sources.filter((source) => source.error).map((source) => `${source.name}: ${source.error}`).join(" · ")}</span>
          )}
        </div>
      )}

      {loading && <p className="news-message" role="status">{strings.loading}</p>}
      {!loading && error && (
        <div className="news-message news-error" role="alert">
          <p>{error || strings.error}</p>
          <button type="button" onClick={() => void loadFeed(true)} disabled={refreshing}>{strings.retry}</button>
        </div>
      )}
      {!loading && !error && feed && filteredItems.length === 0 && (
        <p className="news-message">{strings.empty}</p>
      )}
      {!loading && !error && featured && (
        <>
          <div className="news-featured-wrap">
            <NewsCard item={featured} language={language} strings={strings} featured />
          </div>
          <div className="news-grid">
            {additionalItems.map((item) => <NewsCard key={item.id} item={item} language={language} strings={strings} />)}
          </div>
        </>
      )}
      {!loading && !error && filteredItems.length > visibleCount && (
        <button className="news-load-more" type="button" onClick={() => setVisibleCount((count) => count + 8)}>
          {language === "pa" ? "ਹੋਰ ਅਪਡੇਟ ਵੇਖੋ" : language === "hi" ? "और अपडेट देखें" : "Load more updates"}
        </button>
      )}
    </section>
  );
}
