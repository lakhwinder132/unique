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
  MapPin,
  Moon,
  RefreshCw,
  Search,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  isWeatherData,
  type WeatherData,
  type WeatherLocation,
  type WeatherSeries,
  type WeatherValue,
} from "../services/weather";
import "./weather-home.css";

type WeatherWidgetProps = {
  onWeatherLoaded: (weather: WeatherData) => void;
  onAskAssistant: (question: string) => void;
  language?: string;
};

type SelectedPlace = {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
};

type ConditionKind = "clear" | "cloudy" | "fog" | "rain" | "storm" | "snow" | "unknown";
type Condition = { label: string; kind: ConditionKind; icon: LucideIcon };

function getCondition(code: number | null, language: string): Condition {
  const descriptions: Record<number, { en: string; pa: string; hi: string; kind: ConditionKind; icon: LucideIcon }> = {
    0: { en: "Clear sky", pa: "ਸਾਫ਼ ਅਸਮਾਨ", hi: "साफ़ आसमान", kind: "clear", icon: Sun },
    1: { en: "Mostly clear", pa: "ਜ਼ਿਆਦਾਤਰ ਸਾਫ਼", hi: "अधिकतर साफ़", kind: "clear", icon: Sun },
    2: { en: "Partly cloudy", pa: "ਥੋੜ੍ਹੇ ਬੱਦਲ", hi: "आंशिक बादल", kind: "cloudy", icon: CloudSun },
    3: { en: "Overcast", pa: "ਬੱਦਲਵਾਈ", hi: "बादल छाए", kind: "cloudy", icon: Cloud },
    45: { en: "Foggy", pa: "ਧੁੰਦ", hi: "कोहरा", kind: "fog", icon: CloudFog },
    48: { en: "Foggy", pa: "ਧੁੰਦ", hi: "कोहरा", kind: "fog", icon: CloudFog },
    51: { en: "Light drizzle", pa: "ਹਲਕੀ ਫੁਹਾਰ", hi: "हल्की बूंदाबांदी", kind: "rain", icon: CloudDrizzle },
    53: { en: "Drizzle", pa: "ਫੁਹਾਰ", hi: "बूंदाबांदी", kind: "rain", icon: CloudDrizzle },
    55: { en: "Heavy drizzle", pa: "ਤੇਜ਼ ਫੁਹਾਰ", hi: "तेज़ बूंदाबांदी", kind: "rain", icon: CloudDrizzle },
    56: { en: "Freezing drizzle", pa: "ਜੰਮਦੀ ਫੁਹਾਰ", hi: "जमने वाली बूंदाबांदी", kind: "rain", icon: CloudDrizzle },
    57: { en: "Freezing drizzle", pa: "ਜੰਮਦੀ ਫੁਹਾਰ", hi: "जमने वाली बूंदाबांदी", kind: "rain", icon: CloudDrizzle },
    61: { en: "Light rain", pa: "ਹਲਕਾ ਮੀਂਹ", hi: "हल्की बारिश", kind: "rain", icon: CloudRain },
    63: { en: "Rain", pa: "ਮੀਂਹ", hi: "बारिश", kind: "rain", icon: CloudRain },
    65: { en: "Heavy rain", pa: "ਤੇਜ਼ ਮੀਂਹ", hi: "तेज़ बारिश", kind: "rain", icon: CloudRain },
    66: { en: "Freezing rain", pa: "ਜੰਮਦਾ ਮੀਂਹ", hi: "जमने वाली बारिश", kind: "rain", icon: CloudRain },
    67: { en: "Freezing rain", pa: "ਜੰਮਦਾ ਮੀਂਹ", hi: "जमने वाली बारिश", kind: "rain", icon: CloudRain },
    71: { en: "Light snow", pa: "ਹਲਕੀ ਬਰਫ਼", hi: "हल्की बर्फ़", kind: "snow", icon: CloudSnow },
    73: { en: "Snow", pa: "ਬਰਫ਼", hi: "बर्फ़", kind: "snow", icon: CloudSnow },
    75: { en: "Heavy snow", pa: "ਤੇਜ਼ ਬਰਫ਼", hi: "तेज़ बर्फ़", kind: "snow", icon: CloudSnow },
    77: { en: "Snow grains", pa: "ਬਰਫ਼ ਦੇ ਕਣ", hi: "बर्फ़ के कण", kind: "snow", icon: CloudSnow },
    80: { en: "Light showers", pa: "ਹਲਕੀਆਂ ਫੁਹਾਰਾਂ", hi: "हल्की बौछारें", kind: "rain", icon: CloudRain },
    81: { en: "Rain showers", pa: "ਮੀਂਹ ਦੀਆਂ ਫੁਹਾਰਾਂ", hi: "बारिश की बौछारें", kind: "rain", icon: CloudRain },
    82: { en: "Heavy showers", pa: "ਤੇਜ਼ ਮੀਂਹ ਦੀਆਂ ਫੁਹਾਰਾਂ", hi: "तेज़ बारिश की बौछारें", kind: "rain", icon: CloudRain },
    85: { en: "Snow showers", pa: "ਬਰਫ਼ ਦੀਆਂ ਫੁਹਾਰਾਂ", hi: "बर्फ़ की बौछारें", kind: "snow", icon: CloudSnow },
    86: { en: "Heavy snow showers", pa: "ਤੇਜ਼ ਬਰਫ਼ ਦੀਆਂ ਫੁਹਾਰਾਂ", hi: "तेज़ बर्फ़ की बौछारें", kind: "snow", icon: CloudSnow },
    95: { en: "Thunderstorm", pa: "ਗਰਜ-ਤੂਫ਼ਾਨ", hi: "गरज-तूफ़ान", kind: "storm", icon: CloudLightning },
    96: { en: "Thunderstorm with hail", pa: "ਗੜੇਮਾਰੀ ਨਾਲ ਤੂਫ਼ਾਨ", hi: "ओलों के साथ तूफ़ान", kind: "storm", icon: CloudLightning },
    99: { en: "Thunderstorm with hail", pa: "ਗੜੇਮਾਰੀ ਨਾਲ ਤੂਫ਼ਾਨ", hi: "ओलों के साथ तूफ़ान", kind: "storm", icon: CloudLightning },
  };
  const known = code === null ? undefined : descriptions[code];
  if (!known) {
    return {
      label: language === "pa" ? "ਮੌਸਮ ਦੀ ਜਾਣਕਾਰੀ ਨਹੀਂ" : language === "hi" ? "मौसम की जानकारी उपलब्ध नहीं" : "Conditions unavailable",
      kind: "unknown",
      icon: Cloud,
    };
  }
  return { label: known[language === "pa" ? "pa" : language === "hi" ? "hi" : "en"], kind: known.kind, icon: known.icon };
}

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

function formatTime(value: string, timezone: string, language: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "pa" ? "pa-IN" : language === "hi" ? "hi-IN" : "en-IN", {
    timeZone: timezone,
    hour: "numeric",
  }).format(date);
}

function formatTemperature(value: number | null, unit: string | undefined) {
  if (value === null) return "—";
  const rounded = Math.round(value);
  return `${rounded}°${unit?.includes("F") ? "F" : "C"}`;
}

function FarmLandscape({ kind, isDay, isNight }: { kind: ConditionKind; isDay: boolean; isNight: boolean }) {
  return (
    <svg className="weather-landscape" viewBox="0 0 1440 650" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="farm-sky" x2="0" y2="1">
          <stop offset="0" stopColor="var(--scene-sky-top)" />
          <stop offset="1" stopColor="var(--scene-sky-bottom)" />
        </linearGradient>
        <linearGradient id="farm-field" x2="0" y2="1">
          <stop offset="0" stopColor="var(--scene-field-top)" />
          <stop offset="1" stopColor="var(--scene-field-bottom)" />
        </linearGradient>
        <linearGradient id="farm-haze" x2="0" y2="1">
          <stop offset="0" stopColor="var(--scene-haze)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--scene-haze)" stopOpacity=".7" />
        </linearGradient>
      </defs>

      <rect width="1440" height="650" fill="url(#farm-sky)" />

      {isDay && kind === "clear" && (
        <g className="weather-sun">
          <circle cx="1112" cy="151" r="78" fill="#ffe9a7" opacity=".18" />
          <circle cx="1112" cy="151" r="49" fill="#fff1bd" />
          <circle cx="1112" cy="151" r="37" fill="#fff9dc" />
        </g>
      )}
      {isNight && (
        <g className="weather-moon">
          <circle cx="1115" cy="145" r="34" fill="#f9efc8" />
          <circle cx="1129" cy="132" r="34" fill="var(--scene-sky-top)" />
        </g>
      )}
      {isNight && kind !== "cloudy" && kind !== "rain" && kind !== "storm" && kind !== "fog" && (
        <g className="weather-stars" fill="#f8f1cf">
          <circle cx="920" cy="93" r="2" /><circle cx="1044" cy="70" r="2" /><circle cx="1228" cy="94" r="2" />
          <circle cx="1300" cy="176" r="1.7" /><circle cx="975" cy="204" r="1.5" /><circle cx="1163" cy="54" r="1.5" />
        </g>
      )}

      {(kind === "cloudy" || kind === "fog" || kind === "rain" || kind === "storm") && (
        <g className="weather-clouds" fill="var(--scene-cloud)" opacity={kind === "storm" ? ".86" : ".78"}>
          <path d="M742 205c0-28 23-51 51-51 17-41 75-48 102-11 37-10 74 18 74 57 0 30-24 54-55 54H798c-31 0-56-21-56-49Z" />
          <path d="M1015 271c0-20 16-36 36-36 12-29 53-34 72-8 26-7 52 13 52 40 0 21-17 38-39 38h-81c-22 0-40-15-40-34Z" opacity=".55" />
        </g>
      )}

      <path d="M0 370c151-69 286-62 412-20 147 49 250 38 370-5 126-45 248-53 361-9 108 43 199 46 297 10v151H0Z" fill="var(--scene-hill-back)" />
      <path d="M0 405c160-51 297-36 445 9 122 38 225 30 363-16 151-50 258-45 386 0 94 33 167 27 246 3v118H0Z" fill="var(--scene-hill-front)" />
      <path d="M0 445c198-31 327 16 500 41 157 23 291-22 453-38 193-19 335 35 487 10v192H0Z" fill="url(#farm-field)" />

      <g className="farmhouse" fill="var(--scene-house)">
        <path d="M1019 367h101v64h-101z" />
        <path d="m1008 368 61-42 63 42Z" fill="var(--scene-roof)" />
        <path d="M1037 387h19v29h-19zM1083 383h23v18h-23z" fill="var(--scene-window)" />
        <path d="M1155 388h5v47h-5zM1139 397c1-21 14-30 18-31 5 11 4 23-1 34Z" fill="var(--scene-tree)" />
        <path d="M1173 405h5v32h-5zM1171 400c-7-11-2-24 5-29 10 8 11 21 3 31Z" fill="var(--scene-tree)" />
      </g>

      <rect y="363" width="1440" height="114" fill="url(#farm-haze)" />

      <g className="field-rows" fill="none" stroke="var(--scene-row)" strokeWidth="3" opacity=".32">
        <path d="M-90 650 400 439" /><path d="M65 650 478 443" /><path d="M225 650 555 447" />
        <path d="M1370 650 1000 442" /><path d="M1525 650 1080 444" /><path d="M1680 650 1160 448" />
      </g>
      <g className="crop-stalks" fill="none" stroke="var(--scene-crop)" strokeLinecap="round">
        <path d="M78 652q-7-65 1-125m0 28-17-19m18 4 17-20m-18 47-19-14m18 1 19-17" />
        <path d="M157 652q8-72-3-143m1 32 20-20m-20 4-18-24m19 57 20-16m-21 0-17-20" />
        <path d="M250 652q-3-58 6-115m-3 29-19-19m21 1 15-17m-15 42 19-13" />
        <path d="M1310 652q9-79-2-151m0 33 22-23m-22 4-19-26m21 61 22-19m-22 0-18-20" />
        <path d="M1400 652q-5-62 5-124m-3 28-18-18m21 1 17-21m-18 48 19-15" />
      </g>

      {kind === "rain" && (
        <g className="weather-rain" stroke="#d8f1f2" strokeWidth="3" strokeLinecap="round" opacity=".66">
          <path d="m829 313-13 33m64-47-12 32m57-16-13 34m-141-7-12 32m245-22-13 34m-91 8-13 34m-76-4-13 35m220-43-12 33m-117 20-13 34m-188-36-12 32m294-11-12 33m-65-19-12 33" />
        </g>
      )}
      {kind === "storm" && (
        <path className="weather-lightning" d="m946 285-31 54h25l-16 37 55-63h-28l16-28Z" fill="#ffe28a" />
      )}
      {kind === "snow" && (
        <g className="weather-snow" fill="#fff" opacity=".82">
          <circle cx="828" cy="326" r="3" /><circle cx="912" cy="348" r="3" /><circle cx="1022" cy="311" r="3" />
          <circle cx="1081" cy="357" r="2.5" /><circle cx="875" cy="388" r="2.5" /><circle cx="980" cy="365" r="3" />
        </g>
      )}
      {kind === "fog" && (
        <g className="weather-fog" fill="none" stroke="#f1f5ed" strokeWidth="15" strokeLinecap="round" opacity=".42">
          <path d="M280 397h770M440 430h850M180 465h710" />
        </g>
      )}
    </svg>
  );
}

export default function WeatherWidget({ onWeatherLoaded, onAskAssistant, language = "en" }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [locations, setLocations] = useState<WeatherLocation[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const refreshCallback = useRef<(place: SelectedPlace) => void>(() => undefined);
  const copy = language === "pa"
    ? {
      searchPlaceholder: "ਪਿੰਡ ਜਾਂ ਸ਼ਹਿਰ ਲੱਭੋ",
      search: "ਲੱਭੋ",
      useLocation: "ਮੇਰੀ ਥਾਂ",
      loading: "ਮੌਸਮ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…",
      locationPrompt: "ਆਪਣੇ ਖੇਤ ਦਾ ਮੌਸਮ ਵੇਖੋ",
      locationHint: "ਨੇੜਲਾ ਪਿੰਡ ਲੱਭੋ ਜਾਂ ਆਪਣੀ ਥਾਂ ਵਰਤੋ",
      noLocation: "ਆਪਣੇ ਖੇਤ ਦਾ ਮੌਸਮ",
      forecast: "ਅਗਲੇ ਘੰਟੇ",
      rain: "ਮੀਂਹ",
      ask: "ਖੇਤੀਬਾੜੀ ਸਹਾਇਕ ਨੂੰ ਪੁੱਛੋ",
      refresh: "ਮੌਸਮ ਮੁੜ ਲੋਡ ਕਰੋ",
      noForecast: "ਘੰਟਾਵਾਰ ਅਨੁਮਾਨ ਉਪਲਬਧ ਨਹੀਂ",
    }
    : language === "hi"
      ? {
        searchPlaceholder: "गाँव या शहर खोजें",
        search: "खोजें",
        useLocation: "मेरी जगह",
        loading: "मौसम लोड हो रहा है…",
        locationPrompt: "अपने खेत का मौसम देखें",
        locationHint: "पास का गाँव खोजें या अपनी जगह का उपयोग करें",
        noLocation: "आपके खेत का मौसम",
        forecast: "अगले घंटे",
        rain: "बारिश",
        ask: "खेती सहायक से पूछें",
        refresh: "मौसम फिर से लोड करें",
        noForecast: "घंटेवार पूर्वानुमान उपलब्ध नहीं",
      }
      : {
        searchPlaceholder: "Find your village or town",
        search: "Search",
        useLocation: "My location",
        loading: "Loading local weather…",
        locationPrompt: "See the weather over your fields",
        locationHint: "Find a nearby village or use your current location",
        noLocation: "Weather for your field",
        forecast: "Coming hours",
        rain: "Rain",
        ask: "Ask your farming assistant",
        refresh: "Refresh local weather",
        noForecast: "Hourly forecast is not available for this location.",
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
  });

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
    requestController.current = null;
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
  const currentCode = weather ? getNumber(weather.current, "weather_code") : null;
  const condition = getCondition(currentCode, language);
  const isDay = weather ? getNumber(weather.current, "is_day") === 1 : false;
  const isNight = weather ? getNumber(weather.current, "is_day") === 0 : false;
  const conditionIcon = condition.icon;
  const upcomingHours = weather
    ? weather.hourly.time
      .map((time, index) => ({ time, index }))
      .filter(({ time }) => Date.parse(time) >= Date.parse(String(weather.current.time)))
      .slice(0, 6)
    : [];
  const locationName = weather
    ? [weather.location, weather.country].filter(Boolean).join(", ")
    : "";

  const assistantQuestion = language === "pa"
    ? "ਅੱਜ ਦੇ ਮੌਸਮ ਅਤੇ ਅਗਲੇ ਕੁਝ ਘੰਟਿਆਂ ਵਿੱਚ ਮੀਂਹ ਦੀ ਸੰਭਾਵਨਾ ਦੇ ਆਧਾਰ 'ਤੇ, ਫ਼ਸਲ ਦੀ ਸਿੰਚਾਈ ਅਤੇ ਖੇਤੀ ਦੇ ਕੰਮ ਲਈ ਮੈਨੂੰ ਕੀ ਧਿਆਨ ਰੱਖਣਾ ਚਾਹੀਦਾ ਹੈ?"
    : language === "hi"
      ? "आज के मौसम और अगले कुछ घंटों में बारिश की संभावना के आधार पर, फसल की सिंचाई और खेत के काम के लिए मुझे किन बातों का ध्यान रखना चाहिए?"
      : "Based on the local weather and rain chances over the next few hours, what should I consider for crop irrigation and field work today?";

  return (
    <section className="weather-home" aria-label="Local farm weather">
      <div className="weather-home-toolbar">
        <form className="weather-home-search" onSubmit={searchLocations} role="search">
          <label className="weather-visually-hidden" htmlFor="weather-location">{copy.searchPlaceholder}</label>
          <MapPin size={17} aria-hidden="true" />
          <input
            id="weather-location"
            value={locationQuery}
            onChange={(event) => setLocationQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            maxLength={80}
            autoComplete="off"
          />
          <button type="submit" disabled={loading} aria-label={copy.search} title={copy.search}>
            <Search size={17} aria-hidden="true" />
          </button>
          {weather && selectedPlace && (
            <button
              className="weather-home-refresh"
              type="button"
              onClick={() => void loadWeather(selectedPlace)}
              disabled={loading}
              aria-label={copy.refresh}
              title={copy.refresh}
            >
              <RefreshCw size={15} aria-hidden="true" />
            </button>
          )}
        </form>
        <button className="weather-home-location" type="button" onClick={useMyLocation} disabled={loading}>
          <Compass size={16} aria-hidden="true" />
          <span>{copy.useLocation}</span>
        </button>
      </div>

      {locations.length > 0 && (
        <ul className="weather-home-locations" aria-label="Location search results">
          {locations.map((location) => {
            const place = {
              name: location.name,
              country: location.country,
              latitude: location.latitude,
              longitude: location.longitude,
            };
            return (
              <li key={location.id}>
                <button type="button" disabled={loading} onClick={() => {
                  setLocationQuery([location.name, location.admin1].filter(Boolean).join(", "));
                  setLocations([]);
                  void loadWeather(place);
                }}>
                  <span>{location.name}</span>
                  <small>{[location.admin1, location.country].filter(Boolean).join(", ")}</small>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="weather-home-error" role="alert">{error}</p>}
      {loading && <p className="weather-home-loading" role="status">{copy.loading}</p>}

      <div className={`weather-home-scene weather-scene--${condition.kind}${isNight ? " weather-scene--night" : ""}`} role="group" aria-label={weather ? `${locationName}: ${condition.label}, ${formatTemperature(currentTemperature, weather.currentUnits.temperature_2m)}` : "Illustrated Punjabi farm landscape"}>
        <FarmLandscape kind={condition.kind} isDay={isDay} isNight={isNight} />
        <div className="weather-scene-shade" />
        <div className="weather-scene-copy">
          {weather ? (
            <>
              <p className="weather-scene-location"><MapPin size={15} aria-hidden="true" />{locationName || weather.location}</p>
              <p className="weather-scene-temperature">{formatTemperature(currentTemperature, weather.currentUnits.temperature_2m)}</p>
              <p className="weather-scene-condition">
                {conditionIcon === Sun ? <Sun size={17} aria-hidden="true" /> : (() => {
                  const Icon = conditionIcon;
                  return <Icon size={17} aria-hidden="true" />;
                })()}
                {condition.label}
              </p>
            </>
          ) : (
            <>
              <p className="weather-scene-location"><MapPin size={15} aria-hidden="true" />{copy.noLocation}</p>
              <p className="weather-scene-empty-title">{copy.locationPrompt}</p>
              <p className="weather-scene-empty-hint">{copy.locationHint}</p>
            </>
          )}
        </div>
        {isNight && <Moon className="weather-scene-moon-icon" size={24} aria-hidden="true" />}
        {weather && upcomingHours.length > 0 && (
          <div className="weather-scene-forecast">
            <div className="weather-forecast-heading">
              <span>{copy.forecast}</span>
              <span className="weather-forecast-place">{locationName}</span>
            </div>
            <ol className="weather-forecast-list">
              {upcomingHours.map(({ time, index }) => {
                const hourCondition = getCondition(getSeriesNumber(weather.hourly, "weather_code", index), language);
                const HourIcon = hourCondition.icon;
                const temperature = getSeriesNumber(weather.hourly, "temperature_2m", index);
                const rain = getSeriesNumber(weather.hourly, "precipitation_probability", index);
                return (
                  <li key={time} aria-label={`${formatTime(time, weather.timezone, language)}, ${hourCondition.label}, ${formatTemperature(temperature, weather.hourlyUnits.temperature_2m)}${rain === null ? "" : `, ${copy.rain} ${Math.round(rain)}%`}`}>
                    <time dateTime={time}>{formatTime(time, weather.timezone, language)}</time>
                    <HourIcon size={19} aria-hidden="true" />
                    <strong>{formatTemperature(temperature, weather.hourlyUnits.temperature_2m)}</strong>
                    {rain !== null && <span className="weather-forecast-rain">{copy.rain} {Math.round(rain)}%</span>}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        {weather && upcomingHours.length === 0 && (
          <p className="weather-forecast-empty">{copy.noForecast}</p>
        )}
      </div>

      <button
        className="weather-assistant-action"
        type="button"
        onClick={() => onAskAssistant(assistantQuestion)}
      >
        <span>{copy.ask}</span>
        <span className="weather-assistant-arrow" aria-hidden="true">↗</span>
      </button>
    </section>
  );
}
