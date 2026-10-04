import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawLatitude = searchParams.get("lat");
  const rawLongitude = searchParams.get("lon");
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);

  if (
    rawLatitude === null ||
    rawLongitude === null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json({ error: "A valid location is required." }, { status: 400 });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Weather service is not configured." }, { status: 503 });
  }

  try {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      appid: apiKey,
      units: "metric",
    });
    const [response, forecastResponse] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?${params}`, { cache: "no-store" }),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?${params}`, { cache: "no-store" }),
    ]);

    if (!response.ok || !forecastResponse.ok) {
      return NextResponse.json({ error: "Weather could not be loaded. Please try again." }, { status: 502 });
    }

    const [data, forecastData] = await Promise.all([response.json(), forecastResponse.json()]);
    const condition = data.weather?.[0];
    const temperature = data.main?.temp;
    const feelsLike = data.main?.feels_like;
    const humidity = data.main?.humidity;
    const windSpeed = data.wind?.speed;
    const timezoneOffset = forecastData.city?.timezone;
    const forecastEntries = forecastData.list;

    if (
      !condition ||
      typeof condition.description !== "string" ||
      typeof condition.icon !== "string" ||
      !/^\d{2}[dn]$/.test(condition.icon) ||
      typeof temperature !== "number" ||
      typeof feelsLike !== "number" ||
      typeof humidity !== "number" ||
      typeof windSpeed !== "number" ||
      typeof timezoneOffset !== "number" ||
      !Number.isFinite(timezoneOffset) ||
      !Array.isArray(forecastEntries)
    ) {
      return NextResponse.json({ error: "Weather data was incomplete. Please try again." }, { status: 502 });
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const localDate = new Date((currentTime + timezoneOffset) * 1000).toISOString().slice(0, 10);
    const todayForecast = forecastEntries.flatMap((entry: any) => {
      if (typeof entry?.dt !== "number" || entry.dt < currentTime) return [];

      const localTime = new Date((entry.dt + timezoneOffset) * 1000).toISOString();
      const forecastCondition = entry.weather?.[0];
      if (
        localTime.slice(0, 10) !== localDate ||
        typeof entry.main?.temp !== "number" ||
        typeof forecastCondition?.description !== "string" ||
        typeof forecastCondition?.icon !== "string" ||
        !/^\d{2}[dn]$/.test(forecastCondition.icon)
      ) {
        return [];
      }

      return [{
        time: localTime.slice(11, 16),
        temperatureC: Math.round(entry.main.temp),
        description: forecastCondition.description,
        icon: forecastCondition.icon,
        rainChance: typeof entry.pop === "number" ? Math.round(entry.pop * 100) : 0,
      }];
    });

    return NextResponse.json({
      location: typeof data.name === "string" && data.name ? data.name : "Your area",
      country: typeof data.sys?.country === "string" ? data.sys.country : "",
      temperatureC: Math.round(temperature),
      feelsLikeC: Math.round(feelsLike),
      humidity: Math.round(humidity),
      windKmh: Math.round(windSpeed * 3.6),
      description: condition.description,
      icon: condition.icon,
      todayForecast,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Weather could not be loaded. Please try again." }, { status: 502 });
  }
}