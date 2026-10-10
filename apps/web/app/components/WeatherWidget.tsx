"use client";

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Compass,
  Droplets,
  Eye,
  Gauge,
  Leaf,
  MapPin,
  Moon,
  RefreshCw,
  Search,
  Sprout,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Wind,
  Wheat,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  isWeatherData,
  type WeatherData,
  type WeatherLocation,
  type WeatherSeries,
  type WeatherValue,
} from "../services/weather";

type WeatherWidgetProps = {
  onWeatherLoaded: (weather: WeatherData) => void;
  language?: string;
};

type SelectedPlace = {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
};

type WeatherCondition = {
  label: string;
  kind: "clear" | "cloudy" | "fog" | "rain" | "snow" | "storm";
};

const detailGroups: { title: string; fields: [string, string][] }[] = [
  {
    title: "Temperature and humidity",
    fields: [
      ["Temperature at 2 m", "temperature_2m"],
      ["Apparent temperature", "apparent_temperature"],
      ["Relative humidity", "relative_humidity_2m"],
      ["Dew point", "dew_point_2m"],
    ],
  },
  {
    title: "Rainfall and precipitation",
    fields: [
      ["Precipitation probability", "precipitation_probability"],
      ["Precipitation", "precipitation"],
      ["Rain", "rain"],
      ["Showers", "showers"],
      ["Snowfall", "snowfall"],
    ],
  },
  {
    title: "Wind",
    fields: [
      ["Wind speed at 10 m", "wind_speed_10m"],
      ["Wind direction at 10 m", "wind_direction_10m"],
      ["Wind gusts at 10 m", "wind_gusts_10m"],
    ],
  },
  {
    title: "Soil and irrigation",
    fields: [
      ["Evapotranspiration", "evapotranspiration"],
      ["Reference evapotranspiration (ET₀)", "et0_fao_evapotranspiration"],
      ["Vapour pressure deficit", "vapour_pressure_deficit"],
      ["Soil temperature · 0 cm", "soil_temperature_0cm"],
      ["Soil temperature · 6 cm", "soil_temperature_6cm"],
      ["Soil temperature · 18 cm", "soil_temperature_18cm"],
      ["Soil temperature · 54 cm", "soil_temperature_54cm"],
      ["Soil moisture · 0–1 cm", "soil_moisture_0_to_1cm"],
      ["Soil moisture · 1–3 cm", "soil_moisture_1_to_3cm"],
      ["Soil moisture · 3–9 cm", "soil_moisture_3_to_9cm"],
      ["Soil moisture · 9–27 cm", "soil_moisture_9_to_27cm"],
      ["Soil moisture · 27–81 cm", "soil_moisture_27_to_81cm"],
    ],
  },
  {
    title: "Solar radiation and UV",
    fields: [
      ["Shortwave radiation", "shortwave_radiation"],
      ["Direct radiation", "direct_radiation"],
      ["Diffuse radiation", "diffuse_radiation"],
      ["Sunshine duration", "sunshine_duration"],
      ["UV index", "uv_index"],
      ["UV index · clear sky", "uv_index_clear_sky"],
    ],
  },
  {
    title: "Atmosphere, visibility, and cloud",
    fields: [
      ["Surface pressure", "surface_pressure"],
      ["Freezing level height", "freezing_level_height"],
      ["Visibility", "visibility"],
      ["Cloud cover", "cloud_cover"],
      ["Low cloud cover", "cloud_cover_low"],
      ["Mid cloud cover", "cloud_cover_mid"],
      ["High cloud cover", "cloud_cover_high"],
      ["Weather condition code", "weather_code"],
    ],
  },
];

function isLocation(value: unknown): value is WeatherLocation {
  if (!value || typeof value !== "object") return false;
  const location = value as Record<string, unknown>;
  return typeof location.id === "number" &&
    typeof location.name === "string" &&
    typeof location.admin1 === "string" &&
    typeof location.country === "string" &&
    typeof location.latitude === "number" &&
    typeof location.longitude === "number";
}

function getNumber(values: Record<string, WeatherValue>, key: string) {
  const value = values[key];
  return typeof value === "number" ? value : null;
}

function getSeriesNumber(series: WeatherSeries, key: string, index: number) {
  const column = series[key];
  const value = Array.isArray(column) ? column[index] : null;
  return typeof value === "number" ? value : null;
}

function getSeriesString(series: WeatherSeries, key: string, index: number) {
  const column = series[key];
  const value = Array.isArray(column) ? column[index] : null;
  return typeof value === "string" ? value : null;
}

function formatValue(value: WeatherValue | undefined, unit = "") {
  if (value === null || value === undefined) return "Not available";
  if (typeof value === "string") return value;
  const formatted = Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
  return `${formatted}${unit ? ` ${unit}` : ""}`;
}

function formatTimestamp(value: string, timezone: string, options: Intl.DateTimeFormatOptions = {}) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { timeZone: timezone, ...options }).format(date);
}

function formatDay(value: string, timezone: string) {
  return formatTimestamp(value, timezone, { weekday: "short", month: "short", day: "numeric" });
}

function localDate(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const date = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${date.year}-${date.month}-${date.day}`;
}

function getCondition(code: number | null, language: string): WeatherCondition {
  const condition = code === null
    ? { key: "unavailable", label: "Conditions unavailable", kind: "cloudy" as const }
    : code === 0
      ? { key: "clear", label: "Clear sky", kind: "clear" as const }
      : code === 1
        ? { key: "mainlyClear", label: "Mainly clear", kind: "clear" as const }
        : code === 2
          ? { key: "partlyCloudy", label: "Partly cloudy", kind: "cloudy" as const }
          : code === 3
            ? { key: "overcast", label: "Overcast", kind: "cloudy" as const }
            : code === 45 || code === 48
              ? { key: "fog", label: "Foggy", kind: "fog" as const }
              : [51, 53, 55, 56, 57].includes(code)
                ? { key: "drizzle", label: "Drizzle", kind: "rain" as const }
                : [61, 63, 65, 66, 67, 80, 81, 82].includes(code)
                  ? { key: "rain", label: "Rain showers", kind: "rain" as const }
                  : [71, 73, 75, 77, 85, 86].includes(code)
                    ? { key: "snow", label: "Snow", kind: "snow" as const }
                    : [95, 96, 99].includes(code)
                      ? { key: "storm", label: "Thunderstorm", kind: "storm" as const }
                      : { key: "variable", label: "Variable conditions", kind: "cloudy" as const };
  const localized: Record<string, Record<string, string>> = {
    pa: {
      unavailable: "ਮੌਸਮ ਦੀ ਜਾਣਕਾਰੀ ਨਹੀਂ",
      clear: "ਸਾਫ਼ ਅਸਮਾਨ",
      mainlyClear: "ਜ਼ਿਆਦਾਤਰ ਸਾਫ਼",
      partlyCloudy: "ਥੋੜ੍ਹੇ ਬੱਦਲ",
      overcast: "ਬੱਦਲਵਾਈ",
      fog: "ਧੁੰਦ",
      drizzle: "ਹਲਕੀ ਫੁਹਾਰ",
      rain: "ਮੀਂਹ ਦੀਆਂ ਫੁਹਾਰਾਂ",
      snow: "ਬਰਫ਼",
      storm: "ਗਰਜ-ਤੂਫ਼ਾਨ",
      variable: "ਬਦਲਦਾ ਮੌਸਮ",
    },
    hi: {
      unavailable: "मौसम की जानकारी उपलब्ध नहीं",
      clear: "साफ़ आसमान",
      mainlyClear: "अधिकतर साफ़",
      partlyCloudy: "आंशिक बादल",
      overcast: "बादल छाए",
      fog: "कोहरा",
      drizzle: "बूंदाबांदी",
      rain: "बारिश की बौछारें",
      snow: "बर्फ़",
      storm: "गरज-तूफ़ान",
      variable: "बदलता मौसम",
    },
  };
  return {
    kind: condition.kind,
    label: localized[language]?.[condition.key] ?? condition.label,
  };
}

function ConditionIllustration({ kind, isDay }: { kind: WeatherCondition["kind"]; isDay: boolean }) {
  return (
    <div className={`weather-world weather-world-${kind}${!isDay ? " weather-world-night" : ""}`} aria-hidden="true">
      <svg className="weather-world-scene" viewBox="0 0 440 210" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="farmSky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" className="farm-sky-top" />
            <stop offset="100%" className="farm-sky-bottom" />
          </linearGradient>
          <linearGradient id="farmField" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" className="farm-field-top" />
            <stop offset="100%" className="farm-field-bottom" />
          </linearGradient>
        </defs>
        <rect width="440" height="210" fill="url(#farmSky)" />
        <circle className="farm-sun" cx="336" cy="54" r="28" />
        <path className="farm-cloud farm-cloud-back" d="M43 74c2-14 14-23 28-21 7-17 33-15 38 3 14-4 26 6 25 18H43Z" />
        <path className="farm-cloud farm-cloud-front" d="M253 91c2-15 15-24 29-21 7-15 30-13 35 3 16-3 25 6 25 18h-89Z" />
        <path className="farm-horizon" d="M0 134c52-12 94-14 142-4 62 12 91-9 151-11 56-2 88 14 147 4v87H0Z" />
        <path className="farm-field" d="M0 151c79-16 155-21 227-15 70 6 137 19 213 8v66H0Z" fill="url(#farmField)" />
        <g className="farm-furrows" fill="none" strokeLinecap="round">
          <path d="M-28 211c90-40 166-56 253-65 71-7 134-4 234 9" />
          <path d="M49 211c70-31 137-45 208-53 58-6 115-5 187 3" />
          <path d="M140 211c50-21 99-33 153-39 50-6 94-5 151-1" />
        </g>
        <g className="farm-wheat">
          <path d="M42 194v-39m0 14-8-7m8 0 8-8m-8 17-9-6m9 1 8-7M77 187v-46m0 17-9-8m9 0 9-10m-9 22-9-7m9 1 10-8M396 188v-43m0 17-8-8m8 0 9-10m-9 20-9-6m9 0 9-8" />
        </g>
      </svg>
      {kind === "rain" || kind === "storm" ? (
        <svg className="weather-world-rain" viewBox="0 0 440 210" preserveAspectRatio="none">
          <path d="M196 118l-9 21m38-19-9 24m37-23-9 22m37-20-9 23m37-19-8 21m-119 9-7 17m44-18-8 20m46-18-8 21m44-17-7 18" />
        </svg>
      ) : null}
      {kind === "storm" ? <CloudLightning className="weather-world-bolt" aria-hidden="true" /> : null}
      {kind === "fog" ? <span className="weather-world-mist" /> : null}
      {!isDay ? <Moon className="weather-world-moon" aria-hidden="true" /> : null}
    </div>
  );
}

function weatherIcon(kind: WeatherCondition["kind"]) {
  if (kind === "clear") return Sun;
  if (kind === "fog") return CloudFog;
  if (kind === "rain") return CloudDrizzle;
  if (kind === "snow") return CloudSnow;
  if (kind === "storm") return CloudLightning;
  return Cloud;
}

function createTemperaturePath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1]!;
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

type FarmInsight = {
  title: string;
  description: string;
  icon: typeof Droplets;
  tone: "blue" | "gold" | "green";
};

type ActivityStatus = "suitable" | "caution" | "unsuitable" | "check";

type FarmActivity = {
  title: string;
  icon: typeof Sprout;
  status: ActivityStatus;
  explanation: string;
};

function buildFarmInsights(weather: WeatherData): FarmInsight[] {
  const insights: FarmInsight[] = [];
  const temperature = getNumber(weather.current, "temperature_2m");
  const wind = getNumber(weather.current, "wind_speed_10m");
  const nextHours = weather.hourly.time
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => Date.parse(time) >= Date.parse(String(weather.current.time)))
    .slice(0, 24);
  const rainChance = nextHours.reduce<number | null>((highest, { index }) => {
    const chance = getSeriesNumber(weather.hourly, "precipitation_probability", index);
    return chance === null ? highest : Math.max(highest ?? 0, chance);
  }, null);

  if (rainChance !== null && rainChance >= 60) {
    insights.push({
      title: "Rain is possible",
      description: `Up to ${Math.round(rainChance)}% chance in the next day. Check your field before deciding whether to irrigate.`,
      icon: Droplets,
      tone: "blue",
    });
  }
  if (wind !== null && wind >= 20) {
    insights.push({
      title: "Wind may affect spraying",
      description: `${formatValue(wind, weather.currentUnits.wind_speed_10m)} wind now. Check product labels and local advice before spraying.`,
      icon: Wind,
      tone: "gold",
    });
  }
  if (temperature !== null && temperature >= 35) {
    insights.push({
      title: "Hot conditions",
      description: `${formatValue(temperature, weather.currentUnits.temperature_2m)} now. Consider heat exposure when planning field work.`,
      icon: Sun,
      tone: "gold",
    });
  } else if (temperature !== null && temperature <= 2) {
    insights.push({
      title: "Near-freezing conditions",
      description: `${formatValue(temperature, weather.currentUnits.temperature_2m)} now. Check local guidance for frost-sensitive crops.`,
      icon: Thermometer,
      tone: "blue",
    });
  }
  if (insights.length === 0) {
    insights.push({
      title: "Plan with the local forecast",
      description: "Use these model values alongside field observations and crop-specific local advice.",
      icon: Sprout,
      tone: "green",
    });
  }
  return insights.slice(0, 2);
}

function buildWeatherAlert(weather: WeatherData, forecast: { index: number }[]) {
  let peakWindGust: number | null = null;
  let peakRain: number | null = null;
  let stormExpected = false;

  for (const { index } of forecast) {
    const gust = getSeriesNumber(weather.hourly, "wind_gusts_10m", index);
    const rain = getSeriesNumber(weather.hourly, "precipitation", index);
    const code = getSeriesNumber(weather.hourly, "weather_code", index);
    if (gust !== null) peakWindGust = Math.max(peakWindGust ?? 0, gust);
    if (rain !== null) peakRain = Math.max(peakRain ?? 0, rain);
    if (code !== null && code >= 95) stormExpected = true;
  }

  if (stormExpected) {
    return {
      level: "important" as const,
      title: "Thunderstorm in the forecast window",
      detail: "Check the forecast times below and follow local official guidance. This is a model signal, not an official warning.",
      icon: CloudLightning,
    };
  }
  if (peakWindGust !== null && peakWindGust >= 40) {
    return {
      level: "caution" as const,
      title: "Strong gusts may affect field work",
      detail: `Peak forecast gust ${formatValue(peakWindGust, weather.hourlyUnits.wind_gusts_10m)} in the next 6 hours. This is a model signal, not an official warning.`,
      icon: Wind,
    };
  }
  if (peakRain !== null && peakRain >= 10) {
    return {
      level: "caution" as const,
      title: "Heavy rain is possible",
      detail: `Up to ${formatValue(peakRain, weather.hourlyUnits.precipitation)} in one hourly period. Check local conditions; this is not an official warning.`,
      icon: CloudRain,
    };
  }
  return {
    level: "calm" as const,
    title: "No high-impact signal in the next 6 hours",
    detail: "This screen is not connected to official weather alerts. Check local advisories for warnings.",
    icon: CloudSun,
  };
}

function buildFarmActivities(weather: WeatherData, forecast: { index: number }[]): FarmActivity[] {
  const wind = getNumber(weather.current, "wind_speed_10m");
  const gusts = getNumber(weather.current, "wind_gusts_10m");
  const nextRainChance = forecast.reduce<number | null>((maximum, { index }) => {
    const chance = getSeriesNumber(weather.hourly, "precipitation_probability", index);
    return chance === null ? maximum : Math.max(maximum ?? 0, chance);
  }, null);
  const nextRainAmount = forecast.reduce<number | null>((total, { index }) => {
    const amount = getSeriesNumber(weather.hourly, "precipitation", index);
    return amount === null ? total : (total ?? 0) + amount;
  }, null);
  const soilMoisture = getNumber(weather.current, "soil_moisture_0_to_1cm");

  const sprayStatus: ActivityStatus = wind === null || gusts === null || nextRainChance === null
    ? "check"
    : wind >= 20 || gusts >= 30 || nextRainChance >= 50
      ? "unsuitable"
      : wind >= 10 || gusts >= 20 || nextRainChance >= 20
        ? "caution"
        : "suitable";
  const sprayExplanation = sprayStatus === "check"
    ? "Wind, gust, or rain data is missing. Check product-label limits before spraying."
    : `Wind ${formatValue(wind, weather.currentUnits.wind_speed_10m)}, gusts ${formatValue(gusts, weather.currentUnits.wind_gusts_10m)}, rain chance up to ${formatValue(nextRainChance, "%")} in the next 6 hours. Product labels take priority.`;

  const harvestStatus: ActivityStatus = nextRainChance === null || nextRainAmount === null
    ? "check"
    : nextRainChance >= 70 || nextRainAmount >= 5
      ? "unsuitable"
      : nextRainChance >= 30 || nextRainAmount >= 1
        ? "caution"
        : "suitable";
  const harvestExplanation = harvestStatus === "check"
    ? "Rain forecast data is incomplete. Check the local forecast and field conditions."
    : `Rain chance up to ${formatValue(nextRainChance, "%")} and ${formatValue(nextRainAmount, weather.hourlyUnits.precipitation)} forecast over 6 hours. Crop readiness and field access still matter.`;

  return [
    {
      title: "Irrigation",
      icon: Droplets,
      status: soilMoisture === null ? "check" : "caution",
      explanation: soilMoisture === null
        ? "Soil moisture or crop needs are unavailable. Check soil in the field before deciding."
        : `Model soil moisture is ${formatValue(soilMoisture, weather.currentUnits.soil_moisture_0_to_1cm)} near the surface. Root-zone and crop needs can differ; check the field.`,
    },
    { title: "Spraying", icon: Wind, status: sprayStatus, explanation: sprayExplanation },
    { title: "Harvesting", icon: Wheat, status: harvestStatus, explanation: harvestExplanation },
    {
      title: "Sowing",
      icon: Sprout,
      status: "check",
      explanation: "Weather alone cannot confirm sowing readiness. Check seed, crop, and soil conditions with local guidance.",
    },
  ];
}

export default function WeatherWidget({ onWeatherLoaded, language = "en" }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [locations, setLocations] = useState<WeatherLocation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedHour, setSelectedHour] = useState(0);
  const [selectedHourExplicit, setSelectedHourExplicit] = useState(false);
  const [weatherView, setWeatherView] = useState<"now" | "today" | "week">("now");
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [explorerHours, setExplorerHours] = useState(24);
  const requestController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const refreshCallback = useRef<(place: SelectedPlace) => void>(() => undefined);
  const copy = language === "pa"
    ? {
      title: "ਖੇਤ ਦਾ ਮੌਸਮ",
      searchPlaceholder: "ਪਿੰਡ ਜਾਂ ਸ਼ਹਿਰ ਲੱਭੋ…",
      search: "ਲੱਭੋ",
      useLocation: "ਮੇਰੀ ਥਾਂ",
      now: "ਹੁਣ",
      today: "ਅੱਜ",
      nextDays: "ਅਗਲੇ 7 ਦਿਨ",
      nextHours: "ਅਗਲੇ 6 ਘੰਟੇ",
      selectTime: "ਸਮਾਂ ਚੁਣੋ",
      rainWatch: "ਮੀਂਹ ਦੀ ਨਿਗਰਾਨੀ",
      rainPossible: "ਮੀਂਹ ਪੈ ਸਕਦਾ ਹੈ",
      lowRain: "ਮੀਂਹ ਦੀ ਘੱਟ ਸੰਭਾਵਨਾ",
      warmer: "ਗਰਮੀ ਵਧੇਗੀ",
      cooler: "ਠੰਢ ਵਧੇਗੀ",
      steady: "ਤਾਪਮਾਨ ਸਥਿਰ",
      noSignal: "ਅਗਲੇ 6 ਘੰਟਿਆਂ ਵਿੱਚ ਵੱਡਾ ਮੌਸਮੀ ਸੰਕੇਤ ਨਹੀਂ",
      forecastSignal: "ਮਾਡਲ ਸੰਕੇਤ",
      alertCheck: "ਅਨੁਮਾਨ ਵੇਖੋ",
      noAlert: "ਕੋਈ ਚੇਤਾਵਨੀ ਨਹੀਂ",
      humidity: "ਨਮੀ",
      wind: "ਹਵਾ",
      cloud: "ਬੱਦਲ",
      uv: "ਯੂਵੀ",
      farmGuide: "ਖੇਤੀ ਕੰਮ ਲਈ ਮੌਸਮ",
    }
    : language === "hi"
      ? {
        title: "खेत का मौसम",
        searchPlaceholder: "गाँव या शहर खोजें…",
        search: "खोजें",
        useLocation: "मेरी जगह",
        now: "अभी",
        today: "आज",
        nextDays: "अगले 7 दिन",
        nextHours: "अगले 6 घंटे",
        selectTime: "समय चुनें",
        rainWatch: "बारिश पर नज़र",
        rainPossible: "बारिश संभव",
        lowRain: "बारिश की कम संभावना",
        warmer: "गर्मी बढ़ेगी",
        cooler: "ठंडक बढ़ेगी",
        steady: "तापमान स्थिर",
        noSignal: "अगले 6 घंटों में कोई बड़ा मौसम संकेत नहीं",
        forecastSignal: "मॉडल संकेत",
        alertCheck: "पूर्वानुमान देखें",
        noAlert: "चेतावनी नहीं",
        humidity: "नमी",
        wind: "हवा",
        cloud: "बादल",
        uv: "यूवी",
        farmGuide: "खेती के काम के लिए मौसम",
      }
      : {
        title: "YOUR FIELD WEATHER",
        searchPlaceholder: "Find your village or town…",
        search: "Search",
        useLocation: "Use my location",
        now: "Now",
        today: "Today",
        nextDays: "Next 7 days",
        nextHours: "Next 6 hours",
        selectTime: "Tap a time to explore",
        rainWatch: "Rain Watch",
        rainPossible: "Rain possible",
        lowRain: "Low rain chance",
        warmer: "Getting warmer",
        cooler: "Getting cooler",
        steady: "Temperature steady",
        noSignal: "No high-impact signal in the next 6 hours",
        forecastSignal: "Forecast signal",
        alertCheck: "Check forecast",
        noAlert: "No alert",
        humidity: "Humidity",
        wind: "Wind",
        cloud: "Cloud cover",
        uv: "UV around now",
        farmGuide: "Farm activity guide",
      };

  useEffect(() => () => {
    requestSequence.current += 1;
    requestController.current?.abort();
  }, []);

  const beginRequest = () => {
    requestSequence.current += 1;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setLoading(true);
    setError("");
    return controller;
  };

  const loadWeather = async (place: SelectedPlace) => {
    const controller = beginRequest();
    try {
      const params = new URLSearchParams({
        lat: String(place.latitude),
        lon: String(place.longitude),
        name: place.name,
        country: place.country,
      });
      const response = await fetch(`/api/weather?${params}`, { signal: controller.signal });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Weather could not be loaded. Please try again.";
        throw new Error(message);
      }
      if (!isWeatherData(data)) throw new Error("Weather data was incomplete. Please try again.");
      setWeather(data);
      setSelectedPlace(place);
      setSelectedHour(0);
      setSelectedHourExplicit(false);
      setWeatherView("now");
      onWeatherLoaded(data);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") return;
      setError(requestError instanceof Error ? requestError.message : "Weather could not be loaded.");
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    refreshCallback.current = (place) => { void loadWeather(place); };
  }, [loadWeather]);

  useEffect(() => {
    if (!selectedPlace) return;
    const interval = window.setInterval(() => refreshCallback.current(selectedPlace), 15 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [selectedPlace]);

  const searchLocations = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = locationQuery.trim();
    if (query.length < 2) {
      setError("Enter at least 2 characters for a location.");
      return;
    }

    const controller = beginRequest();
    setLocations([]);
    try {
      const response = await fetch(`/api/weather/locations?q=${encodeURIComponent(query)}`, { signal: controller.signal });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Locations could not be searched. Please try again.";
        throw new Error(message);
      }
      if (!data || typeof data !== "object" || !("locations" in data) || !Array.isArray(data.locations)) {
        throw new Error("Location search returned invalid data.");
      }
      const matches = data.locations.filter(isLocation);
      setLocations(matches);
      if (matches.length === 0) setError("No matching places found. Try a nearby town or district.");
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") return;
      setError(requestError instanceof Error ? requestError.message : "Locations could not be searched.");
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setLoading(false);
      }
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser. Search for a town or district instead.");
      return;
    }
    requestController.current?.abort();
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (requestSequence.current !== requestId) return;
        void loadWeather({
          name: "My location",
          country: "",
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
      },
      (locationError) => {
        if (requestSequence.current !== requestId) return;
        const message = locationError.code === locationError.PERMISSION_DENIED
          ? "Location permission was denied. Search for a town or district instead."
          : locationError.code === locationError.TIMEOUT
            ? "Finding your location took too long. Please try again or search for a place."
            : "Your location is unavailable. Check location services or search for a place.";
        setError(message);
        setLoading(false);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 12000 },
    );
  };

  const currentTemperature = weather ? getNumber(weather.current, "temperature_2m") : null;
  const apparentTemperature = weather ? getNumber(weather.current, "apparent_temperature") : null;
  const currentCode = weather ? getNumber(weather.current, "weather_code") : null;
  const isDay = weather ? getNumber(weather.current, "is_day") === 1 : true;
  const condition = getCondition(currentCode, language);
  const ConditionIcon = weatherIcon(condition.kind);
  const timeline = weather
    ? weather.hourly.time
      .map((time, index) => ({ time, index }))
      .filter(({ time }) => Date.parse(time) >= Date.parse(String(weather.current.time)))
      .slice(0, 6)
    : [];
  const safeSelectedHour = Math.min(selectedHour, Math.max(timeline.length - 1, 0));
  const selectedForecast = timeline[safeSelectedHour];
  const temperatures = timeline.map(({ index }) => getSeriesNumber(weather!.hourly, "temperature_2m", index));
  const knownTemps = temperatures.filter((temperature): temperature is number => temperature !== null);
  const minTemp = Math.min(...knownTemps, 0);
  const maxTemp = Math.max(...knownTemps, 0);
  const tempRange = Math.max(maxTemp - minTemp, 1);
  const chartPoints = timeline.flatMap(({ index }, pointIndex) => {
    const temperature = getSeriesNumber(weather!.hourly, "temperature_2m", index);
    if (temperature === null) return [];
    return [{
      x: 24 + pointIndex * (552 / Math.max(timeline.length - 1, 1)),
      y: 70 - ((temperature - minTemp) / tempRange) * 44,
    }];
  });
  const temperaturePath = createTemperaturePath(chartPoints);
  const precipitationChance = weather && selectedForecast
    ? getSeriesNumber(weather.hourly, "precipitation_probability", selectedForecast.index)
    : null;
  const currentHumidity = weather ? getNumber(weather.current, "relative_humidity_2m") : null;
  const currentWind = weather ? getNumber(weather.current, "wind_speed_10m") : null;
  const currentWindDirection = weather ? getNumber(weather.current, "wind_direction_10m") : null;
  const currentCloud = weather ? getNumber(weather.current, "cloud_cover") : null;
  const currentUv = weather && selectedForecast
    ? getSeriesNumber(weather.hourly, "uv_index", selectedForecast.index)
    : null;
  const rainIntervals = weather?.minutely15
    ? weather.minutely15.time
      .map((time, index) => ({ time, index }))
      .filter(({ time }) => Date.parse(time) >= Date.parse(String(weather.current.time)))
      .slice(0, 8)
    : [];
  const rainValues = weather?.minutely15
    ? rainIntervals.map(({ index }) => ({
      rain: getSeriesNumber(weather.minutely15!, "rain", index),
      precipitation: getSeriesNumber(weather.minutely15!, "precipitation", index),
    }))
    : [];
  const rainAvailable = rainValues.length > 0 && rainValues.every(({ rain, precipitation }) => rain !== null && precipitation !== null);
  const totalRain = rainAvailable
    ? rainValues.reduce((total, value) => total + (value.rain ?? 0), 0)
    : null;
  const maxIntervalRain = Math.max(...rainValues.map(({ rain }) => rain ?? 0), 0);
  const currentLocalDate = weather
    ? localDate(String(weather.current.time), weather.timezone)
    : "";
  const dayIndex = weather?.daily.time.findIndex((day) =>
    localDate(day, weather.timezone) === currentLocalDate,
  ) ?? -1;
  const todayHigh = weather && dayIndex >= 0
    ? getSeriesNumber(weather.daily, "temperature_2m_max", dayIndex)
    : null;
  const todayLow = weather && dayIndex >= 0
    ? getSeriesNumber(weather.daily, "temperature_2m_min", dayIndex)
    : null;
  const todayRainChance = weather && dayIndex >= 0
    ? getSeriesNumber(weather.daily, "precipitation_probability_max", dayIndex)
    : null;
  const selectedTemperature = weather && selectedHourExplicit && selectedForecast
    ? getSeriesNumber(weather.hourly, "temperature_2m", selectedForecast.index)
    : currentTemperature;
  const selectedApparentTemperature = weather && selectedHourExplicit && selectedForecast
    ? getSeriesNumber(weather.hourly, "apparent_temperature", selectedForecast.index)
    : apparentTemperature;
  const selectedCondition = weather && selectedHourExplicit && selectedForecast
    ? getCondition(getSeriesNumber(weather.hourly, "weather_code", selectedForecast.index), language)
    : condition;
  const selectedDaylight = weather && selectedHourExplicit && selectedForecast
    ? getSeriesNumber(weather.hourly, "is_day", selectedForecast.index) === 1
    : isDay;
  const displayedTime = weather && selectedHourExplicit && selectedForecast
    ? selectedForecast.time
    : String(weather?.current.time ?? "");
  const SelectedForecastIcon = weatherIcon(selectedCondition.kind);
  const sixHourRainChance = weather
    ? timeline.reduce<number | null>((maximum, { index }) => {
      const chance = getSeriesNumber(weather.hourly, "precipitation_probability", index);
      return chance === null ? maximum : Math.max(maximum ?? 0, chance);
    }, null)
    : null;
  const sixHourRainAmount = weather && timeline.length > 0
    ? timeline.reduce<number | null>((total, { index }) => {
      const amount = getSeriesNumber(weather.hourly, "precipitation", index);
      return amount === null ? total : (total ?? 0) + amount;
    }, null)
    : null;
  const sixHourWindChange = weather && timeline.length > 1
    ? (() => {
      const first = getSeriesNumber(weather.hourly, "wind_speed_10m", timeline[0]!.index);
      const last = getSeriesNumber(weather.hourly, "wind_speed_10m", timeline[timeline.length - 1]!.index);
      if (first === null || last === null) return null;
      return last - first;
    })()
    : null;
  const sixHourTempChange = weather && timeline.length > 1
    ? (() => {
      const first = getSeriesNumber(weather.hourly, "temperature_2m", timeline[0]!.index);
      const last = getSeriesNumber(weather.hourly, "temperature_2m", timeline[timeline.length - 1]!.index);
      if (first === null || last === null) return null;
      return last - first;
    })()
    : null;
  const weatherAlert = weather ? buildWeatherAlert(weather, timeline) : null;
  const WeatherAlertIcon = weatherAlert?.icon;
  const farmActivities = weather ? buildFarmActivities(weather, timeline) : [];
  const todaySunrise = weather && dayIndex >= 0 ? getSeriesString(weather.daily, "sunrise", dayIndex) : null;
  const todaySunset = weather && dayIndex >= 0 ? getSeriesString(weather.daily, "sunset", dayIndex) : null;
  const daylightProgress = todaySunrise && todaySunset && weather
    ? Math.max(0, Math.min(100, ((Date.parse(String(weather.current.time)) - Date.parse(todaySunrise)) / (Date.parse(todaySunset) - Date.parse(todaySunrise))) * 100))
    : null;
  const detailedTimes = weather
    ? weather.hourly.time
      .map((time, index) => ({ time, index }))
      .filter(({ time }) => Date.parse(time) >= Date.parse(String(weather.current.time)))
      .slice(0, explorerHours)
    : [];
  const scrollToWeatherSection = (view: "now" | "today" | "week") => {
    setWeatherView(view);
    if (view === "week") {
      const dailySection = document.querySelector<HTMLDetailsElement>(".weather-daily");
      if (dailySection) dailySection.open = true;
      window.setTimeout(() => dailySection?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
      return;
    }
    const target = document.querySelector(view === "today" ? ".weather-daylight" : ".weather-hero");
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <section className="field-weather" aria-labelledby="field-weather-title">
      <div className="field-weather-heading">
        <div className="field-weather-label">
          <span>{copy.title}{language === "en" ? <span lang="pa"> · ਖੇਤ ਦਾ ਮੌਸਮ</span> : null}</span>
          <span className="field-weather-live"><span aria-hidden="true" />OPEN-METEO</span>
        </div>
        {weather && selectedPlace && (
          <button
            className={`field-weather-refresh${loading ? " is-refreshing" : ""}`}
            type="button"
            onClick={() => void loadWeather(selectedPlace)}
            disabled={loading}
            aria-label="Refresh local weather"
            title="Refresh weather"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <form className="field-weather-search" onSubmit={searchLocations}>
        <label className="weather-visually-hidden" htmlFor="weather-location">Search a village, town, or district</label>
        <div className="field-weather-search-row">
          <MapPin size={16} aria-hidden="true" />
          <input
            id="weather-location"
            value={locationQuery}
            onChange={(event) => setLocationQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            maxLength={80}
          />
          <button type="submit" disabled={loading} aria-label="Search locations">
            <Search size={16} aria-hidden="true" /><span>{copy.search}</span>
          </button>
          <button className="weather-location-button" type="button" onClick={useMyLocation} disabled={loading}>
            <Compass size={16} aria-hidden="true" /><span>{copy.useLocation}</span>
          </button>
        </div>
        {locations.length > 0 && (
          <ul className="field-weather-locations" aria-label="Location search results">
            {locations.map((location) => {
              const place = {
                name: location.name,
                country: location.country,
                latitude: location.latitude,
                longitude: location.longitude,
              };
              const description = [location.admin1, location.country].filter(Boolean).join(", ");
              return (
                <li key={location.id}>
                  <button type="button" disabled={loading} onClick={() => {
                    setLocationQuery([location.name, location.admin1].filter(Boolean).join(", "));
                    setLocations([]);
                    void loadWeather(place);
                  }}>
                    <span>{location.name}</span><small>{description}</small>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </form>

      <nav className="weather-view-switch" aria-label="Forecast view">
        <button type="button" className={weatherView === "now" ? "is-active" : ""} aria-pressed={weatherView === "now"} onClick={() => scrollToWeatherSection("now")}>{copy.now}</button>
        <button type="button" className={weatherView === "today" ? "is-active" : ""} aria-pressed={weatherView === "today"} onClick={() => scrollToWeatherSection("today")}>{copy.today}</button>
        <button type="button" className={weatherView === "week" ? "is-active" : ""} aria-pressed={weatherView === "week"} onClick={() => scrollToWeatherSection("week")}>{copy.nextDays}</button>
      </nav>

      {error && <p className="field-weather-status field-weather-error" role="alert">{error}</p>}
      {loading && <div className="weather-loading" role="status"><span />Refreshing the local forecast…</div>}
      {loading && !weather && (
        <div className="weather-skeleton" aria-hidden="true">
          <div className="weather-skeleton-hero"><span /><span /><span /></div>
          <div className="weather-skeleton-metrics"><span /><span /><span /><span /></div>
          <div className="weather-skeleton-timeline" />
        </div>
      )}

      {weather ? (
        <div className="weather-dashboard">
          <section className={`weather-hero weather-hero-${selectedCondition.kind}${!selectedDaylight ? " weather-hero-night" : ""}`} aria-labelledby="field-weather-title">
            <div className="weather-hero-copy">
              <p className="weather-kicker">
                <MapPin size={14} aria-hidden="true" />
                {weather.location}{weather.country ? `, ${weather.country}` : ""}
              </p>
              <h2 id="field-weather-title">{formatValue(selectedTemperature, weather.currentUnits.temperature_2m)}</h2>
              <p className="weather-condition">{selectedCondition.label}</p>
              {selectedHourExplicit && selectedForecast && (
                <p className="weather-selected-time">At {formatTimestamp(selectedForecast.time, weather.timezone, { hour: "numeric", minute: "2-digit" })}</p>
              )}
              <p className="weather-feels"><Thermometer size={15} aria-hidden="true" /> Feels like {formatValue(selectedApparentTemperature, weather.currentUnits.apparent_temperature)}</p>
              <div className="weather-hero-range">
                <span><Sun size={14} aria-hidden="true" /> H {formatValue(todayHigh, weather.dailyUnits.temperature_2m_max)}</span>
                <span><Moon size={14} aria-hidden="true" /> L {formatValue(todayLow, weather.dailyUnits.temperature_2m_min)}</span>
              </div>
            </div>
            <ConditionIllustration kind={selectedCondition.kind} isDay={selectedDaylight} />
            <div className="weather-hero-footer">
              <span><Droplets size={14} aria-hidden="true" /> {formatValue(todayRainChance, "%")} chance today</span>
              <span>{selectedHourExplicit ? formatTimestamp(displayedTime, weather.timezone, { hour: "numeric", minute: "2-digit" }) : `Updated ${formatTimestamp(weather.fetchedAt, weather.timezone, { hour: "numeric", minute: "2-digit" })}`}</span>
            </div>
          </section>

          {weatherAlert && (
            <section className={`weather-alert weather-alert-${weatherAlert.level}`} aria-live="polite">
              <span className="weather-alert-icon">{WeatherAlertIcon && <WeatherAlertIcon size={18} aria-hidden="true" />}</span>
              <div>              <strong>{weatherAlert.level === "calm" ? copy.noSignal : weatherAlert.title}</strong><p>{weatherAlert.detail}</p></div>
              <span className="weather-alert-label">{weatherAlert.level === "important" ? copy.forecastSignal : weatherAlert.level === "caution" ? copy.alertCheck : copy.noAlert}</span>
            </section>
          )}

          <section className="weather-quick-read" aria-label="Weather trend and rain outlook">
            <div className="weather-quick-rain">
              <span className="weather-quick-icon"><Droplets size={17} aria-hidden="true" /></span>
              <span><strong>{sixHourRainChance === null ? "Rain unknown" : sixHourRainChance >= 50 ? copy.rainPossible : copy.lowRain}</strong><small>{formatValue(sixHourRainChance, "%")} · {formatValue(sixHourRainAmount, weather.hourlyUnits.precipitation)} · 6h</small></span>
            </div>
            <div className="weather-quick-trend">
              <span className="weather-quick-icon"><SelectedForecastIcon size={17} aria-hidden="true" /></span>
              <span><strong>{sixHourTempChange === null ? copy.nextHours : sixHourTempChange > 1 ? copy.warmer : sixHourTempChange < -1 ? copy.cooler : copy.steady}</strong><small>{sixHourTempChange === null ? "Hourly trend unavailable" : `${sixHourTempChange > 0 ? "+" : ""}${formatValue(sixHourTempChange, weather.hourlyUnits.temperature_2m)} · 6h`} · {sixHourWindChange === null ? "wind data unavailable" : sixHourWindChange > 2 ? "wind rising" : sixHourWindChange < -2 ? "wind easing" : "wind steady"}</small></span>
            </div>
          </section>

          <section className="weather-glance-grid" aria-label="Weather at a glance">
            <article className="weather-glance-card">
              <span className="weather-glance-icon weather-tone-blue"><Droplets size={18} aria-hidden="true" /></span>
              <div><span>{copy.humidity}</span><strong>{formatValue(currentHumidity, "%")}</strong></div>
              <div className="weather-humidity-meter" role="img" aria-label={`Humidity ${formatValue(currentHumidity, "%")}`}>
                <span style={{ width: `${Math.max(0, Math.min(currentHumidity ?? 0, 100))}%` }} />
              </div>
            </article>
            <article className="weather-glance-card">
              <span className="weather-glance-icon weather-tone-green"><Wind size={18} aria-hidden="true" /></span>
              <div><span>{copy.wind}</span><strong>{formatValue(currentWind, weather.currentUnits.wind_speed_10m)}</strong></div>
              <span className="weather-wind-direction" aria-label={currentWindDirection === null ? "Wind direction not available" : `Wind direction ${Math.round(currentWindDirection)} degrees`}>
                <Compass size={15} style={{ transform: `rotate(${currentWindDirection ?? 0}deg)` }} aria-hidden="true" />
                {currentWindDirection === null ? "—" : `${Math.round(currentWindDirection)}°`}
              </span>
            </article>
            <article className="weather-glance-card">
              <span className="weather-glance-icon weather-tone-sky"><Cloud size={18} aria-hidden="true" /></span>
              <div><span>{copy.cloud}</span><strong>{formatValue(currentCloud, "%")}</strong></div>
              <div className="weather-cloud-meter" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(currentCloud ?? 0, 100))}%` }} /></div>
            </article>
            <article className="weather-glance-card">
              <span className="weather-glance-icon weather-tone-gold"><Sun size={18} aria-hidden="true" /></span>
              <div><span>{copy.uv}</span><strong>{formatValue(currentUv)}</strong></div>
              <span className={`weather-uv-label${currentUv !== null && currentUv >= 6 ? " weather-uv-high" : ""}`}>
                {currentUv === null ? "Unavailable" : currentUv >= 8 ? "Very high" : currentUv >= 6 ? "High" : currentUv >= 3 ? "Moderate" : "Low"}
              </span>
            </article>
          </section>

          <section className="weather-section weather-timeline-section" aria-labelledby="weather-timeline-title">
            <div className="weather-section-heading">
              <div>
                <p className="weather-section-eyebrow">THE DAY AHEAD · ਅਗਲੇ ਘੰਟੇ</p>
                <h3 id="weather-timeline-title">{copy.nextHours}</h3>
              </div>
              <span className="weather-subtle-note">{copy.selectTime}</span>
            </div>

            {timeline.length > 0 ? (
              <>
                <div className="weather-timeline-scroll" aria-label="Scrollable hourly forecast">
                  <div className="weather-timeline-canvas">
                    <svg className="weather-temperature-curve" viewBox="0 0 600 96" preserveAspectRatio="none" role="img" aria-label="Temperature trend over the next six hours">
                      <defs>
                        <linearGradient id="weatherCurveFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#f1b74d" stopOpacity=".24" />
                          <stop offset="100%" stopColor="#f1b74d" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {temperaturePath && <path d={`${temperaturePath} L 576 90 L 24 90 Z`} fill="url(#weatherCurveFill)" />}
                      {temperaturePath && <path d={temperaturePath} fill="none" stroke="#d89b32" strokeWidth="3" strokeLinecap="round" />}
                      {chartPoints.map((point, index) => (
                        <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r={safeSelectedHour === index ? 6 : 4} fill={safeSelectedHour === index ? "#347348" : "#fff"} stroke={safeSelectedHour === index ? "#347348" : "#d89b32"} strokeWidth="3" />
                      ))}
                    </svg>
                    <div className="weather-hour-points">
                      {timeline.map(({ time, index }, pointIndex) => {
                        const code = getSeriesNumber(weather.hourly, "weather_code", index);
                        const periodCondition = getCondition(code, language);
                        const Icon = weatherIcon(periodCondition.kind);
                        const temp = getSeriesNumber(weather.hourly, "temperature_2m", index);
                        const rainChance = getSeriesNumber(weather.hourly, "precipitation_probability", index);
                        const rain = getSeriesNumber(weather.hourly, "precipitation", index);
                        return (
                          <button
                            className={`weather-hour-point${safeSelectedHour === pointIndex ? " is-selected" : ""}`}
                            key={time}
                            type="button"
                            onClick={() => {
                              setSelectedHour(pointIndex);
                              setSelectedHourExplicit(true);
                            }}
                            aria-pressed={safeSelectedHour === pointIndex}
                            aria-label={`${formatTimestamp(time, weather.timezone, { hour: "numeric" })}, ${formatValue(temp, weather.hourlyUnits.temperature_2m)}, ${periodCondition.label}, ${formatValue(rainChance, "%")} rain chance`}
                          >
                            <time dateTime={time}>{formatTimestamp(time, weather.timezone, { hour: "numeric" })}</time>
                            <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
                            <strong>{formatValue(temp, weather.hourlyUnits.temperature_2m)}</strong>
                            <span className="weather-hour-rain"><Droplets size={12} aria-hidden="true" />{formatValue(rainChance, "%")}</span>
                            <span className="weather-hour-amount">{formatValue(rain, weather.hourlyUnits.precipitation)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {selectedForecast && (
                  <div className="weather-hour-detail" aria-live="polite">
                    <span className="weather-hour-detail-icon"><ConditionIcon size={19} aria-hidden="true" /></span>
                    <div>
                      <strong>{formatTimestamp(selectedForecast.time, weather.timezone, { hour: "numeric", minute: "2-digit" })} · {getCondition(getSeriesNumber(weather.hourly, "weather_code", selectedForecast.index), language).label}</strong>
                      <p>
                        {formatValue(getSeriesNumber(weather.hourly, "wind_speed_10m", selectedForecast.index), weather.hourlyUnits.wind_speed_10m)} wind
                        <span aria-hidden="true"> · </span>
                        {formatValue(getSeriesNumber(weather.hourly, "relative_humidity_2m", selectedForecast.index), "%")} humidity
                        <span aria-hidden="true"> · </span>
                        {formatValue(getSeriesNumber(weather.hourly, "precipitation_probability", selectedForecast.index), "%")} rain chance
                      </p>
                    </div>
                    <span className="weather-hour-detail-temp">{formatValue(getSeriesNumber(weather.hourly, "apparent_temperature", selectedForecast.index), weather.hourlyUnits.apparent_temperature)} feels like</span>
                  </div>
                )}
              </>
            ) : <p className="field-forecast-empty">Hourly forecast is not available for this location.</p>}
            {todaySunrise && todaySunset && (
              <div className="weather-daylight" aria-label="Daylight planner based on forecast sunrise and sunset">
                <div className="weather-daylight-copy">
                  <span><Sunrise size={14} aria-hidden="true" /> {formatTimestamp(todaySunrise, weather.timezone, { hour: "numeric", minute: "2-digit" })}</span>
                  <span>Daylight window</span>
                  <span>{formatTimestamp(todaySunset, weather.timezone, { hour: "numeric", minute: "2-digit" })} <Sunset size={14} aria-hidden="true" /></span>
                </div>
                <div className="weather-daylight-track">
                  <span className="weather-daylight-sun" style={{ left: `${daylightProgress ?? 50}%` }}><Sun size={13} aria-hidden="true" /></span>
                  <span className="weather-daylight-current" style={{ left: `${daylightProgress ?? 50}%` }} />
                </div>
                <p>Sun position is a time-of-day guide, not an astronomical calculation.</p>
              </div>
            )}
          </section>

          <section className="weather-section weather-rain-section" aria-labelledby="weather-rain-title">
            <div className="weather-section-heading">
              <div>
                <p className="weather-section-eyebrow">SHORT-TERM OUTLOOK · ਥੋੜ੍ਹੇ ਸਮੇਂ ਦੀ ਬਾਰਿਸ਼</p>
                <h3 id="weather-rain-title">{copy.rainWatch}</h3>
              </div>
              <span className="weather-model-pill">Model forecast · not live radar</span>
            </div>
            {timeline.length > 0 ? (
              <div className="weather-six-hour-rain">
                <div className="weather-rain-chart-heading">
                  <strong>Next 6 hours</strong>
                  <span>Chance and amount are separate</span>
                </div>
                <ol className="weather-six-hour-bars">
                  {timeline.map(({ time, index }, pointIndex) => {
                    const chance = getSeriesNumber(weather.hourly, "precipitation_probability", index);
                    const amount = getSeriesNumber(weather.hourly, "precipitation", index);
                    const periodCode = getSeriesNumber(weather.hourly, "weather_code", index);
                    const Icon = weatherIcon(getCondition(periodCode, language).kind);
                    return (
                      <li className={pointIndex === 0 ? "is-next-hour" : ""} key={time}>
                        <time dateTime={time}>{formatTimestamp(time, weather.timezone, { hour: "numeric" })}</time>
                        <Icon size={16} aria-hidden="true" />
                        <span className="weather-six-hour-bar-track">
                          <span style={{ height: `${Math.max(4, chance ?? 0)}%` }} />
                        </span>
                        <strong>{formatValue(chance, "%")}</strong>
                        <small>{formatValue(amount, weather.hourlyUnits.precipitation)}</small>
                      </li>
                    );
                  })}
                </ol>
                <p className="weather-rain-legend"><span><i /> Rain chance</span><span><Droplets size={12} aria-hidden="true" /> Amount per forecast hour</span></p>
              </div>
            ) : (
              <p className="weather-unavailable-note">Hourly rain data is unavailable for this location.</p>
            )}
            {weather.minutely15 && rainIntervals.length > 0 ? (
              <>
                {rainAvailable ? (
                  <div className="weather-rain-summary">
                    <span className={`weather-rain-summary-icon${totalRain === 0 ? " is-dry" : ""}`}><Droplets size={19} aria-hidden="true" /></span>
                    <div>
                      <strong>{totalRain === 0 ? "No rain forecast in these intervals" : `${formatValue(totalRain, weather.minutely15Units?.rain)} rain in the next ${rainIntervals.length * 15} minutes`}</strong>
                      <p>{totalRain === 0 ? "The model shows dry conditions for this short-term window." : "A model estimate only; actual rainfall may differ."}</p>
                    </div>
                  </div>
                ) : (
                  <p className="weather-unavailable-note">Rain amounts are incomplete for these intervals, so a total is not shown.</p>
                )}
                <ol className="weather-rain-chart" aria-label="15-minute rainfall amounts">
                  {rainIntervals.map(({ time, index }) => {
                    const rain = getSeriesNumber(weather.minutely15!, "rain", index);
                    const precipitation = getSeriesNumber(weather.minutely15!, "precipitation", index);
                    const amount = rain ?? precipitation;
                    const ratio = amount !== null && maxIntervalRain > 0 ? amount / maxIntervalRain : 0;
                    const severity = amount === null ? "unknown" : amount === 0 ? "dry" : amount < 0.5 ? "light" : amount < 2 ? "moderate" : "heavy";
                    return (
                      <li className={`weather-rain-column rain-${severity}`} key={time} aria-label={`${formatTimestamp(time, weather.timezone, { hour: "numeric", minute: "2-digit" })}: ${formatValue(rain, weather.minutely15Units?.rain)} rain`}>
                        <span className="weather-rain-amount">{formatValue(rain, weather.minutely15Units?.rain)}</span>
                        <span className="weather-rain-bar-wrap"><span className="weather-rain-bar" style={{ height: amount === null ? "0%" : `${amount === 0 ? 5 : Math.max(12, ratio * 100)}%` }} /></span>
                        <time dateTime={time}>{formatTimestamp(time, weather.timezone, { hour: "numeric", minute: "2-digit" })}</time>
                      </li>
                    );
                  })}
                </ol>
                <p className="weather-chart-footnote">Each bar is one 15-minute model interval. Forecast timing and amounts are not guaranteed.</p>
              </>
            ) : (
              <div className="weather-rain-empty"><CloudRain size={24} aria-hidden="true" /><p>15-minute rain data is not available for this location. Check the hourly forecast instead.</p></div>
            )}
          </section>

          <section className="weather-field-canvas" aria-label="Selected forecast location">
            <div className="weather-field-canvas-art" aria-hidden="true">
              <span className="weather-field-line weather-field-line-one" />
              <span className="weather-field-line weather-field-line-two" />
              <span className="weather-field-line weather-field-line-three" />
              <span className="weather-field-marker"><MapPin size={20} fill="currentColor" /></span>
            </div>
            <div className="weather-field-caption">
              <span className="weather-glance-icon weather-tone-green"><MapPin size={17} aria-hidden="true" /></span>
              <div><strong>{weather.location}</strong><span>Forecast point · {weather.latitude.toFixed(3)}, {weather.longitude.toFixed(3)}</span></div>
              <span className="weather-local-time">{formatTimestamp(String(weather.current.time), weather.timezone, { hour: "numeric", minute: "2-digit" })}</span>
            </div>
            <p className="weather-chart-footnote">Location-focused view only. No radar or rainfall overlay is shown.</p>
          </section>

          <section className="weather-section weather-insights" aria-labelledby="farm-weather-title">
            <div className="weather-section-heading">
              <div>
                <p className="weather-section-eyebrow">PRACTICAL FIELD NOTES · ਖੇਤ ਲਈ ਸੁਝਾਅ</p>
                <h3 id="farm-weather-title">What this means for your farm</h3>
              </div>
              <Leaf size={20} aria-hidden="true" />
            </div>
            <div className="weather-insight-list">
              {buildFarmInsights(weather).map((insight) => {
                const Icon = insight.icon;
                return (
                  <article className={`weather-insight weather-insight-${insight.tone}`} key={insight.title}>
                    <span className="weather-insight-icon"><Icon size={19} aria-hidden="true" /></span>
                    <div><h4>{insight.title}</h4><p>{insight.description}</p></div>
                  </article>
                );
              })}
            </div>
            <p className="weather-chart-footnote">General weather guidance, not crop-specific or chemical-use advice.</p>
          </section>

          <section className="weather-section weather-activity-section" aria-labelledby="farm-activity-title">
            <div className="weather-section-heading">
              <div><p className="weather-section-eyebrow">A WEATHER-ONLY CHECK · ਮੌਸਮ ਅਨੁਸਾਰ</p><h3 id="farm-activity-title">{copy.farmGuide}</h3></div>
              <Sprout size={19} aria-hidden="true" />
            </div>
            <div className="weather-activity-grid">
              {farmActivities.map((activity) => {
                const Icon = activity.icon;
                const isExpanded = expandedActivity === activity.title;
                return (
                  <button
                    className={`weather-activity weather-activity-${activity.status}${isExpanded ? " is-expanded" : ""}`}
                    type="button"
                    key={activity.title}
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedActivity(isExpanded ? null : activity.title)}
                  >
                    <span className="weather-activity-illustration"><Icon size={25} strokeWidth={1.7} aria-hidden="true" /></span>
                    <strong>{activity.title}</strong>
                    <span className="weather-activity-status"><i aria-hidden="true" />{activity.status === "suitable" ? "Weather looks workable" : activity.status === "caution" ? "Use caution" : activity.status === "unsuitable" ? "Poor weather window" : "Check field conditions"}</span>
                    {isExpanded && <span className="weather-activity-explanation">{activity.explanation}</span>}
                  </button>
                );
              })}
            </div>
            <p className="weather-chart-footnote">Based on forecast weather only: spraying is flagged unsuitable at wind ≥20 km/h, gusts ≥30 km/h, or rain chance ≥50%; harvest is flagged unsuitable at rain chance ≥70% or ≥5 mm expected in 6 hours. These are screening thresholds, not agronomic recommendations or official warnings.</p>
          </section>

          <details className="weather-section weather-daily">
            <summary>
              <span><span className="weather-section-eyebrow">PLAN AHEAD · ਅਗਲੇ ਦਿਨ</span><strong>Daily forecast</strong></span>
              <span>Up to 16 days <span className="weather-disclosure-chevron">⌄</span></span>
            </summary>
            <div className="weather-daily-strip">
              {weather.daily.time.slice(0, 5).map((day, index) => {
                const dayCondition = getCondition(getSeriesNumber(weather.daily, "weather_code", index), language);
                const Icon = weatherIcon(dayCondition.kind);
                return (
                  <article className="weather-day-card" key={day}>
                    <strong>{index === 0 ? "Today" : formatDay(day, weather.timezone)}</strong>
                    <Icon size={20} aria-label={dayCondition.label} />
                    <span className="weather-day-temps">
                      <b>{formatValue(getSeriesNumber(weather.daily, "temperature_2m_max", index), weather.dailyUnits.temperature_2m_max)}</b>
                      <span>{formatValue(getSeriesNumber(weather.daily, "temperature_2m_min", index), weather.dailyUnits.temperature_2m_min)}</span>
                    </span>
                    <span><Droplets size={12} aria-hidden="true" /> {formatValue(getSeriesNumber(weather.daily, "precipitation_probability_max", index), "%")}</span>
                    <span><Wind size={12} aria-hidden="true" /> {formatValue(getSeriesNumber(weather.daily, "wind_speed_10m_max", index), weather.dailyUnits.wind_speed_10m_max)}</span>
                    <span><Droplets size={12} aria-hidden="true" /> {formatValue(getSeriesNumber(weather.daily, "precipitation_sum", index), weather.dailyUnits.precipitation_sum)}</span>
                    <span><Sun size={12} aria-hidden="true" /> UV {formatValue(getSeriesNumber(weather.daily, "uv_index_max", index))}</span>
                    <span><Sunrise size={12} aria-hidden="true" /> {formatTimestamp(getSeriesString(weather.daily, "sunrise", index) ?? "", weather.timezone, { hour: "numeric", minute: "2-digit" })}</span>
                    <span><Sunset size={12} aria-hidden="true" /> {formatTimestamp(getSeriesString(weather.daily, "sunset", index) ?? "", weather.timezone, { hour: "numeric", minute: "2-digit" })}</span>
                  </article>
                );
              })}
            </div>
            <div className="weather-more-days">
              {weather.daily.time.slice(5).map((day, offset) => {
                const index = offset + 5;
                return (
                  <div key={day}>
                    <strong>{formatDay(day, weather.timezone)}</strong>
                    <span>{getCondition(getSeriesNumber(weather.daily, "weather_code", index), language).label}</span>
                    <span>{formatValue(getSeriesNumber(weather.daily, "temperature_2m_min", index), weather.dailyUnits.temperature_2m_min)} / {formatValue(getSeriesNumber(weather.daily, "temperature_2m_max", index), weather.dailyUnits.temperature_2m_max)}</span>
                    <span>{formatValue(getSeriesNumber(weather.daily, "precipitation_probability_max", index), "%")} rain chance</span>
                  </div>
                );
              })}
            </div>
          </details>

          <details className="weather-section weather-detailed">
            <summary>
              <span><span className="weather-section-eyebrow">FOR THOSE WHO WANT MORE</span><strong>Detailed weather</strong></span>
              <span>Soil · sun · air <span className="weather-disclosure-chevron">⌄</span></span>
            </summary>
            <label className="field-weather-range" htmlFor="weather-explorer-range">
              Forecast range
              <select id="weather-explorer-range" value={explorerHours} onChange={(event) => setExplorerHours(Number(event.target.value))}>
                <option value={6}>6 hours</option>
                <option value={24}>24 hours</option>
                <option value={72}>3 days</option>
                <option value={168}>7 days</option>
                <option value={384}>16 days</option>
              </select>
            </label>
            <div className="weather-detail-groups">
              {detailGroups.map((group) => (
                <details key={group.title}>
                  <summary>{group.title}</summary>
                  <div className="weather-detail-grid">
                    {group.fields.map(([label, key]) => {
                      const values = weather.hourly[key];
                      if (!Array.isArray(values)) return null;
                      return (
                        <article key={key}>
                          <strong>{label}</strong>
                          <span>{weather.hourlyUnits[key] || "Forecast"}</span>
                          <div>{detailedTimes.map(({ time, index }) => (
                            <span key={time}><time dateTime={time}>{formatTimestamp(time, weather.timezone, { hour: "numeric" })}</time><b>{formatValue(values[index])}</b></span>
                          ))}</div>
                        </article>
                      );
                    })}
                  </div>
                </details>
              ))}
              <details>
                <summary>Current conditions</summary>
                <div className="weather-current-detail-grid">
                  {Object.entries(weather.current).map(([key, value]) => (
                    <span key={key}><b>{key.replaceAll("_", " ")}</b>{formatValue(value, weather.currentUnits[key])}</span>
                  ))}
                </div>
              </details>
              <article className="weather-detail-note">
                <Gauge size={17} aria-hidden="true" />
                <p>Soil moisture and evapotranspiration are model estimates. Compare them with field observations before making irrigation decisions.</p>
              </article>
            </div>
          </details>

          <p className="field-weather-attribution">
            Forecast by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>.
            Model coverage and variable availability depend on location.
          </p>
          <p className="weather-timestamp">
            <Eye size={13} aria-hidden="true" />
            Local time: {weather.timezone} · Coordinates: {weather.latitude.toFixed(3)}, {weather.longitude.toFixed(3)}
          </p>
        </div>
      ) : (
        <div className="field-weather-empty">
          <div className="field-weather-empty-main">
            <span className="field-weather-empty-icon" aria-hidden="true"><Sun size={27} /></span>
            <div>
              <h2 id="field-weather-title">Weather near your fields</h2>
              <p>Choose a location to see local conditions and forecasts.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
