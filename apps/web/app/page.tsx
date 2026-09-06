"use client";

import ReactMarkdown from "react-markdown";
import axios from "axios";
import "./app.css";

import {
  useState,
  ChangeEvent,
  KeyboardEvent,
  useRef,
  useEffect,
} from "react";


// =====================================================
// TYPES
// =====================================================

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  language?: string;
}

type AppMode = "chat" | "voice";


// =====================================================
// CONFIG
// =====================================================

const API_URL = "http://20.187.147.77:3001";


// =====================================================
// LANGUAGE NAMES
// =====================================================

const languageNames: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  pa: "Punjabi",
  bn: "Bengali",
  gu: "Gujarati",
  mr: "Marathi",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  ml: "Malayalam",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
};


// =====================================================
// APP
// =====================================================

export default function App() {

  // ---------------------------------------------------
  // INPUT
  // ---------------------------------------------------

  const [prompt, setPrompt] = useState("");


  // ---------------------------------------------------
  // CHAT HISTORY
  // ---------------------------------------------------

  const [messages, setMessages] =
    useState<Message[]>([]);


  // ---------------------------------------------------
  // LOADING
  // ---------------------------------------------------

  const [loading, setLoading] =
    useState(false);


  // ---------------------------------------------------
  // VOICE
  // ---------------------------------------------------

  const [voiceMode, setVoiceMode] =
    useState(false);

  const [listening, setListening] =
    useState(false);

  const [speaking, setSpeaking] =
    useState(false);

  const [speechLoading, setSpeechLoading] =
    useState(false);


  // ---------------------------------------------------
  // ERROR
  // ---------------------------------------------------

  const [error, setError] =
    useState("");


  // ---------------------------------------------------
  // AUDIO
  // ---------------------------------------------------

  const audioRef =
    useRef<HTMLAudioElement | null>(null);


  // ---------------------------------------------------
  // MESSAGE ID
  // ---------------------------------------------------

  const messageId =
    useRef(0);


  // ---------------------------------------------------
  // BOTTOM SCROLL
  // ---------------------------------------------------

  const bottomRef =
    useRef<HTMLDivElement | null>(null);


  // ===================================================
  // AUTO SCROLL
  // ===================================================

  useEffect(() => {

    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });

  }, [messages, loading]);


  // ===================================================
  // INPUT
  // ===================================================

  const handleChange = (
    e: ChangeEvent<HTMLInputElement>
  ) => {

    setPrompt(e.target.value);

  };


  // ===================================================
  // SEND MESSAGE
  // ===================================================

  const handleSubmit = async (
    text?: string
  ) => {

    const userText =
      (text ?? prompt).trim();


    if (!userText || loading) {
      return;
    }


    setError("");


    // -----------------------------------------------
    // ADD USER MESSAGE
    // -----------------------------------------------

    const userMessage: Message = {

      id: ++messageId.current,

      role: "user",

      content: userText,

    };


    setMessages(
      previous => [
        ...previous,
        userMessage,
      ]
    );


    setPrompt("");

    setLoading(true);


    try {

      // ---------------------------------------------
      // CALL WEATHER AI
      // ---------------------------------------------

      const response =
        await axios.get(

          `${API_URL}/weather-ai/${encodeURIComponent(
            userText
          )}`

        );


      const data =
        response.data;


      // ---------------------------------------------
      // ADD AI MESSAGE
      // ---------------------------------------------

      const assistantMessage: Message = {

        id: ++messageId.current,

        role: "assistant",

        content:
          data.message || "No response received.",

        language:
          data.language || "en",

      };


      setMessages(
        previous => [
          ...previous,
          assistantMessage,
        ]
      );


      // ---------------------------------------------
      // VOICE MODE
      // ---------------------------------------------

      if (
        voiceMode &&
        data.message
      ) {

        await speakText(

          data.message,

          data.language || "en"

        );

      }


    } catch (err) {

      console.error(
        "Weather AI error:",
        err
      );


      setError(
        "Something went wrong. Please try again."
      );


      setMessages(
        previous => [

          ...previous,

          {
            id: ++messageId.current,
            role: "assistant",
            content:
              "❌ Something went wrong while processing your request.",
          },

        ]
      );


    } finally {

      setLoading(false);

    }

  };


  // ===================================================
  // ENTER
  // ===================================================

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>
  ) => {

    if (e.key === "Enter") {

      e.preventDefault();

      handleSubmit();

    }

  };


  // ===================================================
  // CLEAN TEXT
  // ===================================================

  const cleanText = (
    text: string
  ) => {

    return text

      .replace(
        /```[\s\S]*?```/g,
        ""
      )

      .replace(
        /[*_#>`~]/g,
        ""
      )

      .replace(
        /\[([^\]]+)\]\([^)]+\)/g,
        "$1"
      )

      .replace(
        /\n+/g,
        " "
      )

      .replace(
        /\s+/g,
        " "
      )

      .trim();

  };


  // ===================================================
  // LANGUAGE → AZURE VOICE
  // ===================================================

  const getVoice = (
    language: string
  ) => {

    const voices: Record<string, string> = {

      en:
        "en-IN-NeerjaNeural",

      hi:
        "hi-IN-SwaraNeural",

      pa:
        "pa-IN-OjasNeural",

      bn:
        "bn-IN-TanishaaNeural",

      gu:
        "gu-IN-DhwaniNeural",

      mr:
        "mr-IN-AarohiNeural",

      ta:
        "ta-IN-PallaviNeural",

      te:
        "te-IN-ShrutiNeural",

      kn:
        "kn-IN-SapnaNeural",

      ml:
        "ml-IN-SobhanaNeural",

      fr:
        "fr-FR-DeniseNeural",

      de:
        "de-DE-KatjaNeural",

      es:
        "es-ES-ElviraNeural",

      it:
        "it-IT-ElsaNeural",

      ja:
        "ja-JP-NanamiNeural",

      ko:
        "ko-KR-SunHiNeural",

      zh:
        "zh-CN-XiaoxiaoNeural",

    };


    return (
      voices[language] ||
      voices.en
    );

  };


  // ===================================================
  // TEXT TO SPEECH
  // ===================================================

  const speakText = async (
    text: string,
    language: string
  ) => {

    if (!text) {
      return;
    }


    try {

      setSpeechLoading(true);

      setError("");


      // ---------------------------------------------
      // ASK BACKEND FOR AUDIO
      // ---------------------------------------------

      const response =
        await axios.post(

          `${API_URL}/tts`,

          {

            text:
              cleanText(text),

            language:
              language || "en",

            voice:
              getVoice(
                language?.split("-")[0] ||
                "en"
              ),

          },

          {

            responseType:
              "blob",

          }

        );


      // ---------------------------------------------
      // CREATE AUDIO
      // ---------------------------------------------

      const url =
        URL.createObjectURL(
          response.data
        );


      const audio =
        new Audio(url);


      audioRef.current =
        audio;


      audio.onplay = () => {

        setSpeaking(true);

      };


      audio.onended = () => {

        setSpeaking(false);

        URL.revokeObjectURL(url);

        audioRef.current =
          null;

      };


      audio.onerror = () => {

        setSpeaking(false);

        URL.revokeObjectURL(url);

        audioRef.current =
          null;

        setError(
          "Unable to play voice response."
        );

      };


      await audio.play();


    } catch (err) {

      console.error(
        "TTS error:",
        err
      );


      setError(
        "Unable to generate voice response."
      );


    } finally {

      setSpeechLoading(false);

    }

  };


  // ===================================================
  // STOP SPEAKING
  // ===================================================

  const stopSpeaking = () => {

    if (audioRef.current) {

      audioRef.current.pause();

      audioRef.current.currentTime =
        0;

      audioRef.current =
        null;

    }


    setSpeaking(false);

  };


  // ===================================================
  // VOICE MODE
  // ===================================================

  const toggleVoiceMode = () => {

    if (voiceMode) {

      if (speaking) {
        stopSpeaking();
      }

      setVoiceMode(false);

      setListening(false);

    } else {

      setVoiceMode(true);

    }

  };


  // ===================================================
  // MICROPHONE
  //
  // This button currently provides the UI hook.
  // Azure STT will be connected here.
  // ===================================================

  const handleMicrophone = () => {

    if (voiceMode) {

      setListening(
        previous => !previous
      );

    } else {

      setVoiceMode(true);

      setListening(true);

    }

  };


  // ===================================================
  // NEW CHAT
  // ===================================================

  const newChat = () => {

    stopSpeaking();

    setMessages([]);

    setPrompt("");

    setError("");

    setVoiceMode(false);

    setListening(false);

  };


  // ===================================================
  // UI
  // ===================================================

  return (

    <main className="gemini-app">


      {/* ============================================
          TOP NAVBAR
      ============================================ */}

      <header className="topbar">

        <div className="brand">

          <div className="brand-icon">
            🌤️
          </div>

          <span>
            Weather AI
          </span>

        </div>


        <div className="top-actions">

          <button
            className="new-chat-button"
            onClick={newChat}
          >
            + New chat
          </button>

          <div className="avatar">
            U
          </div>

        </div>

      </header>


      {/* ============================================
          CHAT AREA
      ============================================ */}

      <section className="chat-area">


        {/* ==========================================
            EMPTY STATE
        ========================================== */}

        {messages.length === 0 && (

          <div className="welcome">

            <div className="welcome-icon">
              🌤️
            </div>

            <h1>
              Hello! How can I help?
            </h1>

            <p>
              Ask me about weather anywhere in
              the world.
            </p>


            <div className="suggestions">


              <button
                onClick={() =>
                  setPrompt(
                    "What is the weather in Mumbai?"
                  )
                }
              >

                🌧️ Weather in Mumbai

              </button>


              <button
                onClick={() =>
                  setPrompt(
                    "Will it rain in Patiala today?"
                  )
                }
              >

                🌦️ Will it rain today?

              </button>


              <button
                onClick={() =>
                  setPrompt(
                    "What is the temperature in Delhi?"
                  )
                }
              >

                🌡️ Temperature in Delhi

              </button>


              <button
                onClick={() =>
                  setPrompt(
                    "What is the weather forecast?"
                  )
                }
              >

                🌍 Weather forecast

              </button>


            </div>

          </div>

        )}


        {/* ==========================================
            MESSAGES
        ========================================== */}

        {messages.length > 0 && (

          <div className="messages">


            {messages.map(
              message => (

                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "message user-message"
                      : "message assistant-message"
                  }
                >


                  {/* USER */}

                  {message.role === "user" && (

                    <div className="user-bubble">

                      {message.content}

                    </div>

                  )}


                  {/* AI */}

                  {message.role === "assistant" && (

                    <div className="assistant-content">


                      <div className="assistant-avatar">
                        🌤️
                      </div>


                      <div className="assistant-body">


                        <div className="assistant-name">
                          Weather AI

                          {message.language && (

                            <span className="language-badge">

                              🌍{" "}
                              {
                                languageNames[
                                  message.language
                                ] ||
                                message.language
                              }

                            </span>

                          )}

                        </div>


                        <div className="markdown">

                          <ReactMarkdown>

                            {message.content}

                          </ReactMarkdown>

                        </div>


                        {/* --------------------------------
                            RESPONSE ACTIONS
                        -------------------------------- */}

                        <div className="response-actions">


                          <button
                            onClick={() =>
                              speaking
                                ? stopSpeaking()
                                : speakText(
                                    message.content,
                                    message.language ||
                                      "en"
                                  )
                            }
                            disabled={
                              speechLoading
                            }
                            title="Read aloud"
                          >

                            {speaking
                              ? "⏹ Stop"
                              : speechLoading
                                ? "⏳"
                                : "🔊"}

                          </button>


                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(
                                message.content
                              )
                            }
                            title="Copy"
                          >

                            📋

                          </button>


                        </div>

                      </div>

                    </div>

                  )}

                </div>

              )
            )}


            {/* LOADING */}

            {loading && (

              <div className="assistant-content">

                <div className="assistant-avatar">
                  🌤️
                </div>

                <div className="assistant-body">

                  <div className="assistant-name">
                    Weather AI
                  </div>

                  <div className="thinking">

                    <span></span>
                    <span></span>
                    <span></span>

                  </div>

                </div>

              </div>

            )}


            <div
              ref={bottomRef}
            />

          </div>

        )}

      </section>


      {/* ============================================
          VOICE OVERLAY
      ============================================ */}

      {voiceMode && (

        <div className="voice-overlay">


          <div className="voice-window">


            <button
              className="voice-close"
              onClick={() => {

                if (speaking) {
                  stopSpeaking();
                }

                setVoiceMode(false);
                setListening(false);

              }}
            >

              ✕

            </button>


            <div className="voice-logo">
              🌤️
            </div>


            <h2>
              {listening
                ? "Listening..."
                : speaking
                  ? "Speaking..."
                  : "Voice mode"}
            </h2>


            <p>

              {listening
                ? "Speak naturally. I'm listening."
                : speaking
                  ? "Weather AI is speaking."
                  : "Tap the microphone and start talking."}

            </p>


            {/* VOICE BUTTON */}

            <button

              className={
                listening
                  ? "voice-button listening"
                  : "voice-button"
              }

              onClick={
                handleMicrophone
              }

            >

              {listening
                ? "⏹️"
                : "🎙️"}

            </button>


            {listening && (

              <div className="voice-wave">

                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>

              </div>

            )}


            <div className="voice-hint">

              {listening
                ? "Tap again to stop"
                : "Tap the microphone to speak"}

            </div>


          </div>

        </div>

      )}


      {/* ============================================
          ERROR
      ============================================ */}

      {error && (

        <div className="error-toast">

          ❌ {error}

          <button
            onClick={() =>
              setError("")
            }
          >
            ✕
          </button>

        </div>

      )}


      {/* ============================================
          COMPOSER
      ============================================ */}

      <footer className="composer-wrapper">


        <div className="composer">


          {/* PLUS */}

          <button
            className="composer-icon"
            title="More"
          >
            +
          </button>


          {/* INPUT */}

          <input

            type="text"

            value={prompt}

            onChange={
              handleChange
            }

            onKeyDown={
              handleKeyDown
            }

            disabled={
              loading
            }

            placeholder={
              voiceMode
                ? "Voice mode is active..."
                : "Ask Weather AI..."
            }

          />


          {/* MIC */}

          <button

            className={
              listening
                ? "composer-mic active"
                : "composer-mic"
            }

            onClick={
              handleMicrophone
            }

            disabled={
              loading
            }

            title="Voice"

          >

            {listening
              ? "🔴"
              : "🎙️"}

          </button>


          {/* SEND */}

          <button

            className={
              prompt.trim()
                ? "send-button active"
                : "send-button"
            }

            onClick={() =>
              handleSubmit()
            }

            disabled={
              loading ||
              !prompt.trim()
            }

            title="Send"

          >

            {loading
              ? "..."
              : "➤"}

          </button>

        </div>


        <div className="composer-footer">

          Weather AI can make mistakes.
          Check important information.

        </div>

      </footer>

    </main>

  );

}
