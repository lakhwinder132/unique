import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getRecentActivity, storeActivity, type ActivityEntry } from "./activity-store";

export const runtime = "nodejs";

function hasAdminAccess(request: NextRequest) {
  const expected = process.env.ACTIVITY_ADMIN_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length < 32 || suppliedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(suppliedBytes, expectedBytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    const content = await request.text();
    if (content.length > 20_000) return NextResponse.json({ error: "Activity record is too large." }, { status: 413 });
    body = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: "Invalid activity record." }, { status: 400 });
  }
  if (!isRecord(body) || body.consent !== true) return new Response(null, { status: 204 });
  const visitorId = typeof body.visitorId === "string" && /^[\w-]{16,80}$/.test(body.visitorId) ? body.visitorId : null;
  const requestText = typeof body.request === "string" ? body.request.trim().slice(0, 12000) : "";
  if (!visitorId || !requestText) return NextResponse.json({ error: "A visitor ID and request are required." }, { status: 400 });

  let region: ActivityEntry["region"] = null;
  if (isRecord(body.region)) {
    const { name, country, latitude, longitude } = body.region;
    if (typeof name === "string" && typeof country === "string"
      && typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
      && typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180) {
      region = {
        name: name.slice(0, 100),
        country: country.slice(0, 100),
        latitude: Math.round(latitude * 100) / 100,
        longitude: Math.round(longitude * 100) / 100,
      };
    }
  }

  try {
    await storeActivity({ id: crypto.randomUUID(), at: new Date().toISOString(), visitorId, request: requestText, region });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[activity] Could not store opted-in activity:", error);
    return NextResponse.json({ error: "Activity could not be stored." }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  if (!hasAdminAccess(request)) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  try {
    const entries = await getRecentActivity();
    return NextResponse.json({ entries }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    console.error("[activity] Could not read activity log:", error);
    return NextResponse.json({ error: "Activity log could not be read." }, { status: 503 });
  }
}
