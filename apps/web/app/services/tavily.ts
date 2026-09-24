import axios from "axios";

export type SearchResult = {
  title: string;
  source: string;
  information: string;
  relevance: number;
};

export async function searchWeb(
  question: string
): Promise<SearchResult[]> {
  const res = await axios.get<SearchResult[]>(
    `http://16.4.17.94:3001/extract/${encodeURIComponent(question)}`
  );


  const relevantData = res.data
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
    .map(
      (item, index) => `
Source ${index + 1}
Title: ${item.title}
URL: ${item.source}
Information: ${item.information}
`
    )
    .join("\n");
}