import { NextRequest, NextResponse } from "next/server";
import { getNewsFeed } from "./news-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  try {
    const feed = await getNewsFeed(forceRefresh);
    return NextResponse.json(feed, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agricultural news is temporarily unavailable.";
    console.error("[news] Unable to load news feeds:", message);
    return NextResponse.json(
      { error: "Agricultural updates are temporarily unavailable. Please try again later." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
