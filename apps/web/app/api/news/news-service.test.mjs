import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyNewsCategory,
  createNewsFeedCache,
  deduplicateNews,
  parseRssFeed,
  rankNewsItems,
  validateArticleUrl,
} from "./news-service.ts";
import { filterNewsItems } from "../../services/news-types.ts";

const source = {
  id: "icar",
  name: "ICAR",
  feedUrl: "https://icar.org.in/rss.xml",
  domain: "icar.org.in",
  official: true,
};

const rss = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>ICAR</title>
<item>
  <title>ਪੰਜਾਬ ਕਣਕ ਲਈ ਖੇਤੀ ਸਲਾਹ</title>
  <link>https://icar.org.in/pa/wheat-advisory?utm_source=test</link>
  <description>&amp;lt;p&amp;gt;ਕਿਸਾਨਾਂ ਲਈ ਕਣਕ ਦੀ ਫ਼ਸਲ ਬਾਰੇ ਨਵੀਂ ਅਤੇ ਲਾਭਦਾਇਕ ਸਲਾਹ ਜਾਰੀ ਕੀਤੀ ਗਈ ਹੈ।&amp;lt;/p&amp;gt;</description>
  <pubDate>${new Date().toUTCString()}</pubDate>
</item>
<item><title>Annual Training Calendar 2026-27</title><link>https://icar.org.in/training-calendar</link></item>
<item><title>Campus event</title><link>https://icar.org.in/campus</link><description>Annual campus event</description></item>
<item><title>Rice research</title><link>https://other.example/rice</link><description>Agricultural research</description></item>
</channel></rss>`;

function newsItem(overrides = {}) {
  return {
    id: "article-1",
    sourceId: "icar",
    title: "Punjab wheat advisory released",
    url: "https://icar.org.in/article-1",
    publisher: "ICAR",
    publisherDomain: "icar.org.in",
    publishedAt: new Date().toISOString(),
    summary: null,
    imageUrl: null,
    category: "advisory",
    language: "en",
    relevance: "Punjab",
    retrievedAt: new Date().toISOString(),
    official: true,
    ...overrides,
  };
}

test("parses and normalizes RSS while filtering non-agricultural and off-domain entries", () => {
  const items = parseRssFeed(rss, source);
  assert.equal(items.length, 2);
  assert.equal(items[0].publisher, "ICAR");
  assert.equal(items[0].official, true);
  assert.equal(items[0].relevance, "Punjab");
  assert.equal(items[0].language, "pa");
  assert.equal(items[0].url, "https://icar.org.in/pa/wheat-advisory");
  assert.equal(items[0].category, "advisory");
  assert.equal(items[0].summary, null);
  assert.equal(items[0].imageUrl, null);
  assert.equal(items[1].publishedAt, null);
  assert.equal(items[1].summary, null);
  assert.equal(items[1].category, "training");
});

test("filters by category and ranks Punjab-relevant updates ahead of national items", () => {
  const national = newsItem({
    id: "national",
    title: "National research report",
    url: "https://icar.org.in/national",
    relevance: "India",
    category: "research",
  });
  const punjabItem = newsItem({
    id: "punjab",
    title: "Punjab research report",
    url: "https://icar.org.in/punjab",
    relevance: "Punjab",
    category: "research",
    publishedAt: new Date(Date.now() - 100 * 86400000).toISOString(),
  });
  const items = [national, punjabItem];
  assert.deepEqual(filterNewsItems(items, "research").map(({ id }) => id), ["national", "punjab"]);
  assert.deepEqual(filterNewsItems(items, "advisory"), []);
  assert.deepEqual(rankNewsItems(items).map(({ id }) => id), ["punjab", "national"]);
});

test("rejects malformed XML and unsafe article links", () => {
  assert.throws(() => parseRssFeed("<rss><broken></rss>", source), /malformed RSS XML/);
  assert.equal(validateArticleUrl("javascript:alert(1)", "icar.org.in"), null);
  assert.equal(validateArticleUrl("http://icar.org.in/item", "icar.org.in"), null);
  assert.equal(validateArticleUrl("https://icar.org.in.evil.test/item", "icar.org.in"), null);
  assert.equal(
    validateArticleUrl("https://news.icar.org.in/item", "icar.org.in")?.hostname,
    "news.icar.org.in",
  );
});

test("filters items outside the date window", () => {
  const feedForDate = (publishedAt) => `<rss><channel><item>
    <title>Crop research update</title>
    <link>https://icar.org.in/crop-research</link>
    <pubDate>${publishedAt}</pubDate>
  </item></channel></rss>`;
  const tooOld = new Date(Date.now() - 121 * 86400000).toUTCString();
  const tooFarAhead = new Date(Date.now() + 25 * 60 * 60 * 1000).toUTCString();
  assert.deepEqual(parseRssFeed(feedForDate(tooOld), source), []);
  assert.deepEqual(parseRssFeed(feedForDate(tooFarAhead), source), []);
});

test("classifies agricultural topics and deduplicates duplicate URLs and headlines", () => {
  assert.equal(classifyNewsCategory("Government crop subsidy"), "government");
  assert.equal(classifyNewsCategory("Pest alert for cotton"), "protection");
  const unique = deduplicateNews([
    newsItem(),
    newsItem({ id: "duplicate-url", title: "A different title" }),
    newsItem({
      id: "duplicate-headline",
      url: "https://icar.org.in/article-2",
      title: "Punjab wheat advisory released",
    }),
    newsItem({
      id: "distinct",
      url: "https://icar.org.in/article-3",
      title: "ICAR develops improved rice cultivation method",
    }),
  ]);
  assert.deepEqual(unique.map(({ id }) => id), ["article-1", "distinct"]);
});

test("caches feed responses and returns stale cached items when a refresh fails", async () => {
  let clock = Date.now();
  let fail = false;
  let calls = 0;
  const item = newsItem();
  const feedCache = createNewsFeedCache([source], async () => {
    calls += 1;
    if (fail) throw new Error("source timeout");
    return [item];
  }, () => clock);

  const first = await feedCache.getNewsFeed();
  const cached = await feedCache.getNewsFeed();
  assert.equal(calls, 1);
  assert.equal(cached.items[0].id, item.id);

  clock += 61_000;
  fail = true;
  const stale = await feedCache.getNewsFeed(true);
  assert.equal(stale.stale, true);
  assert.equal(stale.items[0].id, item.id);
  assert.equal(stale.lastUpdatedAt, first.lastUpdatedAt);
  assert.match(stale.sources[0].error, /source timeout/);
  assert.equal((await feedCache.getNewsFeed(true)).refreshDeferred, true);
});

test("keeps cached items for one failed source while refreshing other sources", async () => {
  let clock = Date.now();
  let failPib = false;
  const icar = { ...source, id: "icar" };
  const pib = { ...source, id: "pib", name: "PIB", domain: "pib.gov.in" };
  const feedCache = createNewsFeedCache([icar, pib], async (selectedSource) => {
    if (selectedSource.id === "pib" && failPib) throw new Error("PIB unavailable");
    return [newsItem({
      id: `${selectedSource.id}-article`,
      sourceId: selectedSource.id,
      title: `${selectedSource.name} agriculture report`,
      publisher: selectedSource.name,
      publisherDomain: selectedSource.domain,
      url: `https://${selectedSource.domain}/article`,
    })];
  }, () => clock);
  await feedCache.getNewsFeed();
  clock += 61_000;
  failPib = true;
  const mixed = await feedCache.getNewsFeed(true);
  assert.equal(mixed.stale, true);
  assert.deepEqual(new Set(mixed.items.map(({ sourceId }) => sourceId)), new Set(["icar", "pib"]));
  assert.match(mixed.sources.find(({ id }) => id === "pib").error, /PIB unavailable/);
});

test("coalesces concurrent cache refreshes", async () => {
  let calls = 0;
  let resolveFetch;
  const fetchResult = new Promise((resolve) => { resolveFetch = resolve; });
  const feedCache = createNewsFeedCache([source], () => {
    calls += 1;
    return fetchResult;
  });
  const pendingFirst = feedCache.getNewsFeed();
  const pendingSecond = feedCache.getNewsFeed();
  resolveFetch([newsItem()]);
  const [first, second] = await Promise.all([pendingFirst, pendingSecond]);
  assert.equal(calls, 1);
  assert.deepEqual(first.items, second.items);
});
