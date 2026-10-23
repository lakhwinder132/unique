"use client";

import {
  useState,
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useRef,
} from "react";

import ChatUI from "./components/ChatUI";
import type { WeatherData } from "./services/weather";

import { askOllama } from "./services/ollama";
import { generateDirectOllama, listDirectOllamaModels } from "./services/directOllama";
import { detectTextLanguage } from "./services/language";
import { recordAudio } from "./speech/speechRecorder";

type ChatTurn = { role: "user" | "assistant"; content: string };

import "./app.css";

const weatherQuestionPattern = /\b(weather|forecast|rain|rainfall|temperature|wind|windy|humidity|heat|cold|storm|cloud|spray|irrigat|mausam|barish|baarish|meeh|garmi|thand|hawa)\b|मौसम|बारिश|वर्षा|तापमान|हवा|आर्द्रता|तूफान|ਮੌਸਮ|ਮੀਂਹ|ਬਾਰਿਸ਼|ਤਾਪਮਾਨ|ਹਵਾ|ਨਮੀ|ਤੂਫ਼ਾਨ/i;
const directTestingEnabled = process.env.NODE_ENV !== "production";
const directOllamaBaseUrl = process.env.NEXT_PUBLIC_OLLAMA_TEST_URL?.trim() ?? "";

function buildWeatherContext(weather: WeatherData, question: string) {
  const asksForRain = /rain|precip|shower|irrigat|water|meeh|ਮੀਂਹ|ਬਾਰਿਸ਼|बारिश|वर्षा|सਿੰਚਾਈ/i.test(question);
  const asksForWind = /wind|spray|ਹਵਾ|ਛਿੜਕ|हवा/i.test(question);
  const asksForSoil = /soil|moisture|irrigat|evapotranspir|ਮਿੱਟੀ|ਸਿੰਚਾਈ|मिट्टी|सिंचाई/i.test(question);
  const asksForLongRange = /week|7.day|daily|tomorrow|ਆਉਣ ਵਾਲੇ ਦਿਨ|ਹਫ਼ਤ|अगले दिन|सप्ताह/i.test(question);
  const currentFields = [
    "temperature_2m",
    "apparent_temperature",
    "relative_humidity_2m",
    "weather_code",
    ...(asksForRain ? ["precipitation", "rain", "showers"] : []),
    ...(asksForWind ? ["wind_speed_10m", "wind_direction_10m", "wind_gusts_10m"] : []),
    ...(asksForSoil ? ["soil_temperature_0cm", "soil_moisture_0_to_1cm"] : []),
  ];
  const hourlyFields = [
    "temperature_2m",
    "weather_code",
    ...(asksForRain ? ["precipitation_probability", "precipitation", "rain", "showers"] : []),
    ...(asksForWind ? ["wind_speed_10m", "wind_direction_10m", "wind_gusts_10m"] : []),
    ...(asksForSoil ? ["soil_moisture_0_to_1cm", "soil_moisture_9_to_27cm", "et0_fao_evapotranspiration"] : []),
  ];
  const current = Object.fromEntries(currentFields.flatMap((key) =>
    weather.current[key] === undefined ? [] : [[key, weather.current[key]]],
  ));
  const hourly = weather.hourly.time
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => Date.parse(time) >= Date.parse(String(weather.current.time)))
    .slice(0, 6)
    .map(({ time, index }) => ({
      time,
      values: Object.fromEntries(hourlyFields.flatMap((key) => {
        const values = weather.hourly[key];
        return Array.isArray(values) && values[index] !== undefined ? [[key, values[index]]] : [];
      })),
    }));
  const daily = asksForLongRange
    ? weather.daily.time.map((time, index) => ({
      time,
      temperature_2m_min: weather.daily.temperature_2m_min?.[index],
      temperature_2m_max: weather.daily.temperature_2m_max?.[index],
      precipitation_probability_max: weather.daily.precipitation_probability_max?.[index],
      precipitation_sum: weather.daily.precipitation_sum?.[index],
    }))
    : undefined;
  const currentUnits = Object.fromEntries(currentFields.flatMap((key) =>
    weather.currentUnits[key] ? [[key, weather.currentUnits[key]]] : [],
  ));
  const hourlyUnits = Object.fromEntries(hourlyFields.flatMap((key) =>
    weather.hourlyUnits[key] ? [[key, weather.hourlyUnits[key]]] : [],
  ));

  return JSON.stringify({
    source: "Open-Meteo forecast model",
    location: [weather.location, weather.country].filter(Boolean).join(", "),
    coordinates: { latitude: weather.latitude, longitude: weather.longitude },
    fetchedAt: weather.fetchedAt,
    timezone: weather.timezone,
    timezoneAbbreviation: weather.timezoneAbbreviation,
    units: { current: currentUnits, hourly: hourlyUnits },
    ...(asksForLongRange ? {
      dailyUnits: {
        temperature_2m_min: weather.dailyUnits.temperature_2m_min,
        temperature_2m_max: weather.dailyUnits.temperature_2m_max,
        precipitation_sum: weather.dailyUnits.precipitation_sum,
      },
    } : {}),
    current,
    nextHours: hourly,
    ...(daily ? { nextDays: daily } : {}),
  });
}

function cleanTextForSpeech(text: string) {
  const codeFence = String.fromCharCode(96).repeat(3);
  return text
    .split(codeFence)
    .filter((_, index) => index % 2 === 0)
    .join(" ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*#>_~-]/g, " ");
}

async function speakWithDeviceVoice(text: string, language: string, signal: AbortSignal) {
  const synthesis = window.speechSynthesis;
  if (!synthesis) {
    throw new Error("Speech playback is not available in this browser.");
  }

  const findVoice = () => synthesis.getVoices().find((candidate) =>
    candidate.lang.toLowerCase().split("-")[0] === language.toLowerCase()
  );
  let voice = findVoice();
  if (!voice) {
    await awaitVoiceList(synthesis);
    voice = findVoice();
  }
  if (!voice) {
    const languageName = new Intl.DisplayNames(["en"], { type: "language" }).of(language) ?? language;
    throw new Error(`This device does not have a ${languageName} voice installed.`);
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;

  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      signal.removeEventListener("abort", handleAbort);
      if (error) reject(error);
      else resolve();
    };
    const handleAbort = () => {
      synthesis.cancel();
      finish();
    };

    utterance.onend = () => finish();
    utterance.onerror = () => finish(new Error("Device speech playback failed."));
    signal.addEventListener("abort", handleAbort, { once: true });
    synthesis.speak(utterance);
  });
}

function createProgressiveSpeech(language: string, signal: AbortSignal, onFirstAudio: (elapsedMs: number) => void) {
  const startedAt = performance.now();
  let firstAudioAt: number | null = null;
  let failure: string | null = null;
  let queue = Promise.resolve();
  const enqueue = (rawText: string) => {
    const text = cleanTextForSpeech(rawText).trim();
    if (!text || failure || signal.aborted) return;
    queue = queue.then(async () => {
      if (failure || signal.aborted) return;
      const response = await fetch("/api/speech/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ text, language: ["pa", "hi", "en"].includes(language) ? language : "en" }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Speech audio could not be created.");
      }
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          signal.removeEventListener("abort", abort);
          URL.revokeObjectURL(url);
        };
        const abort = () => {
          audio.pause();
          cleanup();
          resolve();
        };
        audio.onended = () => { cleanup(); resolve(); };
        audio.onerror = () => { cleanup(); reject(new Error("Could not play the generated audio.")); };
        signal.addEventListener("abort", abort, { once: true });
        audio.play().then(() => {
          if (firstAudioAt === null) {
            firstAudioAt = performance.now();
            onFirstAudio(Math.round(firstAudioAt - startedAt));
          }
        }).catch((error) => { cleanup(); reject(error); });
      });
    }).catch((error: unknown) => {
      if (!signal.aborted) failure = error instanceof Error ? error.message : "Speech playback failed.";
    });
  };
  return {
    enqueue,
    async finish() {
      await queue;
      return {
        error: failure,
        totalMs: Math.round(performance.now() - startedAt),
        firstAudioMs: firstAudioAt === null ? null : Math.round(firstAudioAt - startedAt),
      };
    },
  };
}

function takeCompleteSpeechSentences(text: string) {
  const matches = text.match(/[\s\S]*?[.!?।॥](?:\s+|$)/g) ?? [];
  const complete = matches.join("");
  return { complete, remainder: text.slice(complete.length) };
}

function awaitVoiceList(synthesis: SpeechSynthesis) {
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 1500);
    synthesis.addEventListener("voiceschanged", () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

export default function App() {
  // ============================================
  // EXISTING CHAT STATES
  // ============================================

  const [prompt, setPrompt] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [conversation, setConversation] = useState<ChatTurn[]>([]);
  const conversationRef = useRef<ChatTurn[]>([]);
  const [chatError, setChatError] = useState("");
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [send, setSend] = useState(false);
  const [chatMode, setChatMode] = useState<"backend" | "direct">("backend");
  const [directModels, setDirectModels] = useState<string[]>([]);
  const [directModel, setDirectModel] = useState("");
  const [directStatus, setDirectStatus] = useState("");
  const [directResponseTime, setDirectResponseTime] = useState<number | null>(null);
  const [directBusy, setDirectBusy] = useState(false);

  // ============================================
  // NEW VOICE STATES
  // ============================================

  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [speechLanguageChoice, setSpeechLanguageChoice] = useState("auto");
  const [language, setLanguage] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const recordingController = useRef<AbortController | null>(null);
  const chatRequestController = useRef<AbortController | null>(null);
  const speechRequestController = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechController = useRef<AbortController | null>(null);
  const voiceModeRef = useRef(false);
  const explainQuestionHandledRef = useRef(false);
  const lastVoiceSubmissionRef = useRef<{ text: string; at: number } | null>(null);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    recordingController.current?.abort();
    chatRequestController.current?.abort();
    speechRequestController.current?.abort();
    speechController.current?.abort();
    voiceModeRef.current = false;
  }, []);

  useEffect(() => {
    let savedLanguage: string | null = null;
    try {
      savedLanguage = window.localStorage.getItem("kisan-ai-language");
    } catch {
      return;
    }
    if (savedLanguage === "auto" || savedLanguage === "pa" || savedLanguage === "hi" || savedLanguage === "en") {
      setSpeechLanguageChoice(savedLanguage);
    }
  }, []);

  // ============================================
  // TEXT INPUT
  // ============================================

  const handleChange = (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    setLanguage("");
    setPrompt(e.target.value);
  };

  const getAnswer = async (question: string, history: ChatTurn[], signal: AbortSignal, onText?: (text: string) => void) => {
    if (chatMode === "direct") {
      if (!directModel) throw new Error("Test the connection and select an installed Ollama model first.");
      setDirectStatus(`Generating with ${directModel}…`);
      setDirectResponseTime(null);
      const result = await generateDirectOllama({
        baseUrl: directOllamaBaseUrl,
        model: directModel,
        prompt: question,
        onChunk: setResponse,
      });
      setDirectResponseTime(result.elapsedMs);
      setDirectStatus(`Generated with ${directModel}`);
      return result.text;
    }

    const weatherQuestion = weatherQuestionPattern.test(question);
    const weatherContext = weatherQuestion
      ? weatherData
        ? buildWeatherContext(weatherData, question)
        : JSON.stringify({
          status: "unavailable",
          instruction: "No selected-location Open-Meteo data is loaded. Tell the user that weather data is unavailable and ask them to select a location; do not invent current or forecast conditions.",
        })
      : undefined;

    return askOllama({
      prompt: question,
      history,
      signal,
      weatherContext,
      onChunk: (text) => { setResponse(text); onText?.(text); },
      onMetrics: (metrics) => console.info("[chat-timing]", metrics),
    });
  };

  // ============================================
  // EXISTING SEND FUNCTION
  // ============================================

  const handleSubmit = async (voiceQuestion?: string, voiceLanguage?: string) => {
    const question = (voiceQuestion ?? prompt).trim();
    if (!question || send || directBusy) {
      return;
    }

    audioRef.current?.pause();
    speechController.current?.abort();
    speechController.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setSpeaking(false);
    setSubmittedPrompt(question);
    setPrompt("");
    setChatError("");

    setSend(true);
    setResponse("");
    const priorHistory = conversationRef.current;
    const chatRequest = new AbortController();
    chatRequestController.current = chatRequest;
    const progressiveController = voiceLanguage && voiceModeRef.current && chatMode === "backend"
      ? new AbortController()
      : null;
    const progressiveSpeech = progressiveController
      ? createProgressiveSpeech(voiceLanguage ?? "en", progressiveController.signal, (firstAudioMs) => {
        console.info("[speech-timing] first audio", { firstAudioMs });
      })
      : null;
    let spokenSource = "";
    let speechBuffer = "";
    if (progressiveController) {
      speechController.current = progressiveController;
      setSpeaking(true);
    }

    try {
      const answer = await getAnswer(question, priorHistory, chatRequest.signal, progressiveSpeech ? (fullText) => {
        const addition = fullText.slice(spokenSource.length);
        spokenSource = fullText;
        speechBuffer += addition;
        const sentences = takeCompleteSpeechSentences(speechBuffer);
        if (sentences.complete) progressiveSpeech.enqueue(sentences.complete);
        speechBuffer = sentences.remainder;
      } : undefined);
      let speechMetrics: { error: string | null; totalMs: number; firstAudioMs: number | null } | null = null;
      if (progressiveSpeech) {
        if (speechBuffer.trim()) progressiveSpeech.enqueue(speechBuffer);
        speechMetrics = await progressiveSpeech.finish();
        setSpeaking(false);
        if (speechMetrics.error) setSpeechError(speechMetrics.error);
        else console.info("[speech-timing] progressive playback complete", speechMetrics);
      }
      const nextConversation = [...priorHistory, { role: "user" as const, content: question }, { role: "assistant" as const, content: answer }];
      conversationRef.current = nextConversation;
      setConversation(nextConversation);
      return { answer, spokenProgressively: Boolean(progressiveSpeech) };
    } catch (error) {
      if (chatRequest.signal.aborted) return;
      console.error(error);
      const message = error instanceof Error
        ? error.message
        : "The assistant could not be reached. Check your connection and try again.";
      setChatError(message);
      setPrompt(question);
      if (chatMode === "direct") setDirectStatus(`Request failed: ${message}`);
    } finally {
      if (chatRequestController.current === chatRequest) chatRequestController.current = null;
      if (progressiveController) {
        if (speechController.current === progressiveController) speechController.current = null;
        setSpeaking(false);
      }
      setSend(false);
    }
  };

  useEffect(() => {
    if (explainQuestionHandledRef.current) return;
    const explainQuestion = new URL(window.location.href).searchParams.get("explain")?.trim();
    if (!explainQuestion) return;
    explainQuestionHandledRef.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    void handleSubmit(explainQuestion.slice(0, 3000));
  }, [handleSubmit]);

  const handleTestDirectOllama = async () => {
    if (send || directBusy) return;
    setDirectBusy(true);
    setDirectStatus("Checking Ollama and retrieving installed models…");
    setDirectResponseTime(null);
    const startedAt = performance.now();
    try {
      const models = await listDirectOllamaModels(directOllamaBaseUrl);
      const elapsedMs = Math.round(performance.now() - startedAt);
      const modelNames = models.map(({ name }) => name);
      setDirectModels(modelNames);
      setDirectModel((current) => modelNames.includes(current) ? current : modelNames[0] ?? "");
      setDirectResponseTime(elapsedMs);
      setDirectStatus(`Connected · ${modelNames.length} model${modelNames.length === 1 ? "" : "s"} available`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Direct Ollama connection failed.";
      setDirectModels([]);
      setDirectModel("");
      setDirectStatus(`Connection failed: ${message}`);
    } finally {
      setDirectBusy(false);
    }
  };

  const handleEditSubmittedQuestion = () => {
    voiceModeRef.current = false;
    setVoiceMode(false);
    recordingController.current?.abort();
    speechRequestController.current?.abort();
    chatRequestController.current?.abort();
    speechController.current?.abort();
    const history = conversationRef.current;
    const hasCurrentTurn = history.at(-2)?.role === "user"
      && history.at(-2)?.content === submittedPrompt
      && history.at(-1)?.role === "assistant"
      && history.at(-1)?.content === response;
    if (hasCurrentTurn) {
      const previous = history.slice(0, -2);
      conversationRef.current = previous;
      setConversation(previous);
    }
    setPrompt(submittedPrompt);
    setSubmittedPrompt("");
    setResponse("");
    setChatError("");
    setSpeaking(false);
  };

  // ============================================
  // ENTER KEY
  // ============================================

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>
  ) => {
    if (
      e.key === "Enter" &&
      !send &&
      !directBusy
    ) {
      handleSubmit();
    }
  };

  // ============================================
  // VOICE INPUT
  // ============================================

  const handleVoiceInput = async (automatic = false) => {
    if (automatic && !voiceModeRef.current) return;
    if (!automatic && voiceModeRef.current) {
      voiceModeRef.current = false;
      setVoiceMode(false);
      recordingController.current?.abort();
      speechRequestController.current?.abort();
      chatRequestController.current?.abort();
      speechController.current?.abort();
      audioRef.current?.pause();
      setSpeaking(false);
      return;
    }
    if (!automatic) {
      voiceModeRef.current = true;
      setVoiceMode(true);
      setSpeechError("");
    }

    const recording = new AbortController();
    const recognitionStartedAt = performance.now();
    recordingController.current = recording;
    try {
      // Tell UI that recording has started
      setListening(true);

      // Remove previous detected language
      setLanguage("");

      const audioBlob = await recordAudio(recording.signal);
      recordingController.current = null;
      setListening(false);
      if (!voiceModeRef.current) return;
      const formData = new FormData();

      formData.append(
        "audio",
        audioBlob,
        "recording.wav"
      );
      formData.append("language", speechLanguageChoice);

      const request = new AbortController();
      speechRequestController.current = request;
      const result = await fetch(
        "/api/speech",
        {
          method: "POST",
          body: formData,
          signal: request.signal,
        }
      );

      const data = await result.json();

      if (!result.ok) {
        throw new Error(
          data.error ||
            "Speech recognition failed"
        );
      }

      setLanguage(data.language || "");
      const transcript = typeof data.text === "string" ? data.text.trim() : "";
      console.info("[speech-timing] recognition complete", {
        recognitionMs: Math.round(performance.now() - recognitionStartedAt),
        language: data.language || "unknown",
        transcriptLength: transcript.length,
      });
      if (transcript && voiceModeRef.current) {
        const previousTranscript = lastVoiceSubmissionRef.current;
        if (previousTranscript && previousTranscript.text === transcript && performance.now() - previousTranscript.at < 8000) {
          console.info("[speech] ignored repeated transcript", { transcriptLength: transcript.length });
          return;
        }
        lastVoiceSubmissionRef.current = { text: transcript, at: performance.now() };
        setPrompt("");
        const result = await handleSubmit(transcript, data.language || "");
        if (voiceModeRef.current && result?.answer && !result.spokenProgressively) {
          await handleSpeak(result.answer, data.language || "");
        }
      }

    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Speech error:", error);
      voiceModeRef.current = false;
      setVoiceMode(false);
      setSpeechError(error instanceof Error ? error.message : "Voice input failed. Please try again.");
    } finally {
      recordingController.current = null;
      speechRequestController.current = null;
      setListening(false);
      if (voiceModeRef.current) {
        window.setTimeout(() => void handleVoiceInput(true), 100);
      }
    }
  };

  const handleSpeak = async (textToSpeak?: string, detectedLanguage = language) => {
    if (speaking && !textToSpeak) {
      speechController.current?.abort();
      speechController.current = null;
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
      setSpeaking(false);
      return;
    }
    const text = textToSpeak ?? response;
    if (!text) return;

    setSpeechError("");
    setSpeaking(true);
    const controller = new AbortController();
    speechController.current = controller;
    const speechStartedAt = performance.now();
    try {
      const cleanedText = cleanTextForSpeech(text);
      const speechLanguage = detectedLanguage || detectTextLanguage(cleanedText)?.code || "en";
      if (!["pa", "hi", "en"].includes(speechLanguage)) {
        await speakWithDeviceVoice(cleanedText, speechLanguage, controller.signal);
        setSpeaking(false);
        return;
      }

      const result = await fetch("/api/speech/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          text: cleanedText,
          language: speechLanguage,
        }),
      });
      if (!result.ok) {
        const errorData = await result.json().catch(() => ({}));
        throw new Error(errorData.error || "Speech audio could not be created.");
      }

      if (controller.signal.aborted) return;
      const audioUrl = URL.createObjectURL(await result.blob());
      audioUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      let firstAudioAt: number | null = null;
      await new Promise<void>((resolve) => {
        const finish = () => {
          URL.revokeObjectURL(audioUrl);
          audioUrlRef.current = null;
          setSpeaking(false);
          console.info("[speech-timing] playback complete", {
            firstAudioMs: firstAudioAt === null ? null : Math.round(firstAudioAt - speechStartedAt),
            totalPlaybackMs: Math.round(performance.now() - speechStartedAt),
          });
          resolve();
        };
        audio.onended = finish;
        audio.onerror = () => {
          setSpeechError("Could not play the generated audio.");
          finish();
        };
        controller.signal.addEventListener("abort", () => {
          audio.pause();
          finish();
        }, { once: true });
        audio.play().then(() => {
          if (firstAudioAt === null) firstAudioAt = performance.now();
        }).catch(() => {
          setSpeechError("Could not play the generated audio.");
          finish();
        });
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setSpeaking(false);
        return;
      }
      console.error("TTS error:", error);
      setSpeaking(false);
      setSpeechError(error instanceof Error ? error.message : "Speech audio failed.");
    } finally {
      if (speechController.current === controller) speechController.current = null;
    }
  };

  // ============================================
  // UI
  // ============================================

  return (
    <ChatUI
      prompt={prompt}
      submittedPrompt={submittedPrompt}
      conversation={conversation}
      response={response}
      chatError={chatError}
      send={send}

      onPromptChange={handleChange}
      onSubmit={(question) => handleSubmit(question)}
      onEditQuestion={handleEditSubmittedQuestion}
      onSuggestionSelect={(text) => {
        setLanguage("");
        setPrompt(text);
      }}
      onKeyDown={handleKeyDown}

      // NEW VOICE PROPS
      listening={listening}
      voiceMode={voiceMode}
      language={language || (prompt.trim().length >= 10 ? detectTextLanguage(prompt)?.code ?? "" : "")}
      speaking={speaking}
      speechError={speechError}
      onSpeak={() => handleSpeak()}
      onVoiceInput={() => handleVoiceInput()}
      onWeatherLoaded={setWeatherData}
      onLocationSelected={() => undefined}
      speechLanguageChoice={speechLanguageChoice}
      onSpeechLanguageChange={(event) => {
        const choice = event.target.value;
        setSpeechLanguageChoice(choice);
        try {
          window.localStorage.setItem("kisan-ai-language", choice);
        } catch {
          return;
        }
      }}
      directTestingEnabled={directTestingEnabled}
      chatMode={chatMode}
      directModels={directModels}
      directModel={directModel}
      directStatus={directStatus}
      directResponseTime={directResponseTime}
      directBusy={directBusy}
      directBaseUrl={directOllamaBaseUrl}
      onChatModeChange={(event) => setChatMode(event.target.value === "direct" ? "direct" : "backend")}
      onDirectModelChange={(event) => setDirectModel(event.target.value)}
      onTestDirectOllama={() => void handleTestDirectOllama()}
    />
    
  );
}
