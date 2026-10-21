const INDIA_TIME_ZONE = "Asia/Kolkata";

type LocalizedName = {
  en: string;
  pa: string;
  hi: string;
};

export type HomeOccasion = {
  kind: "public-holiday" | "observance";
  name: LocalizedName;
};

const annualOccasions: Record<string, HomeOccasion> = {
  "01-13": {
    kind: "observance",
    name: { en: "Lohri", pa: "ਲੋਹੜੀ", hi: "लोहड़ी" },
  },
  "01-26": {
    kind: "public-holiday",
    name: { en: "Republic Day", pa: "ਗਣਤੰਤਰ ਦਿਵਸ", hi: "गणतंत्र दिवस" },
  },
  "08-15": {
    kind: "public-holiday",
    name: { en: "Independence Day", pa: "ਆਜ਼ਾਦੀ ਦਿਵਸ", hi: "स्वतंत्रता दिवस" },
  },
  "10-02": {
    kind: "public-holiday",
    name: { en: "Gandhi Jayanti", pa: "ਗਾਂਧੀ ਜਯੰਤੀ", hi: "गांधी जयंती" },
  },
};

export function getIndiaDateKey(date: Date) {
  if (!Number.isFinite(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getHomeOccasion(date: Date): HomeOccasion | null {
  const dateKey = getIndiaDateKey(date);
  if (!dateKey) return null;
  const monthAndDay = dateKey.slice(5);
  return annualOccasions[monthAndDay] ?? null;
}
