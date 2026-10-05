import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://ai.shelly22.online";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: request.signal,
    });

    if (!upstream.ok) {
      console.error(`Ollama upstream returned HTTP ${upstream.status}.`);
      return NextResponse.json(
        { error: `The assistant backend returned HTTP ${upstream.status}. Check that Ollama is available at the configured server address.` },
        { status: 502 },
      );
    }
    if (!upstream.body) {
      return NextResponse.json({ error: "The assistant returned no response." }, { status: 502 });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/x-ndjson",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Ollama proxy connection failed:", error);
    return NextResponse.json(
      { error: "Could not connect to the Ollama backend. Check the configured server address and network access." },
      { status: 502 },
    );
  }
}