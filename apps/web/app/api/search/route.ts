import { NextRequest, NextResponse } from "next/server";

const SEARCH_SERVICE_URL = "http://15.206.209.123:3001";

export async function POST(request: NextRequest) {
  let question: unknown;
  try {
    ({ question } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid search request." }, { status: 400 });
  }

  if (typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }

  try {
    const response = await fetch(`${SEARCH_SERVICE_URL}/extract/${encodeURIComponent(question)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Web search is unavailable." }, { status: 502 });
    }

    const results: unknown = await response.json().catch(() => null);
    if (!Array.isArray(results)) {
      return NextResponse.json({ error: "Web search returned an invalid response." }, { status: 502 });
    }

    return NextResponse.json(results, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Web search is unavailable." }, { status: 502 });
  }
}