import { NextRequest, NextResponse } from "next/server";

const CURRENT_VARIABLES = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "is_day",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "weather_code",
  "cloud_cover",
  "surface_pressure",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
].join(",");

const HOURLY_VARIABLES = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "dew_point_2m",
  "precipitation_probability",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "weather_code",
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "surface_pressure",
  "visibility",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "evapotranspiration",
  "et0_fao_evapotranspiration",
  "vapour_pressure_deficit",
  "soil_temperature_0cm",
  "soil_temperature_6cm",
  "soil_temperature_18cm",
  "soil_temperature_54cm",
  "soil_moisture_0_to_1cm",
  "soil_moisture_1_to_3cm",
  "soil_moisture_3_to_9cm",
  "soil_moisture_9_to_27cm",
  "soil_moisture_27_to_81cm",
  "shortwave_radiation",
  "direct_radiation",
  "diffuse_radiation",
  "sunshine_duration",
  "uv_index",
  "uv_index_clear_sky",
  "freezing_level_height",
].join(",");

const DAILY_VARIABLES = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "sunrise",
  "sunset",
  "daylight_duration",
  "sunshine_duration",
  "uv_index_max",
  "precipitation_sum",
  "rain_sum",
  "showers_sum",
  "snowfall_sum",
  "precipitation_hours",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
].join(",");

const MINUTELY_VARIABLES = "precipitation,rain";

type JsonRecord = Record<string, unknown>;
type WeatherValue = number | string | null;
type WeatherSeries = Record<string, WeatherValue[]>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeUnits(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function normalizeCurrent(value: unknown): Record<string, WeatherValue> {
  if (!isRecord(value)) throw new Error("Open-Meteo returned invalid current conditions.");
  const current: Record<string, WeatherValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "time" && typeof entry === "number" && Number.isFinite(entry)) {
      current[key] = new Date(entry * 1000).toISOString();
    } else if (key === "time" && typeof entry === "string") {
      current[key] = entry;
    } else if (entry === null || (typeof entry === "number" && Number.isFinite(entry))) {
      current[key] = entry;
    } else {
      throw new Error(`Open-Meteo returned an invalid current value for ${key}.`);
    }
  }
  if (
    typeof current.time !== "string" ||
    typeof current.temperature_2m !== "number" ||
    typeof current.weather_code !== "number"
  ) {
    throw new Error("Open-Meteo current conditions are incomplete.");
  }
  return current;
}

function normalizeSeries(value: unknown, sectionName: string, required: string[]): WeatherSeries {
  if (
    !isRecord(value) ||
    !Array.isArray(value.time) ||
    !value.time.every((item) =>
      typeof item === "string" || (typeof item === "number" && Number.isFinite(item)),
    )
  ) {
    throw new Error(`Open-Meteo returned invalid ${sectionName} forecast timestamps.`);
  }

  const times = value.time.map((item) => {
    if (typeof item === "number" && Number.isFinite(item)) return new Date(item * 1000).toISOString();
    if (typeof item === "string") return item;
    throw new Error(`Open-Meteo returned invalid ${sectionName} forecast timestamps.`);
  });
  const series: WeatherSeries = { time: times };
  for (const key of required) {
    const column = value[key];
    if (
      !Array.isArray(column) ||
      column.length !== times.length ||
      !column.every((item) => item === null || (typeof item === "number" && Number.isFinite(item)))
    ) {
      throw new Error(`Open-Meteo returned incomplete ${sectionName} forecast data for ${key}.`);
    }
  }

  for (const [key, column] of Object.entries(value)) {
    if (key === "time") continue;
    const isSunriseOrSunset = sectionName === "daily" && (key === "sunrise" || key === "sunset");
    if (
      !Array.isArray(column) ||
      column.length !== times.length ||
      !column.every((item) =>
        item === null ||
        (isSunriseOrSunset && typeof item === "string") ||
        (typeof item === "number" && Number.isFinite(item)),
      )
    ) {
      throw new Error(`Open-Meteo returned invalid ${sectionName} forecast data for ${key}.`);
    }
    series[key] = key === "sunrise" || key === "sunset"
      ? column.map((item) => {
        if (typeof item === "number" && Number.isFinite(item)) return new Date(item * 1000).toISOString();
        if (typeof item === "string" || item === null) return item;
        throw new Error(`Open-Meteo returned invalid ${sectionName} forecast data for ${key}.`);
      })
      : column;
  }
  return series;
}

function openMeteoUrl(latitude: number, longitude: number, withMinutely: boolean) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: CURRENT_VARIABLES,
    hourly: HOURLY_VARIABLES,
    daily: DAILY_VARIABLES,
    forecast_days: "16",
    timezone: "auto",
    timeformat: "unixtime",
  });
  if (withMinutely) {
    params.set("minutely_15", MINUTELY_VARIABLES);
    params.set("forecast_minutely_15", "12");
  }
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

async function readOpenMeteoResponse(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawLatitude = searchParams.get("lat");
  const rawLongitude = searchParams.get("lon");
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);

  if (
    rawLatitude === null ||
    rawLongitude === null ||
    !rawLatitude.trim() ||
    !rawLongitude.trim() ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json({ error: "A valid location is required." }, { status: 400 });
  }

  try {
    let response = await fetch(openMeteoUrl(latitude, longitude, true), {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(15000),
    });
    let payload = await readOpenMeteoResponse(response);

    if (!response.ok && isRecord(payload) && typeof payload.reason === "string" && /minutely.?15|15.?minute/i.test(payload.reason)) {
      response = await fetch(openMeteoUrl(latitude, longitude, false), {
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(15000),
      });
      payload = await readOpenMeteoResponse(response);
    }

    if (!response.ok) {
      console.error("Open-Meteo forecast returned HTTP", response.status);
      return NextResponse.json({ error: "Weather could not be loaded. Please try again." }, { status: 502 });
    }
    if (!isRecord(payload)) throw new Error("Open-Meteo returned an invalid forecast response.");

    const current = normalizeCurrent(payload.current);
    const hourly = normalizeSeries(payload.hourly, "hourly", ["temperature_2m", "weather_code"]);
    const daily = normalizeSeries(payload.daily, "daily", ["temperature_2m_max", "temperature_2m_min"]);
    const minutely15 = payload.minutely_15 === undefined
      ? null
      : normalizeSeries(payload.minutely_15, "15-minute", ["precipitation", "rain"]);

    if (
      typeof payload.latitude !== "number" ||
      typeof payload.longitude !== "number" ||
      typeof payload.timezone !== "string" ||
      typeof payload.timezone_abbreviation !== "string"
    ) {
      throw new Error("Open-Meteo returned incomplete location or timezone information.");
    }

    const name = searchParams.get("name")?.trim().slice(0, 100);
    const country = searchParams.get("country")?.trim().slice(0, 80);
    return NextResponse.json({
      location: name || "Your selected location",
      country: country || "",
      latitude: payload.latitude,
      longitude: payload.longitude,
      timezone: payload.timezone,
      timezoneAbbreviation: payload.timezone_abbreviation,
      fetchedAt: new Date().toISOString(),
      current,
      currentUnits: normalizeUnits(payload.current_units),
      minutely15,
      minutely15Units: minutely15 ? normalizeUnits(payload.minutely_15_units) : null,
      hourly,
      hourlyUnits: normalizeUnits(payload.hourly_units),
      daily,
      dailyUnits: normalizeUnits(payload.daily_units),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Open-Meteo forecast request failed:", error);
    return NextResponse.json({ error: "Weather could not be loaded. Please try again." }, { status: 502 });
  }
}
