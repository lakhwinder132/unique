// apps/web/app/speech/speechRecorder.ts

const SILENCE_THRESHOLD = 0.015;

// User must be silent for this long before recording stops.
const SILENCE_DURATION = 1200;

// Don't stop immediately if the user hasn't started speaking yet.
const MAX_WAIT_FOR_SPEECH = 10000;

// Safety limit so recording cannot run forever.
const MAX_RECORDING_TIME = 60000;

export async function recordAudio(signal?: AbortSignal): Promise<Blob> {
  if (signal?.aborted) {
    throw new DOMException("Recording cancelled.", "AbortError");
  }
  if (!window.isSecureContext) {
    throw new Error("Microphone access requires HTTPS. Open Fieldwise over HTTPS and allow microphone access.");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support microphone recording.");
  }

  const audioContext = new AudioContext({ sampleRate: 16000 });
  let stream: MediaStream;
  try {
    if (audioContext.state === "suspended") await audioContext.resume();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (error) {
    if (audioContext.state !== "closed") await audioContext.close();
    if (error instanceof Error && error.name === "NotAllowedError") {
      throw new Error("Allow microphone access in your browser settings, then try again.");
    }
    throw error;
  }

  if (signal?.aborted) {
    stream.getTracks().forEach((track) => track.stop());
    await audioContext.close();
    throw new DOMException("Recording cancelled.", "AbortError");
  }

  const source =
    audioContext.createMediaStreamSource(stream);

  /*
   * ScriptProcessorNode is deprecated but is still widely
   * supported and keeps this implementation simple.
   *
   * We DON'T connect it to destination, so the microphone
   * won't be played back through the speakers.
   */

  const processor =
    audioContext.createScriptProcessor(
      4096,
      1,
      1
    );

  const audioChunks: Float32Array[] = [];

  let speaking = false;

  let silenceStart: number | null = null;

  let recordingStart = Date.now();

  let speechStart: number | null = null;

  let stopped = false;

  return new Promise<Blob>((resolve, reject) => {
    const cleanup = () => {
      signal?.removeEventListener("abort", finishRecording);
      stream
        .getTracks()
        .forEach((track) => track.stop());

      processor.disconnect();
      source.disconnect();

      if (
        audioContext.state !== "closed"
      ) {
        audioContext.close();
      }
    };

    const finishRecording = () => {
      if (stopped) return;

      stopped = true;

      cleanup();

      if (audioChunks.length === 0) {
        reject(
          signal?.aborted
            ? new DOMException("Recording cancelled.", "AbortError")
            : new Error("No audio was recorded.")
        );

        return;
      }

      const wavBlob =
        createWavBlob(
          audioChunks,
          audioContext.sampleRate
        );

      resolve(wavBlob);
    };

    signal?.addEventListener("abort", finishRecording, { once: true });

    processor.onaudioprocess = (event) => {
      if (stopped) return;

      const input =
        event.inputBuffer.getChannelData(0);

      /*
       * Copy the audio because inputBuffer data
       * gets reused by the browser.
       */

      const copy =
        new Float32Array(
          input.length
        );

      copy.set(input);

      audioChunks.push(copy);

      /* -------------------------------------------
         Calculate microphone volume
         ------------------------------------------- */

      let sum = 0;

      for (
        let i = 0;
        i < input.length;
        i++
      ) {
        const sample = input[i] ?? 0;
        sum += sample * sample;
      }

      const rms = Math.sqrt(
        sum / input.length
      );

      const now = Date.now();

      const isSpeaking =
        rms > SILENCE_THRESHOLD;

      /* -------------------------------------------
         USER STARTED SPEAKING
         ------------------------------------------- */

      if (isSpeaking) {
        if (!speaking) {
          console.log(
            "🎤 Speech detected"
          );

          speaking = true;

          speechStart = now;
        }

        // Reset silence timer
        silenceStart = null;
      }

      /* -------------------------------------------
         USER STOPPED SPEAKING
         ------------------------------------------- */

      else if (speaking) {
        if (silenceStart === null) {
          silenceStart = now;

          console.log(
            "🔇 Silence detected..."
          );
        }

        const silenceDuration =
          now - silenceStart;

        if (
          silenceDuration >=
          SILENCE_DURATION
        ) {
          console.log(
            "🛑 User stopped speaking"
          );

          finishRecording();
        }
      }

      /* -------------------------------------------
         USER NEVER STARTED SPEAKING
         ------------------------------------------- */

      if (
        !speaking &&
        now - recordingStart >
          MAX_WAIT_FOR_SPEECH
      ) {
        console.log(
          "🛑 No speech detected"
        );

        finishRecording();
      }

      /* -------------------------------------------
         SAFETY TIMEOUT
         ------------------------------------------- */

      if (
        now - recordingStart >
        MAX_RECORDING_TIME
      ) {
        console.log(
          "🛑 Maximum recording time reached"
        );

        finishRecording();
      }
    };

    /*
     * Connect microphone -> processor.
     *
     * IMPORTANT:
     * We intentionally DON'T connect processor
     * to audioContext.destination.
     *
     * Therefore microphone audio isn't played
     * through the speakers.
     */

    source.connect(processor);

    processor.connect(
      audioContext.destination
    );
  });
}

/* =========================================================
   CREATE WAV
   ========================================================= */

function createWavBlob(
  chunks: Float32Array[],
  sampleRate: number
): Blob {
  let totalLength = 0;

  for (const chunk of chunks) {
    totalLength += chunk.length;
  }

  const samples =
    new Float32Array(totalLength);

  let offset = 0;

  for (const chunk of chunks) {
    samples.set(chunk, offset);

    offset += chunk.length;
  }

  const targetSampleRate = 16000;
  const outputSamples = sampleRate === targetSampleRate
    ? samples
    : resample(samples, sampleRate, targetSampleRate);

  /*
   * Convert Float32 PCM
   * to 16-bit PCM.
   */

  const buffer =
    new ArrayBuffer(
      44 + outputSamples.length * 2
    );

  const view =
    new DataView(buffer);

  /* -------------------------------------------
     WAV HEADER
     ------------------------------------------- */

  writeString(
    view,
    0,
    "RIFF"
  );

  view.setUint32(
    4,
    36 + outputSamples.length * 2,
    true
  );

  writeString(
    view,
    8,
    "WAVE"
  );

  writeString(
    view,
    12,
    "fmt "
  );

  view.setUint32(
    16,
    16,
    true
  );

  // PCM format
  view.setUint16(
    20,
    1,
    true
  );

  // Mono
  view.setUint16(
    22,
    1,
    true
  );

  // Sample rate
  view.setUint32(
    24,
    targetSampleRate,
    true
  );

  // Byte rate
  view.setUint32(
    28,
    targetSampleRate * 2,
    true
  );

  // Block align
  view.setUint16(
    32,
    2,
    true
  );

  // 16-bit
  view.setUint16(
    34,
    16,
    true
  );

  writeString(
    view,
    36,
    "data"
  );

  view.setUint32(
    40,
    outputSamples.length * 2,
    true
  );

  /* -------------------------------------------
     AUDIO DATA
     ------------------------------------------- */

  let position = 44;

  for (
    let i = 0;
    i < outputSamples.length;
    i++
  ) {
    let sample =
      outputSamples[i] ?? 0;

    // Clamp
    sample =
      Math.max(
        -1,
        Math.min(1, sample)
      );

    const intSample =
      sample < 0
        ? sample * 0x8000
        : sample * 0x7fff;

    view.setInt16(
      position,
      intSample,
      true
    );

    position += 2;
  }

  return new Blob(
    [buffer],
    {
      type: "audio/wav",
    }
  );
}

function resample(samples: Float32Array, fromRate: number, toRate: number) {
  const outputLength = Math.round(samples.length * toRate / fromRate);
  const output = new Float32Array(outputLength);
  const ratio = fromRate / toRate;

  for (let i = 0; i < outputLength; i++) {
    const sourcePosition = i * ratio;
    const leftIndex = Math.floor(sourcePosition);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const fraction = sourcePosition - leftIndex;
    const left = samples[leftIndex] ?? 0;
    const right = samples[rightIndex] ?? left;
    output[i] = left + (right - left) * fraction;
  }

  return output;
}

/* =========================================================
   WRITE STRING
   ========================================================= */

function writeString(
  view: DataView,
  offset: number,
  value: string
) {
  for (
    let i = 0;
    i < value.length;
    i++
  ) {
    view.setUint8(
      offset + i,
      value.charCodeAt(i)
    );
  }
}
