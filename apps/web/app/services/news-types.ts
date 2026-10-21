export type NewsCategory =
  | "advisory"
  | "weather"
  | "market"
  | "government"
  | "protection"
  | "training"
  | "research"
  | "stories";

export type NewsCategoryFilter = NewsCategory | "all";

export function filterNewsItems<T extends { category: NewsCategory }>(
  items: readonly T[],
  category: NewsCategoryFilter,
): T[] {
  return category === "all" ? [...items] : items.filter((item) => item.category === category);
}
