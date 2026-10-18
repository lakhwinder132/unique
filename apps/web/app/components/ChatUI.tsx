"use client";

import "./fieldwise.css";
import "./kisan-chat.css";

import ReactMarkdown from "react-markdown";
import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpenText,
  CloudSun,
  Headphones,
  Leaf,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Send,
  Sprout,
  Wheat,
  X,
} from "lucide-react";
import { getLanguageName } from "../services/language";
import WeatherWidget from "./WeatherWidget";
import type { WeatherData } from "../services/weather";

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
  { label: "Crop advisory", icon: Sprout, prompt: "Can you give me practical crop advisory for my farm?" },
  { label: "Weather", icon: CloudSun, prompt: "What weather should I plan around for my farm this week?" },
  { label: "Mandi rates", icon: Wheat, prompt: "What should I know about today's mandi rates before selling my crop?" },
  { label: "Farming knowledge", icon: BookOpenText, prompt: "Help me learn more about farming practices for my crops." },
];

const recentChats = [
  "Wheat irrigation schedule",
  "Yellowing leaves in mustard",
  "Preparing soil for vegetables",
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
  directTestingEnabled,
  chatMode,
  directModels,
  directModel,
  directStatus,
  directResponseTime,
  directBusy,
  directBaseUrl,
  onPromptChange,
  onSubmit,
  onSuggestionSelect,
  onVoiceInput,
  onSpeak,
  onWeatherLoaded,
  onSpeechLanguageChange,
  onKeyDown,
  onChatModeChange,
  onDirectModelChange,
  onTestDirectOllama,
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
          <p className="sidebar-label">YOUR FARM</p>
          <nav className="primary-navigation">
            {navigation.map(({ label, icon: Icon, prompt: navigationPrompt }) => (
              <button className={`navigation-link${activeNavigation === label ? " is-active" : ""}`} type="button" key={label} onClick={() => choosePrompt(navigationPrompt, label)}>
                <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === "Weather" && <span className="navigation-dot" aria-label="Available" />}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-section recent-section">
          <div className="recent-heading"><p className="sidebar-label">RECENT CHATS</p><button type="button" aria-label="More chat history"><ArrowRight size={14} /></button></div>
          <div className="recent-list">
            {recentChats.map((chat) => <button className="recent-chat" type="button" key={chat} onClick={() => choosePrompt(chat)}><MessageCircle size={15} strokeWidth={1.75} /><span>{chat}</span></button>)}
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-season"><span className="season-icon"><Leaf size={16} /></span><span><small>IN SEASON</small><strong>Rabi · Punjab</strong></span><ArrowUpRight size={14} /></div>
          <div className="farmer-profile"><span className="profile-avatar">PS</span><span className="profile-copy"><strong>Punjab grower</strong><small>Farmer account</small></span><span className="profile-menu" aria-hidden="true">···</span></div>
        </div>
      </aside>

      <section className="chat-workspace">
        <header className="chat-header">
          <div className="header-leading"><button className="mobile-menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation menu"><Menu size={20} /></button><span className="header-page-title">Your farm assistant</span></div>
          <div className="header-tools">
            <span className="location-pill"><MapPin size={14} /><span>{weatherLocation || "Farm weather"}</span></span><span className="header-divider" />
            <label className="language-select" htmlFor="speech-language"><span>Language</span>
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
          {!response && !send && (
            <section className="welcome weather-home-welcome" aria-label="Punjabi farm weather">
              <WeatherWidget language={speechLanguageChoice === "auto" ? language ?? "en" : speechLanguageChoice} onWeatherLoaded={(weather) => {
                setWeatherLocation([weather.location, weather.country].filter(Boolean).join(", "));
                onWeatherLoaded(weather);
              }} onAskAssistant={(question) => onSubmit(question)} />
            </section>
          )}

          {(send || response) && <div className="message user-message"><div className="message-body"><div className="message-name">You</div><div className="message-text">{submittedPrompt}</div></div></div>}

          {(response || send) && (
            <div className="message ai-message">
              <div className="avatar ai-avatar" aria-hidden="true"><Sprout size={19} /></div>
              <div className="message-body">
                <div className="message-name">Kisan AI <span>FARM ASSISTANT</span></div>
                <div className="message-text" aria-live="polite">
                  {response ? <><ReactMarkdown>{response}</ReactMarkdown><button type="button" className="speak-button" onClick={onSpeak} disabled={send} aria-label={speaking ? "Stop audio" : "Listen to answer"}><Headphones size={16} />{speaking ? "Stop audio" : "Listen to answer"}</button></> : <div className="thinking" role="status"><span /><span /><span /><p>Finding helpful guidance…</p></div>}
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="chat-input-area">
          {directTestingEnabled && (
            <section className="direct-ollama-panel" aria-label="Direct Ollama test controls">
              <div className="direct-ollama-controls">
                <label>
                  <span>Chat connection</span>
                  <select value={chatMode} onChange={onChatModeChange} disabled={send || directBusy || voiceMode}>
                    <option value="backend">Farmer AI backend</option>
                    <option value="direct">Direct remote Ollama (test)</option>
                  </select>
                </label>
                {chatMode === "direct" && (
                  <>
                    <label>
                      <span>Ollama model</span>
                      <select value={directModel} onChange={onDirectModelChange} disabled={send || directBusy || !directModels.length}>
                        <option value="">Test connection to list models</option>
                        {directModels.map((model) => <option value={model} key={model}>{model}</option>)}
                      </select>
                    </label>
                    <button type="button" onClick={onTestDirectOllama} disabled={send || directBusy}>
                      {directBusy ? "Connecting…" : "Test / list models"}
                    </button>
                  </>
                )}
              </div>
              {chatMode === "direct" && (
                <p className="direct-ollama-status" role="status" aria-live="polite">
                  {directStatus || `Direct requests go to ${directBaseUrl || "NEXT_PUBLIC_OLLAMA_TEST_URL (not configured)"}`}
                  {directResponseTime !== null && ` · ${directResponseTime} ms`}
                </p>
              )}
            </section>
          )}
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