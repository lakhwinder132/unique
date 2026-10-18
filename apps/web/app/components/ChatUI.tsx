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

const interfaceCopy = {
  pa: { home: "ਕਿਸਾਨ AI ਮੁੱਖ ਪੰਨਾ", tagline: "ਤੁਹਾਡਾ ਖੇਤ, ਸਾਡੀ ਦੇਖਭਾਲ", newChat: "ਨਵੀਂ ਗੱਲਬਾਤ", askAbout: "ਇਸ ਬਾਰੇ ਪੁੱਛੋ", topics: ["ਫ਼ਸਲ ਦੀ ਦੇਖਭਾਲ", "ਮੌਸਮ ਅਤੇ ਖੇਤ ਦਾ ਕੰਮ", "ਮਿੱਟੀ ਬਾਰੇ ਸਵਾਲ", "ਫ਼ਸਲ ਵੇਚਣਾ"], languageNote: "ਪੰਜਾਬੀ, ਹਿੰਦੀ ਜਾਂ ਅੰਗਰੇਜ਼ੀ ਵਿੱਚ ਪੁੱਛੋ", assistant: "ਖੇਤੀ ਸਹਾਇਕ", location: "ਖੇਤ ਦਾ ਮੌਸਮ", language: "ਭਾਸ਼ਾ", auto: "ਆਪਣੇ ਆਪ ਪਛਾਣੋ", you: "ਤੁਸੀਂ", thinking: "ਮਦਦਗਾਰ ਜਾਣਕਾਰੀ ਲੱਭ ਰਹੇ ਹਾਂ…", retry: "ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ", askKisan: "ਕਿਸਾਨ AI ਨੂੰ ਪੁੱਛੋ", ready: "ਤਿਆਰ ਹਾਂ", listening: "ਸੁਣ ਰਹੇ ਹਾਂ… ਹੁਣ ਬੋਲੋ", voice: "ਆਵਾਜ਼", stop: "ਰੋਕੋ", send: "ਸੁਨੇਹਾ ਭੇਜੋ", mistakes: "ਕਿਸਾਨ AI ਤੋਂ ਗਲਤੀ ਹੋ ਸਕਦੀ ਹੈ। ਮਹੱਤਵਪੂਰਨ ਸਲਾਹ ਸਥਾਨਕ ਖੇਤੀ ਮਾਹਿਰ ਨਾਲ ਪੱਕੀ ਕਰੋ।" },
  hi: { home: "किसान AI मुख्य पृष्ठ", tagline: "आपका खेत, हमारी देखभाल", newChat: "नई बातचीत", askAbout: "इसके बारे में पूछें", topics: ["फसल की देखभाल", "मौसम और खेत का काम", "मिट्टी के सवाल", "फसल बेचना"], languageNote: "हिंदी, पंजाबी या अंग्रेज़ी में पूछें", assistant: "खेती सहायक", location: "खेत का मौसम", language: "भाषा", auto: "अपने आप पहचानें", you: "आप", thinking: "उपयोगी जानकारी खोज रहे हैं…", retry: "फिर कोशिश करें", askKisan: "किसान AI से पूछें", ready: "पूछने के लिए तैयार", listening: "सुन रहे हैं… अब बोलें", voice: "आवाज़", stop: "रोकें", send: "संदेश भेजें", mistakes: "किसान AI से गलती हो सकती है। ज़रूरी सलाह स्थानीय कृषि विशेषज्ञ से जाँचें।" },
  en: { home: "Kisan AI home", tagline: "Your farm, in good hands", newChat: "New chat", askAbout: "ASK ABOUT", topics: ["Crop care", "Weather & field work", "Soil questions", "Selling a crop"], languageNote: "Ask in English, Punjabi, or Hindi.", assistant: "Farm assistant", location: "Farm weather", language: "Language", auto: "Auto-detect", you: "You", thinking: "Finding helpful guidance…", retry: "Try again", askKisan: "Ask Kisan AI", ready: "Ready when you are", listening: "Listening… speak now", voice: "Voice", stop: "Stop", send: "Send message", mistakes: "Kisan AI can make mistakes. Confirm important advice with your local agricultural expert." },
} as const;

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
  const uiLanguage = speechLanguageChoice === "auto" ? language ?? "pa" : speechLanguageChoice;
  const copy = interfaceCopy[uiLanguage === "hi" ? "hi" : uiLanguage === "en" ? "en" : "pa"];

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
    <div className={`chat-app${sidebarOpen ? " sidebar-open" : ""}`} lang={uiLanguage}>
      <button className="sidebar-scrim" type="button" aria-label="Close navigation menu" onClick={() => setSidebarOpen(false)} tabIndex={sidebarOpen ? 0 : -1} />

      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="/" aria-label={copy.home}>
          <span className="brand-mark" aria-hidden="true"><Sprout size={21} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>Kisan AI</strong><small>{copy.tagline}</small></span>
        </a>

        <a className="new-chat-button" href="/"><Plus size={17} strokeWidth={2.2} /><span>{copy.newChat}</span><span className="new-chat-shortcut">⌘ K</span></a>

        <div className="sidebar-section">
          <p className="sidebar-label">{copy.askAbout}</p>
          <nav className="primary-navigation">
            {navigation.map(({ label, icon: Icon, prompt: navigationPrompt }, index) => (
              <button className={`navigation-link${activeNavigation === label ? " is-active" : ""}`} type="button" key={label} onClick={() => choosePrompt(navigationPrompt, label)}>
                <Icon size={17} strokeWidth={1.8} /><span>{copy.topics[index]}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-language-note"><BookOpenText size={17} aria-hidden="true" /><p>{copy.languageNote}</p></div>
        </div>
      </aside>

      <section className="chat-workspace">
        <header className="chat-header">
          <div className="header-leading"><button className="mobile-menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label={uiLanguage === "hi" ? "नेविगेशन खोलें" : uiLanguage === "en" ? "Open navigation menu" : "ਮੁੱਖ ਸੂਚੀ ਖੋਲ੍ਹੋ"}><Menu size={20} /></button><span className="header-page-title">{copy.assistant}</span></div>
          <div className="header-tools">
            <span className="location-pill"><MapPin size={14} /><span>{weatherLocation || copy.location}</span></span><span className="header-divider" />
            <label className="language-select" htmlFor="speech-language"><span>{copy.language}</span>
              <select id="speech-language" value={speechLanguageChoice} onChange={onSpeechLanguageChange} disabled={voiceMode || send}>
                <option value="auto">{copy.auto}</option><option value="pa">ਪੰਜਾਬੀ</option><option value="hi">हिन्दी</option><option value="en">English</option>
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
              <WeatherWidget language={uiLanguage} onWeatherLoaded={(weather) => {
                setWeatherLocation([weather.location, weather.country].filter(Boolean).join(", "));
                onWeatherLoaded(weather);
              }} onAskAssistant={(question) => onSubmit(question)} />
            </section>
          )}

          {(send || response || chatError) && <div className="message user-message"><div className="message-body"><div className="message-name">{copy.you}</div><div className="message-text">{submittedPrompt}</div></div></div>}

          {(response || send || chatError) && (
            <div className="message ai-message">
              <div className="avatar ai-avatar" aria-hidden="true"><Sprout size={19} /></div>
              <div className="message-body">
                <div className="message-name">Kisan AI <span>{uiLanguage === "pa" ? "ਖੇਤੀ ਸਹਾਇਕ" : uiLanguage === "hi" ? "खेती सहायक" : "FARM ASSISTANT"}</span></div>
                <div className="message-text" aria-live="polite">
                  {response && <ReactMarkdown>{response}</ReactMarkdown>}
                  {send && !response && <div className="thinking" role="status"><span /><span /><span /><p>{copy.thinking}</p></div>}
                  {response && !chatError && <button type="button" className="speak-button" onClick={onSpeak} disabled={send} aria-label={speaking ? copy.stop : uiLanguage === "pa" ? "ਜਵਾਬ ਸੁਣੋ" : uiLanguage === "hi" ? "जवाब सुनें" : "Listen to answer"}><Headphones size={16} />{speaking ? copy.stop : uiLanguage === "pa" ? "ਜਵਾਬ ਸੁਣੋ" : uiLanguage === "hi" ? "जवाब सुनें" : "Listen to answer"}</button>}
                  {chatError && <div className="chat-error" role="alert"><p>{chatError}</p><button type="button" onClick={() => onSubmit(submittedPrompt)} disabled={send}>{copy.retry}</button></div>}
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="chat-input-area">
          <div className="composer-wrap">
            <div className="composer-label"><span className="composer-mark"><Sprout size={14} /></span><span>{copy.askKisan}</span><span className="composer-language">{language ? getLanguageName(language) : copy.ready}</span></div>
            <div className="chat-input-wrapper">
              <input type="text" placeholder={listening ? copy.listening : uiLanguage === "hi" ? "फसल, मिट्टी या कीट के बारे में पूछें…" : uiLanguage === "en" ? "Ask about crops, soil, or pests…" : "ਫ਼ਸਲ, ਮਿੱਟੀ ਜਾਂ ਕੀੜਿਆਂ ਬਾਰੇ ਪੁੱਛੋ…"} value={prompt} onChange={onPromptChange} onKeyDown={onKeyDown} disabled={send || directBusy || listening || voiceMode} aria-label={copy.askKisan} />
              <button className={`voice-button${listening ? " listening" : ""}`} type="button" onClick={onVoiceInput} disabled={directBusy || (send && !voiceMode)} aria-label={voiceMode ? copy.stop : copy.voice} title={voiceMode ? copy.stop : copy.voice}>{voiceMode ? <X size={17} /> : <AudioLines size={17} />}<span>{voiceMode ? copy.stop : listening ? (uiLanguage === "pa" ? "ਸੁਣੋ" : uiLanguage === "hi" ? "सुनें" : "Listening") : copy.voice}</span></button>
              <button className="send-button" type="button" onClick={() => onSubmit()} disabled={send || directBusy || voiceMode || !prompt.trim()} aria-label={copy.send} title={copy.send}>{send ? <span className="send-spinner" /> : <Send size={18} strokeWidth={2} />}</button>
            </div>
          </div>
          <div className="input-meta">
            {voiceMode && <p className="voice-mode-status" aria-live="polite">{listening ? copy.listening : send ? copy.thinking : speaking ? (uiLanguage === "pa" ? "ਬੋਲ ਰਹੇ ਹਾਂ…" : uiLanguage === "hi" ? "बोल रहे हैं…" : "Speaking…") : uiLanguage === "pa" ? "ਆਵਾਜ਼ੀ ਗੱਲਬਾਤ ਚਾਲੂ ਹੈ" : uiLanguage === "hi" ? "आवाज़ बातचीत चालू है" : "Voice conversation active"}</p>}
            {speechError && <p className="speech-error" role="status">{speechError}</p>}
            <p className="input-hint">{copy.mistakes}</p>
          </div>
        </footer>
      </section>
    </div>
  );
}
