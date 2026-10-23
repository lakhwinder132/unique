import { NextRequest, NextResponse } from "next/server";

/* =========================================================
   BHASHINI CONFIG
   ========================================================= */

const BHASHINI_API_URL =
  "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";

const BHASHINI_API_KEY = process.env.BHASHINI_INFERENCE_KEY;

/* =========================================================z
   BHASHINI SERVICE IDs
   These are the same services from your working test file.
   ========================================================= */

const ALD_SERVICE_ID =
  "bhashini/iitmandi/audio-lang-detection/gpu";

const ASR_PUNJABI_HINDI_SERVICE_ID =
  "ai4bharat/conformer-multilingual-indo_aryan-gpu--t4";

const ASR_ENGLISH_SERVICE_ID =
  "ai4bharat/whisper-medium-en--gpu--t4";

/* =========================================================
   BHASHINI REQUEST
   ========================================================= */

async function bhashiniRequest(payload: unknown, signal?: AbortSignal) {
  if (!BHASHINI_API_KEY) {
    throw new Error(
      "BHASHINI_API_KEY is missing from .env.local"
    );
  }

  const response = await fetch(BHASHINI_API_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",

      // IMPORTANT:
      // BHASHINI expects the raw inference API key.
      // Do NOT add "Bearer".
      Authorization: BHASHINI_API_KEY,
    },

    body: JSON.stringify(payload),
    signal: AbortSignal.any([
      ...(signal ? [signal] : []),
      AbortSignal.timeout(60000),
    ]),
  });

  const text = await response.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      "BHASHINI returned invalid JSON."
    );
  }

  if (!response.ok) {
    throw new Error(
      `BHASHINI returned HTTP ${response.status}.`
    );
  }

  return data;
}

/* =========================================================
   LANGUAGE DETECTION
   ========================================================= */

async function detectLanguage(
  audioBase64: string,
  signal?: AbortSignal,
) {

  const payload = {
    pipelineTasks: [
      {
        taskType: "audio-lang-detection",

        config: {
          serviceId: ALD_SERVICE_ID,
        },
      },
    ],

    inputData: {
      audio: [
        {
          audioContent: audioBase64,
        },
      ],
    },
  };

  const data = await bhashiniRequest(payload, signal);

  const prediction =
    data?.pipelineResponse?.[0]?.output?.[0];

  /*
    Depending on the BHASHINI response,
    langPrediction may be directly available.
  */

  const langPrediction =
    prediction?.langPrediction ??
    data?.langPrediction ??
    data?.pipelineResponse?.[0]?.langPrediction;

  if (
    !Array.isArray(langPrediction) ||
    langPrediction.length === 0
  ) {
    throw new Error(
      "BHASHINI language detection returned no language prediction."
    );
  }

  const bestPrediction =
    langPrediction[0];

  const language =
    bestPrediction?.langCode;

  const confidence =
    bestPrediction?.langScore;

  if (!language) {
    throw new Error(
      "BHASHINI returned an invalid language code."
    );
  }

  return {
    language,
    confidence,
  };
}

/* =========================================================
   ASR
   ========================================================= */

async function speechToText(
  audioBase64: string,
  language: string,
  samplingRate: number,
  signal?: AbortSignal,
) {

  let serviceId: string;

  /*
    Punjabi = pa
    Hindi = hi
    English = en
  */

  if (
    language === "pa" ||
    language === "hi"
  ) {
    serviceId =
      ASR_PUNJABI_HINDI_SERVICE_ID;
  } else if (
    language === "en"
  ) {
    serviceId =
      ASR_ENGLISH_SERVICE_ID;
  } else {
    /*
      Fallback to multilingual ASR
      for unsupported detected languages.
    */

    serviceId =
      ASR_PUNJABI_HINDI_SERVICE_ID;
  }

  const payload = {
    pipelineTasks: [
      {
        taskType: "asr",

        config: {
          serviceId,

          language: {
            sourceLanguage: language,
          },

          audioFormat: "wav",

          samplingRate,
        },
      },
    ],

    inputData: {
      audio: [
        {
          audioContent: audioBase64,
        },
      ],
    },
  };

  const data = await bhashiniRequest(payload, signal);

  const output =
    data?.pipelineResponse?.[0]?.output?.[0];

  if (!output) {
    throw new Error(
      "BHASHINI ASR returned no output."
    );
  }

  /*
    Your working test file checks these
    possible transcript fields.
  */

  const transcript =
    output?.source ??
    output?.text ??
    output?.transcript ??
    output?.target;

  if (
    typeof transcript !== "string" ||
    !transcript.trim()
  ) {
    throw new Error(
      "BHASHINI ASR returned no transcript."
    );
  }

  return transcript.trim();
}

/* =========================================================
   POST /api/speech
   ========================================================= */

export async function POST(
  request: NextRequest
) {
  const startedAt = performance.now();

  try {
    /* -----------------------------------------------------
       Check API key
       ----------------------------------------------------- */

    if (!BHASHINI_API_KEY) {
      throw new Error(
        "BHASHINI_API_KEY is missing. Add it to .env.local."
      );
    }

    /* -----------------------------------------------------
       Receive browser audio
       ----------------------------------------------------- */

    const formData =
      await request.formData();

    const audio =
      formData.get("audio");

    if (!(audio instanceof File)) {
      throw new Error(
        "No audio file received."
      );
    }

    /* -----------------------------------------------------
       IMPORTANT
       -----------------------------------------------------

       No FFmpeg.

       We expect the browser to send a
       proper 16-bit PCM WAV file at 16 kHz.

       ----------------------------------------------------- */

    if (
      audio.type &&
      !audio.type.includes("wav") &&
      !audio.type.includes("wave")
    ) {
    }

    /* -----------------------------------------------------
       Convert File -> Buffer
       ----------------------------------------------------- */

    const arrayBuffer =
      await audio.arrayBuffer();

    const audioBuffer =
      Buffer.from(arrayBuffer);

    /* -----------------------------------------------------
       WAV validation
       ----------------------------------------------------- */

    if (audioBuffer.length < 44) {
      throw new Error(
        "Audio file is too small to be a valid WAV file."
      );
    }

    /*
      WAV files normally begin with:

      bytes 0-3  = RIFF
      bytes 8-11 = WAVE
    */

    const riff =
      audioBuffer.toString(
        "ascii",
        0,
        4
      );

    const wave =
      audioBuffer.toString(
        "ascii",
        8,
        12
      );

    if (
      riff !== "RIFF" ||
      wave !== "WAVE"
    ) {
      throw new Error(
        "Received audio is not a valid WAV file."
      );
    }

    /* -----------------------------------------------------
       Convert WAV -> Base64
       ----------------------------------------------------- */

    const audioBase64 =
      audioBuffer.toString(
        "base64"
      );

    /* -----------------------------------------------------
       STEP 1: LANGUAGE DETECTION
       ----------------------------------------------------- */

    const requestedLanguage = formData.get("language");
    const detection =
      typeof requestedLanguage === "string" &&
      ["pa", "hi", "en"].includes(requestedLanguage)
        ? { language: requestedLanguage, confidence: null }
        : await detectLanguage(audioBase64, request.signal);
    const { language, confidence } = detection;

    /* -----------------------------------------------------
       STEP 2: SPEECH TO TEXT
       ----------------------------------------------------- */

    const samplingRate = audioBuffer.readUInt32LE(24);
    if (samplingRate < 8000 || samplingRate > 96000) {
      throw new Error("Audio sample rate is not supported.");
    }

    const text =
      await speechToText(
        audioBase64,
        language,
        samplingRate,
        request.signal,
      );

    console.info("[speech] recognition complete", {
      language,
      transcriptLength: text.length,
      recognitionMs: Math.round(performance.now() - startedAt),
    });

    /* -----------------------------------------------------
       RETURN RESULT
       ----------------------------------------------------- */

    return NextResponse.json({
      success: true,

      language,

      confidence,

      text,
    });
  } catch (error) {
    console.error(
      "\n❌ SPEECH API ERROR:"
    );

    console.error("[speech] recognition failed");

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Speech recognition failed.",
      },
      {
        status: 500,
      }
    );
  }
}
