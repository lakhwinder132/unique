export type SearchResult = {
  title: string;
  source: string;
  information: string;
  relevance: number;
};

export async function searchWeb(
  question: string
): Promise<SearchResult[]> {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok || !Array.isArray(data)) {
    throw new Error("Web search is unavailable.");
  }

  const relevantData = data
    .filter((item): item is SearchResult =>
      item !== null &&
      typeof item === "object" &&
      "title" in item && typeof item.title === "string" &&
      "source" in item && typeof item.source === "string" &&
      "information" in item && typeof item.information === "string" &&
      "relevance" in item && typeof item.relevance === "number"
    )
    .filter((item) => item.relevance >= 0.8)
    .map((item) => ({
      title: item.title,
      source: item.source,
      information: item.information,
      relevance: item.relevance,
    }));

  return relevantData;
}

export function createWebContext(
  results: SearchResult[]
): string {
  return results
    .slice(0, 3)
    .map(
      (item, index) => `
Source ${index + 1}
Title: ${item.title}
URL: ${item.source}
Information: ${item.information.slice(0, 900)}
`
    )
    .join("\n");
}
