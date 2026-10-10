export type WeatherValue = number | string | null;

export type WeatherSeries = { time: string[] } & Record<string, WeatherValue[]>;
export type WeatherUnits = Record<string, string>;

export type WeatherData = {
  location: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  timezoneAbbreviation: string;
  fetchedAt: string;
  current: Record<string, WeatherValue>;
  currentUnits: WeatherUnits;
  minutely15: WeatherSeries | null;
  minutely15Units: WeatherUnits | null;
  hourly: WeatherSeries;
  hourlyUnits: WeatherUnits;
  daily: WeatherSeries;
  dailyUnits: WeatherUnits;
};

export type WeatherLocation = {
  id: number;
  name: string;
  admin1: string;
  country: string;
  latitude: number;
  longitude: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isWeatherSeries(value: unknown): value is WeatherSeries {
  if (!isRecord(value) || !Array.isArray(value.time) || !value.time.every((item) => typeof item === "string")) {
    return false;
  }

  const length = value.time.length;
  return Object.entries(value).every(([key, column]) =>
    Array.isArray(column) &&
    column.length === length &&
    (key === "time"
      ? column.every((item) => typeof item === "string")
      : column.every((item) =>
        item === null ||
        typeof item === "string" ||
        (typeof item === "number" && Number.isFinite(item)),
      )),
  );
}

function isWeatherUnits(value: unknown): value is WeatherUnits {
  return isRecord(value) && Object.values(value).every((unit) => typeof unit === "string");
}

export function isWeatherData(value: unknown): value is WeatherData {
  if (!isRecord(value) || !isRecord(value.current)) return false;
  if (
    typeof value.location !== "string" ||
    typeof value.country !== "string" ||
    typeof value.latitude !== "number" ||
    typeof value.longitude !== "number" ||
    typeof value.timezone !== "string" ||
    typeof value.timezoneAbbreviation !== "string" ||
    typeof value.fetchedAt !== "string"
  ) {
    return false;
  }

  const currentIsValid = Object.values(value.current).every((entry) =>
    entry === null ||
    typeof entry === "string" ||
    (typeof entry === "number" && Number.isFinite(entry)),
  );

  return currentIsValid &&
    typeof value.current.time === "string" &&
    typeof value.current.temperature_2m === "number" &&
    typeof value.current.weather_code === "number" &&
    isWeatherUnits(value.currentUnits) &&
    (value.minutely15 === null || isWeatherSeries(value.minutely15)) &&
    (value.minutely15Units === null || isWeatherUnits(value.minutely15Units)) &&
    isWeatherSeries(value.hourly) &&
    isWeatherUnits(value.hourlyUnits) &&
    isWeatherSeries(value.daily) &&
    isWeatherUnits(value.dailyUnits);
}
