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

import {
  searchWeb,
  createWebContext,
  type SearchResult,
} from "./services/tavily";

import { askOllama } from "./services/ollama";
import { detectTextLanguage } from "./services/language";
import { recordAudio } from "./speech/speechRecorder";

import "./app.css";

const weatherQuestionPattern = /\b(weather|forecast|rain|rainfall|temperature|wind|windy|humidity|heat|cold|storm|cloud|spray|irrigat|mausam|barish|baarish|meeh|garmi|thand|hawa)\b|मौसम|बारिश|वर्षा|तापमान|हवा|आर्द्रता|तूफान|ਮੌਸਮ|ਮੀਂਹ|ਬਾਰਿਸ਼|ਤਾਪਮਾਨ|ਹਵਾ|ਨਮੀ|ਤੂਫ਼ਾਨ/i;

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
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [send, setSend] = useState(false);

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
  const speechRequestController = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speechController = useRef<AbortController | null>(null);
  const voiceModeRef = useRef(false);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    recordingController.current?.abort();
    speechRequestController.current?.abort();
    speechController.current?.abort();
    voiceModeRef.current = false;
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

  const getAnswer = async (question: string) => {
    let searchResults: SearchResult[] = [];
    try {
      searchResults = await searchWeb(question);
    } catch (searchError) {
      console.warn("Web search unavailable; answering without it.", searchError);
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
      webContext: createWebContext(searchResults),
      weatherContext,
      onChunk: setResponse,
    });
  };

  // ============================================
  // EXISTING SEND FUNCTION
  // ============================================

  const handleSubmit = async (voiceQuestion?: string) => {
    const question = (voiceQuestion ?? prompt).trim();
    if (!question || send) {
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

    setSend(true);
    setResponse("");

    try {
      return await getAnswer(question);
    } catch (error) {
      console.error(error);

      setResponse(
        error instanceof Error
          ? error.message
          : "The assistant could not be reached. Check your connection and try again."
      );
    } finally {
      setSend(false);
    }
  };

  // ============================================
  // ENTER KEY
  // ============================================

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>
  ) => {
    if (
      e.key === "Enter" &&
      !send
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
      if (transcript && voiceModeRef.current) {
        setPrompt("");
        const answer = await handleSubmit(transcript);
        if (voiceModeRef.current && answer) {
          await handleSpeak(answer, data.language || "");
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
      await new Promise<void>((resolve) => {
        const finish = () => {
          URL.revokeObjectURL(audioUrl);
          audioUrlRef.current = null;
          setSpeaking(false);
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
        audio.play().catch(() => {
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
      response={response}
      send={send}

      onPromptChange={handleChange}
      onSubmit={() => handleSubmit()}
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
      speechLanguageChoice={speechLanguageChoice}
      onSpeechLanguageChange={(event) => setSpeechLanguageChoice(event.target.value)}
    />
    
  );
}
