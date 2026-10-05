"use client";

import {
  useState,
  ChangeEvent,
  KeyboardEvent,
  useEffect,
  useRef,
} from "react";

import ChatUI from "./components/ChatUI";
import type { WeatherData } from "./components/WeatherWidget";

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

function buildWeatherContext(weather: WeatherData) {
  const location = [weather.location, weather.country].filter(Boolean).join(", ");
  const periods = weather.todayForecast.length > 0
    ? weather.todayForecast.map((period) =>
      `${period.time}: ${period.temperatureC}°C, ${period.description}, ${period.rainChance}% chance of rain`
    ).join("\n")
    : "No further 3-hour forecast periods are available for today.";

  return `Location: ${location}\nRetrieved from OpenWeather at ${weather.fetchedAt} (UTC). Forecast times are local to the location.\nCurrent conditions: ${weather.temperatureC}°C, ${weather.description}; feels like ${weather.feelsLikeC}°C, humidity ${weather.humidity}%, wind ${weather.windKmh} km/h.\nForecast for the rest of today:\n${periods}`;
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

    const weatherContext = weatherData && weatherQuestionPattern.test(question)
      ? buildWeatherContext(weatherData)
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
