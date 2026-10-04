"use client";

import "./chatui.css";
import "./fieldwise.css";

import ReactMarkdown from "react-markdown";
import { ChangeEvent, KeyboardEvent, useEffect, useRef } from "react";
import WeatherWidget, { type WeatherData } from "./WeatherWidget";

type ChatUIProps = {
  prompt: string;
  submittedPrompt: string;
  response: string;
  send: boolean;
  listening: boolean;
  voiceMode: boolean;
  language: string | null;
  speaking: boolean;
  speechError: string;
  speechLanguageChoice: string;
  onWeatherLoaded: (weather: WeatherData) => void;
  onPromptChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onSuggestionSelect: (text: string) => void;
  onVoiceInput: () => void;
  onSpeak: () => void;
  onSpeechLanguageChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
};

const suggestions = [
  { number: "01", title: "Crop care", text: "How do I care for my wheat crop this week?" },
  { number: "02", title: "Pests & disease", text: "What should I check if my crop leaves are turning yellow?" },
  { number: "03", title: "Soil & water", text: "How can I improve the soil in my field?" },
];

export default function ChatUI({
  prompt,
  submittedPrompt,
  response,
  send,
  listening,
  voiceMode,
  language,
  speaking,
  speechError,
  speechLanguageChoice,
  onWeatherLoaded,
  onPromptChange,
  onSubmit,
  onSuggestionSelect,
  onVoiceInput,
  onSpeak,
  onSpeechLanguageChange,
  onKeyDown,
}: ChatUIProps) {
  const messagesContainerRef = useRef<HTMLElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (container) container.scrollTo({ top: container.scrollHeight, behavior });
    });
  };

  useEffect(() => {
    if (!send) return;
    shouldAutoScrollRef.current = true;
    scrollToBottom("smooth");
  }, [send]);

  useEffect(() => {
    if (response && shouldAutoScrollRef.current) scrollToBottom("auto");
  }, [response]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !send) return;
    const reply = container.querySelector(".ai-message .message-body");
    if (!reply) return;
    const observer = new ResizeObserver(() => {
      if (shouldAutoScrollRef.current) scrollToBottom("auto");
    });
    observer.observe(reply);
    return () => observer.disconnect();
  }, [send]);

  return (
    <div className="chat-app">
      <header className="chat-header">
        <a className="brand" href="/" aria-label="Fieldwise home">
          <span className="brand-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 21v-9m0 4c-5 0-8-3-8-8 5 0 8 3 8 8Zm0-4c0-5 3-8 8-8 0 5-3 8-8 8Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="brand-copy"><strong>Fieldwise</strong><small>Farmer assistant</small></span>
        </a>
        <div className="header-note"><span className="status-dot" /> Practical help for your farm</div>
      </header>

      <main
        ref={messagesContainerRef}
        className="chat-messages"
        onScroll={(event) => {
          const container = event.currentTarget;
          shouldAutoScrollRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 96;
        }}
      >
        {!response && !send && (
          <section className="welcome">
            <div className="welcome-eyebrow"><span>✳</span> YOUR FARM, YOUR NEXT STEP</div>
            <h1>Good farming starts<br className="desktop-break" /> with a good question.</h1>
            <p>Practical guidance for crops, soil, pests and weather on your farm.</p>
            <WeatherWidget onWeatherLoaded={onWeatherLoaded} />
            <div className="suggestion-heading">A few things you can ask</div>
            <div className="suggestion-grid">
              {suggestions.map((item) => (
                <button className="suggestion-card" key={item.title} onClick={() => onSuggestionSelect(item.text)}>
                  <span className="suggestion-number">{item.number}</span>
                  <span className="suggestion-card-copy"><strong>{item.title}</strong><span>{item.text}</span></span>
                  <span className="suggestion-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
            <div className="welcome-footnote"><span aria-hidden="true">⌁</span> Ask in English, Hindi or Punjabi</div>
          </section>
        )}

        {(send || response) && (
          <div className="message user-message">
            <div className="message-body">
              <div className="message-name">You</div>
              <div className="message-text">{submittedPrompt}</div>
            </div>
          </div>
        )}

        {(response || send) && (
          <div className="message ai-message">
            <div className="avatar ai-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v2m-6.5 1.5 1.4 1.4M3 13h2m14 0h2m-3.9-5.1 1.4-1.4M7 19h10a3 3 0 0 0 3-3v-3a8 8 0 0 0-16 0v3a3 3 0 0 0 3 3Zm1-7h.01M16 12h.01M9 16h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div className="message-body">
              <div className="message-name">Fieldwise <span>FARM ASSISTANT</span></div>
              <div className="message-text" aria-live="polite">
                {response ? (
                  <>
                    <ReactMarkdown>{response}</ReactMarkdown>
                    <button type="button" className="speak-button" onClick={onSpeak} disabled={send} aria-label={speaking ? "Stop audio" : "Listen to answer"}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Zm4 4a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {speaking ? "Stop audio" : "Listen to answer"}
                    </button>
                  </>
                ) : (
                  <div className="thinking" role="status"><span /><span /><span /><p>Finding helpful guidance…</p></div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="chat-input-area">
        <div className="chat-input-wrapper">
          <input
            type="text"
            placeholder={listening ? "Listening… speak now" : "Ask about your crops, soil, pests…"}
            value={prompt}
            onChange={onPromptChange}
            onKeyDown={onKeyDown}
            disabled={send || listening || voiceMode}
            aria-label="Ask Fieldwise a farming question"
          />
          <button className={`voice-button${listening ? " listening" : ""}`} onClick={onVoiceInput} disabled={send && !voiceMode} aria-label={voiceMode ? "Stop voice conversation" : "Start voice conversation"}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M5 11a7 7 0 0 0 14 0m-7 7v3m-4 0h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            <span>{voiceMode ? "Stop" : listening ? "Listening" : "Voice"}</span>
          </button>
          <button className="send-button" onClick={onSubmit} disabled={send || voiceMode || !prompt.trim()} aria-label="Send message">
            {send ? <span className="send-spinner" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-5 16-3-6-8-2Zm8 2 4-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </button>
        </div>

        <div className="input-meta">
          <label className="speech-language-control" htmlFor="speech-language">
            <span>Voice language</span>
            <select id="speech-language" value={speechLanguageChoice} onChange={onSpeechLanguageChange} disabled={voiceMode || send}>
              <option value="pa">Punjabi</option><option value="hi">Hindi</option><option value="en">English</option>
            </select>
          </label>
          {voiceMode && <p className="voice-mode-status" aria-live="polite">{listening ? "Listening…" : send ? "Thinking…" : speaking ? "Speaking…" : "Voice conversation active"}</p>}
          {language && <p className="voice-language">Detected: {language === "pa" ? "Punjabi" : language === "hi" ? "Hindi" : language === "en" ? "English" : language}</p>}
          <p className="input-hint">AI can make mistakes. Confirm important advice with a local agricultural expert.</p>
        </div>
        {speechError && <p className="speech-error input-speech-error" role="status">{speechError}</p>}
      </footer>
    </div>
  );
}
