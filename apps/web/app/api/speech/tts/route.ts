import { NextRequest, NextResponse } from "next/server";

const BHASHINI_URL = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";
const BHASHINI_API_KEY = process.env.BHASHINI_INFERENCE_KEY;
const TTS_SERVICE_ID = "Bhashini/IITM/TTS";

export async function POST(request: NextRequest) {
  if (!BHASHINI_API_KEY) {
    return NextResponse.json(
      { error: "Speech service is not configured." },
      { status: 503 },
    );
  }

  try {
    const { text, language } = await request.json();
    if (typeof text !== "string" || !text.trim() || text.length > 4000) {
      return NextResponse.json({ error: "Text must be between 1 and 4000 characters." }, { status: 400 });
    }
    if (!["pa", "hi", "en"].includes(language)) {
      return NextResponse.json({ error: "Supported languages are Punjabi, Hindi, and English." }, { status: 400 });
    }

    const response = await fetch(BHASHINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: BHASHINI_API_KEY,
      },
      body: JSON.stringify({
        pipelineTasks: [{
          taskType: "tts",
          config: {
            serviceId: TTS_SERVICE_ID,
            language: { sourceLanguage: language },
            gender: "female",
            samplingRate: 16000,
          },
        }],
        inputData: { input: [{ source: text.trim() }] },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Bhashini TTS failed:", response.status, data);
      return NextResponse.json({ error: "Could not create speech audio." }, { status: 502 });
    }

    const audioContent = data?.pipelineResponse?.[0]?.audio?.[0]?.audioContent;
    if (typeof audioContent !== "string" || !audioContent) {
      console.error("Bhashini TTS returned no audio.");
      return NextResponse.json({ error: "Speech service returned no audio." }, { status: 502 });
    }

    const audio = new Uint8Array(Buffer.from(audioContent, "base64"));
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("TTS request failed:", error);
    return NextResponse.json({ error: "Could not create speech audio." }, { status: 500 });
  }
}
