import { NextRequest, NextResponse } from "next/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) {
    return NextResponse.json({ error: "Enter at least 2 characters for a location." }, { status: 400 });
  }

  const params = new URLSearchParams({ name: query, count: "6", language: "en", format: "json" });
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error("Open-Meteo geocoding returned HTTP", response.status);
      return NextResponse.json({ error: "Locations could not be searched. Please try again." }, { status: 502 });
    }

    const payload: unknown = await response.json();
    if (!isRecord(payload) || (payload.results !== undefined && !Array.isArray(payload.results))) {
      throw new Error("Open-Meteo returned an invalid location search response.");
    }
    const locations = (payload.results ?? []).flatMap((result) => {
      if (
        !isRecord(result) ||
        typeof result.id !== "number" ||
        typeof result.name !== "string" ||
        typeof result.latitude !== "number" ||
        typeof result.longitude !== "number" ||
        !Number.isFinite(result.latitude) ||
        !Number.isFinite(result.longitude)
      ) {
        return [];
      }
      return [{
        id: result.id,
        name: result.name,
        admin1: typeof result.admin1 === "string" ? result.admin1 : "",
        country: typeof result.country === "string" ? result.country : "",
        latitude: result.latitude,
        longitude: result.longitude,
      }];
    });
    return NextResponse.json({ locations }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch (error) {
    console.error("Open-Meteo geocoding request failed:", error);
    return NextResponse.json({ error: "Locations could not be searched. Please try again." }, { status: 502 });
  }
}
