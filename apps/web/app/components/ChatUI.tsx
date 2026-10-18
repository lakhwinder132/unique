"use client";

import "./fieldwise.css";
import "./kisan-chat.css";

import ReactMarkdown from "react-markdown";
import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  AudioLines,
  BookOpenText,
  CloudSun,
  Headphones,
  MapPin,
  Menu,
  Plus,
  Send,
  Sprout,
  X,
} from "lucide-react";
import { getLanguageName } from "../services/language";
import WeatherWidget from "./WeatherWidget";
import type { WeatherData } from "../services/weather";

type ChatUIProps = {
  prompt: string;
  submittedPrompt: string;
  response: string;
  chatError: string;
  send: boolean;
  listening: boolean;
  voiceMode: boolean;
  language: string | null;
  speaking: boolean;
  speechError: string;
  speechLanguageChoice: string;
  directTestingEnabled: boolean;
  chatMode: "backend" | "direct";
  directModels: string[];
  directModel: string;
  directStatus: string;
  directResponseTime: number | null;
  directBusy: boolean;
  directBaseUrl: string;
  onWeatherLoaded: (weather: WeatherData) => void;
  onPromptChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (prompt?: string) => void;
  onSuggestionSelect: (text: string) => void;
  onVoiceInput: () => void;
  onSpeak: () => void;
  onSpeechLanguageChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onChatModeChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onDirectModelChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onTestDirectOllama: () => void;
};

const navigation = [
  { label: "Crop care", icon: Sprout, prompt: "What details do you need to give useful advice about my crop?" },
  { label: "Weather & field work", icon: CloudSun, prompt: "Help me understand the weather for planning field work today." },
  { label: "Soil questions", icon: BookOpenText, prompt: "What should I check before changing my soil or fertilizer plan?" },
  { label: "Selling a crop", icon: CloudSun, prompt: "What should I verify before selling my crop at the mandi?" },
];

export default function ChatUI({
  prompt,
  submittedPrompt,
  response,
  chatError,
  send,
  listening,
  voiceMode,
  language,
  speaking,
  speechError,
  speechLanguageChoice,
  directBusy,
  onPromptChange,
  onSubmit,
  onSuggestionSelect,
  onVoiceInput,
  onSpeak,
  onWeatherLoaded,
  onSpeechLanguageChange,
  onKeyDown,
}: ChatUIProps) {
  const messagesContainerRef = useRef<HTMLElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNavigation, setActiveNavigation] = useState("New chat");
  const [weatherLocation, setWeatherLocation] = useState("");

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

  const choosePrompt = (text: string, section?: string) => {
    if (section) setActiveNavigation(section);
    setSidebarOpen(false);
    onSuggestionSelect(text);
  };

  return (
    <div className={`chat-app${sidebarOpen ? " sidebar-open" : ""}`}>
      <button className="sidebar-scrim" type="button" aria-label="Close navigation menu" onClick={() => setSidebarOpen(false)} tabIndex={sidebarOpen ? 0 : -1} />

      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="/" aria-label="Kisan AI home">
          <span className="brand-mark" aria-hidden="true"><Sprout size={21} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>Kisan AI</strong><small>Your farm, in good hands</small></span>
        </a>

        <a className="new-chat-button" href="/"><Plus size={17} strokeWidth={2.2} /><span>New chat</span><span className="new-chat-shortcut">⌘ K</span></a>

        <div className="sidebar-section">
          <p className="sidebar-label">ASK ABOUT</p>
          <nav className="primary-navigation">
            {navigation.map(({ label, icon: Icon, prompt: navigationPrompt }) => (
              <button className={`navigation-link${activeNavigation === label ? " is-active" : ""}`} type="button" key={label} onClick={() => choosePrompt(navigationPrompt, label)}>
                <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === "Weather" && <span className="navigation-dot" aria-label="Available" />}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-language-note"><BookOpenText size={17} aria-hidden="true" /><p>Ask in English, Punjabi, or Hindi.</p></div>
        </div>
      </aside>

      <section className="chat-workspace">
        <header className="chat-header">
          <div className="header-leading"><button className="mobile-menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation menu"><Menu size={20} /></button><span className="header-page-title">Farm assistant</span></div>
          <div className="header-tools">
            <span className="location-pill"><MapPin size={14} /><span>{weatherLocation || "Farm weather"}</span></span><span className="header-divider" />
            <label className="language-select" htmlFor="speech-language"><span>Voice language</span>
              <select id="speech-language" value={speechLanguageChoice} onChange={onSpeechLanguageChange} disabled={voiceMode || send}>
                <option value="auto">Auto-detect</option><option value="pa">Punjabi</option><option value="hi">Hindi</option><option value="en">English</option>
              </select>
            </label>
          </div>
        </header>

        <main ref={messagesContainerRef} className="chat-messages" onScroll={(event) => {
          const container = event.currentTarget;
          shouldAutoScrollRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 96;
        }}>
          {!response && !send && !chatError && (
            <section className="welcome weather-home-welcome" aria-label="Local farm weather">
              <WeatherWidget language={speechLanguageChoice === "auto" ? language ?? "en" : speechLanguageChoice} onWeatherLoaded={(weather) => {
                setWeatherLocation([weather.location, weather.country].filter(Boolean).join(", "));
                onWeatherLoaded(weather);
              }} onAskAssistant={(question) => onSubmit(question)} />
            </section>
          )}

          {(send || response || chatError) && <div className="message user-message"><div className="message-body"><div className="message-name">You</div><div className="message-text">{submittedPrompt}</div></div></div>}

          {(response || send || chatError) && (
            <div className="message ai-message">
              <div className="avatar ai-avatar" aria-hidden="true"><Sprout size={19} /></div>
              <div className="message-body">
                <div className="message-name">Kisan AI <span>FARM ASSISTANT</span></div>
                <div className="message-text" aria-live="polite">
                  {response && <ReactMarkdown>{response}</ReactMarkdown>}
                  {send && !response && <div className="thinking" role="status"><span /><span /><span /><p>Finding helpful guidance…</p></div>}
                  {response && !chatError && <button type="button" className="speak-button" onClick={onSpeak} disabled={send} aria-label={speaking ? "Stop audio" : "Listen to answer"}><Headphones size={16} />{speaking ? "Stop audio" : "Listen to answer"}</button>}
                  {chatError && <div className="chat-error" role="alert"><p>{chatError}</p><button type="button" onClick={() => onSubmit(submittedPrompt)} disabled={send}>Try again</button></div>}
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="chat-input-area">
          <div className="composer-wrap">
            <div className="composer-label"><span className="composer-mark"><Sprout size={14} /></span><span>Ask Kisan AI</span><span className="composer-language">{language ? getLanguageName(language) : "Ready when you are"}</span></div>
            <div className="chat-input-wrapper">
              <input type="text" placeholder={listening ? "Listening… speak now" : "Ask about your crops, soil, pests…"} value={prompt} onChange={onPromptChange} onKeyDown={onKeyDown} disabled={send || directBusy || listening || voiceMode} aria-label="Ask Kisan AI a farming question" />
              <button className={`voice-button${listening ? " listening" : ""}`} type="button" onClick={onVoiceInput} disabled={directBusy || (send && !voiceMode)} aria-label={voiceMode ? "Stop voice conversation" : "Start voice conversation"} title={voiceMode ? "Stop voice conversation" : "Voice input"}>{voiceMode ? <X size={17} /> : <AudioLines size={17} />}<span>{voiceMode ? "Stop" : listening ? "Listening" : "Voice"}</span></button>
              <button className="send-button" type="button" onClick={() => onSubmit()} disabled={send || directBusy || voiceMode || !prompt.trim()} aria-label="Send message" title="Send message">{send ? <span className="send-spinner" /> : <Send size={18} strokeWidth={2} />}</button>
            </div>
          </div>
          <div className="input-meta">
            {voiceMode && <p className="voice-mode-status" aria-live="polite">{listening ? "Listening…" : send ? "Thinking…" : speaking ? "Speaking…" : "Voice conversation active"}</p>}
            {speechError && <p className="speech-error" role="status">{speechError}</p>}
            <p className="input-hint">Kisan AI can make mistakes. Confirm important advice with your local agricultural expert.</p>
          </div>
        </footer>
      </section>
    </div>
  );
}
