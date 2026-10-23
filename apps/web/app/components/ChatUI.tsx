"use client";

import "./fieldwise.css";
import "./kisan-chat.css";

import ReactMarkdown from "react-markdown";
import { BatteryDisplay } from "./HomeStatusPanel";
import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  AudioLines,
  BookOpenText,
  CloudSun,
  Headphones,
  LoaderCircle,
  Menu,
  Newspaper,
  Plus,
  Send,
  Sprout,
  WifiOff,
  X,
} from "lucide-react";
import { getLanguageName } from "../services/language";
import DiscoveryPages from "./DiscoveryPages";
import type { WeatherData } from "../services/weather";

type ChatUIProps = {
  conversation: Array<{ role: "user" | "assistant"; content: string }>;
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
  onLocationSelected: (place: { name: string; country: string; latitude: number; longitude: number; source: "device" | "search" }) => void;
  onPromptChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (prompt?: string) => void;
  onEditQuestion: () => void;
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
  pa: { home: "ਕਿਸਾਨ AI ਮੁੱਖ ਪੰਨਾ", tagline: "ਤੁਹਾਡਾ ਖੇਤ, ਸਾਡੀ ਦੇਖਭਾਲ", newChat: "ਨਵੀਂ ਗੱਲਬਾਤ", askAbout: "ਇਸ ਬਾਰੇ ਪੁੱਛੋ", updates: "ਖੇਤੀ ਅਪਡੇਟ", news: "ਖ਼ਬਰਾਂ", topics: ["ਫ਼ਸਲ ਦੀ ਦੇਖਭਾਲ", "ਮੌਸਮ ਅਤੇ ਖੇਤ ਦਾ ਕੰਮ", "ਮਿੱਟੀ ਬਾਰੇ ਸਵਾਲ", "ਫ਼ਸਲ ਵੇਚਣਾ"], languageNote: "ਪੰਜਾਬੀ, ਹਿੰਦੀ ਜਾਂ ਅੰਗਰੇਜ਼ੀ ਵਿੱਚ ਪੁੱਛੋ", assistant: "ਖੇਤੀ ਸਹਾਇਕ", location: "ਖੇਤ ਦਾ ਮੌਸਮ", language: "ਭਾਸ਼ਾ", auto: "ਆਪਣੇ ਆਪ ਪਛਾਣੋ", you: "ਤੁਸੀਂ", thinking: "ਮਦਦਗਾਰ ਜਾਣਕਾਰੀ ਲੱਭ ਰਹੇ ਹਾਂ…", retry: "ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ", askKisan: "ਕਿਸਾਨ AI ਨੂੰ ਪੁੱਛੋ", ready: "ਤਿਆਰ ਹਾਂ", listening: "ਸੁਣ ਰਹੇ ਹਾਂ… ਹੁਣ ਬੋਲੋ", voice: "ਆਵਾਜ਼", stop: "ਰੋਕੋ", send: "ਸੁਨੇਹਾ ਭੇਜੋ", mistakes: "ਕਿਸਾਨ AI ਤੋਂ ਗਲਤੀ ਹੋ ਸਕਦੀ ਹੈ। ਮਹੱਤਵਪੂਰਨ ਸਲਾਹ ਸਥਾਨਕ ਖੇਤੀ ਮਾਹਿਰ ਨਾਲ ਪੱਕੀ ਕਰੋ।" },
  hi: { home: "किसान AI मुख्य पृष्ठ", tagline: "आपका खेत, हमारी देखभाल", newChat: "नई बातचीत", askAbout: "इसके बारे में पूछें", updates: "कृषि अपडेट", news: "खेती की खबरें", topics: ["फसल की देखभाल", "मौसम और खेत का काम", "मिट्टी के सवाल", "फसल बेचना"], languageNote: "हिंदी, पंजाबी या अंग्रेज़ी में पूछें", assistant: "खेती सहायक", location: "खेत का मौसम", language: "भाषा", auto: "अपने आप पहचानें", you: "आप", thinking: "उपयोगी जानकारी खोज रहे हैं…", retry: "फिर कोशिश करें", askKisan: "किसान AI से पूछें", ready: "पूछने के लिए तैयार", listening: "सुन रहे हैं… अब बोलें", voice: "आवाज़", stop: "रोकें", send: "संदेश भेजें", mistakes: "किसान AI से गलती हो सकती है। ज़रूरी सलाह स्थानीय कृषि विशेषज्ञ से जाँचें।" },
  en: { home: "Kisan AI home", tagline: "Your farm, in good hands", newChat: "New chat", askAbout: "ASK ABOUT", updates: "FARM UPDATES", news: "Agricultural news", topics: ["Crop care", "Weather & field work", "Soil questions", "Selling a crop"], languageNote: "Ask in English, Punjabi, or Hindi.", assistant: "Farm assistant", location: "Farm weather", language: "Language", auto: "Auto-detect", you: "You", thinking: "Finding helpful guidance…", retry: "Try again", askKisan: "Ask Kisan AI", ready: "Ready when you are", listening: "Listening… speak now", voice: "Voice", stop: "Stop", send: "Send message", mistakes: "Kisan AI can make mistakes. Confirm important advice with your local agricultural expert." },
} as const;

const localActivityLoggingCopy = {
  pa: "ਸਥਾਨਕ ਟੈਸਟ: ਤੁਹਾਡੇ ਸਵਾਲ ਇਸ ਕੰਪਿਊਟਰ ਉੱਤੇ ਆਪਣੇ ਆਪ ਸੰਭਾਲੇ ਜਾਂਦੇ ਹਨ।",
  hi: "स्थानीय परीक्षण: आपके सवाल इसी कंप्यूटर पर अपने आप सहेजे जाते हैं।",
  en: "Local testing: your questions are saved automatically on this computer.",
} as const;

const automaticActivityLoggingCopy = {
  pa: "ਤੁਹਾਡੇ ਸਵਾਲ ਆਪਣੇ ਆਪ ਭੇਜੇ ਜਾਂਦੇ ਹਨ। ਚੁਣੀ ਮੌਸਮ ਵਾਲੀ ਥਾਂ ਦੇ ਕੋਆਰਡੀਨੇਟ ਵੀ ਲੌਗ ਹੁੰਦੇ ਹਨ (30 ਦਿਨ ਤੱਕ)।",
  hi: "आपके सवाल अपने आप भेजे जाते हैं। चुनी गई मौसम जगह के निर्देशांक भी लॉग होते हैं (30 दिन तक)।",
  en: "Your questions are sent automatically. Coordinates for the selected weather location are also logged and kept for up to 30 days.",
} as const;

const connectionStatusCopy = {
  pa: {
    offline: "ਇੰਟਰਨੈੱਟ ਨਹੀਂ ਮਿਲ ਰਿਹਾ। ਕਨੈਕਸ਼ਨ ਠੀਕ ਕਰਕੇ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
    unavailable: "ਸਹਾਇਕ ਨਾਲ ਸੰਪਰਕ ਨਹੀਂ ਹੋ ਰਿਹਾ। ਕੁਝ ਦੇਰ ਬਾਅਦ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
    slow: "ਜਵਾਬ ਆਉਣ ਵਿੱਚ ਥੋੜ੍ਹਾ ਸਮਾਂ ਲੱਗ ਰਿਹਾ ਹੈ। ਸਹਾਇਕ ਹਾਲੇ ਕੰਮ ਕਰ ਰਿਹਾ ਹੈ।",
  },
  hi: {
    offline: "इंटरनेट से कनेक्शन नहीं है। कनेक्शन ठीक करके फिर कोशिश करें।",
    unavailable: "सहायक से संपर्क नहीं हो पा रहा। थोड़ी देर बाद फिर कोशिश करें।",
    slow: "जवाब आने में थोड़ा समय लग रहा है। सहायक अभी काम कर रहा है।",
  },
  en: {
    offline: "You’re offline. Check your connection, then try again.",
    unavailable: "The assistant can’t connect right now. Please try again shortly.",
    slow: "This is taking a little longer. The assistant is still working.",
  },
} as const;

const fieldDayCopy = {
  pa: {
    title: "ਖੇਤ ਵਿੱਚ ਕੀ ਕਰਨਾ ਹੈ?", voice: "ਬੋਲ ਕੇ ਪੁੱਛੋ", crop: "ਫ਼ਸਲ ਦੀ ਸਮੱਸਿਆ", weather: "ਮੌਸਮ ਵੇਖੋ",
    chooseCrop: "ਆਪਣੀ ਫ਼ਸਲ ਚੁਣੋ", chooseSymptom: "ਕੀ ਦਿੱਕਤ ਦਿਖ ਰਹੀ ਹੈ?", back: "ਪਿੱਛੇ", otherCrop: "ਹੋਰ ਫ਼ਸਲ",
    yellow: "ਪੱਤੇ ਪੀਲੇ", spots: "ਪੱਤਿਆਂ ਉੱਤੇ ਧੱਬੇ", insects: "ਕੀੜੇ ਦਿਖ ਰਹੇ ਹਨ", weak: "ਵਾਧਾ ਕਮਜ਼ੋਰ",
    otherIssue: "ਕੋਈ ਹੋਰ ਦਿੱਕਤ", weatherHint: "ਅੱਜ ਦਾ ਮੌਸਮ", voiceHint: "ਮਾਈਕ ਦਬਾ ਕੇ ਬੋਲੋ",
    cropIssue: "ਫ਼ਸਲ ਦੀ ਸਮੱਸਿਆ ਬਾਰੇ ਪੁੱਛੋ", cropPrompt: (crop: string, symptom: string) => `${crop} ਦੀ ਫ਼ਸਲ ਵਿੱਚ ${symptom} ਦਿਖ ਰਿਹਾ ਹੈ। ਪਹਿਲਾਂ ਕੀ ਜਾਂਚਾਂ? ਲੋੜ ਹੋਵੇ ਤਾਂ ਫ਼ਸਲ ਦੀ ਅਵਸਥਾ ਪੁੱਛੋ।`,
    otherCropPrompt: "ਮੈਨੂੰ ਇੱਕ ਹੋਰ ਫ਼ਸਲ ਬਾਰੇ ਮਦਦ ਚਾਹੀਦੀ ਹੈ। ਪਹਿਲਾਂ ਪੁੱਛੋ ਕਿ ਕਿਹੜੀ ਫ਼ਸਲ ਹੈ।",
    firstCheck: "ਪਹਿਲਾਂ ਕੀ ਜਾਂਚਾਂ?", simpler: "ਸੌਖੇ ਸ਼ਬਦਾਂ ਵਿੱਚ ਦੱਸੋ",
  },
  hi: {
    title: "खेत में क्या करना है?", voice: "बोलकर पूछें", crop: "फसल की समस्या", weather: "मौसम देखें",
    chooseCrop: "अपनी फसल चुनें", chooseSymptom: "क्या परेशानी दिख रही है?", back: "पीछे जाएँ", otherCrop: "दूसरी फसल",
    yellow: "पत्ते पीले", spots: "पत्तों पर धब्बे", insects: "कीड़े दिख रहे हैं", weak: "कमज़ोर बढ़त",
    otherIssue: "कोई दूसरी परेशानी", weatherHint: "आज का मौसम", voiceHint: "माइक दबाकर बोलें",
    cropIssue: "फसल की समस्या पूछें", cropPrompt: (crop: string, symptom: string) => `${crop} की फसल में ${symptom} दिख रहा है। पहले क्या जाँचूँ? ज़रूरत हो तो फसल की अवस्था पूछें।`,
    otherCropPrompt: "मुझे दूसरी फसल के बारे में मदद चाहिए। पहले पूछें कि कौन सी फसल है।",
    firstCheck: "पहले क्या जाँचूँ?", simpler: "आसान शब्दों में बताएँ",
  },
  en: {
    title: "What do you need in the field?", voice: "Ask by voice", crop: "Crop problem", weather: "Check weather",
    chooseCrop: "Choose your crop", chooseSymptom: "What are you noticing?", back: "Back", otherCrop: "Another crop",
    yellow: "Yellow leaves", spots: "Leaf spots", insects: "Visible insects", weak: "Weak growth",
    otherIssue: "Something else", weatherHint: "Local forecast", voiceHint: "Tap the mic and speak",
    cropIssue: "Ask about a crop problem", cropPrompt: (crop: string, symptom: string) => `My ${crop} crop has ${symptom}. What should I check first? Ask me for the crop stage if needed.`,
    otherCropPrompt: "I need help with another crop. First ask me which crop I am growing.",
    firstCheck: "What should I check first?", simpler: "Explain more simply",
  },
} as const;

export default function ChatUI({
  prompt,
  submittedPrompt,
  conversation,
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
  onEditQuestion,
  onSuggestionSelect,
  onVoiceInput,
  onSpeak,
  onWeatherLoaded,
  onLocationSelected,
  onSpeechLanguageChange,
  onKeyDown,
}: ChatUIProps) {
  const messagesContainerRef = useRef<HTMLElement>(null);
  const featureTrackRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cropGuideStep, setCropGuideStep] = useState<"closed" | "crop" | "symptom">("closed");
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const wasSidebarOpenRef = useRef(false);
  const [activeNavigation, setActiveNavigation] = useState("New chat");
  const [isOnline, setIsOnline] = useState(true);
  const [slowConnection, setSlowConnection] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const selectedUiLanguage = speechLanguageChoice === "auto" ? language : speechLanguageChoice;
  const uiLanguage: "pa" | "hi" | "en" = selectedUiLanguage === "hi" || selectedUiLanguage === "en"
    ? selectedUiLanguage
    : "pa";
  const copy = interfaceCopy[uiLanguage === "hi" ? "hi" : uiLanguage === "en" ? "en" : "pa"];
  const connectionCopy = connectionStatusCopy[uiLanguage];
  const fieldCopy = fieldDayCopy[uiLanguage];
  const featureTabs = uiLanguage === "pa"
    ? [{ label: "ਗੱਲਬਾਤ", icon: "💬" }, { label: "ਅੱਜ", icon: "☀️" }, { label: "ਭਾਈਚਾਰਾ", icon: "🤝" }, { label: "ਜ਼ਿੰਦਗੀ", icon: "🏠" }]
    : uiLanguage === "hi"
      ? [{ label: "चैट", icon: "💬" }, { label: "आज", icon: "☀️" }, { label: "समुदाय", icon: "🤝" }, { label: "ज़िंदगी", icon: "🏠" }]
      : [{ label: "Chat", icon: "💬" }, { label: "Today", icon: "☀️" }, { label: "Community", icon: "🤝" }, { label: "Life", icon: "🏠" }];
  const serviceUnavailable = /could not connect to ollama|could not be reached|fetch failed|timed out|network error/i.test(chatError);
  const friendlyChatError = !isOnline ? connectionCopy.offline : serviceUnavailable ? connectionCopy.unavailable : chatError;

  const cropOptions = uiLanguage === "pa"
    ? [{ id: "wheat", name: "ਕਣਕ", icon: "🌾" }, { id: "paddy", name: "ਝੋਨਾ", icon: "🌱" }, { id: "cotton", name: "ਨਰਮਾ", icon: "☀️" }, { id: "maize", name: "ਮੱਕੀ", icon: "🌽" }, { id: "kinnow", name: "ਕਿੰਨੂ", icon: "🍊" }, { id: "potato", name: "ਆਲੂ", icon: "🥔" }]
    : uiLanguage === "hi"
      ? [{ id: "wheat", name: "गेहूँ", icon: "🌾" }, { id: "paddy", name: "धान", icon: "🌱" }, { id: "cotton", name: "कपास", icon: "☀️" }, { id: "maize", name: "मक्का", icon: "🌽" }, { id: "kinnow", name: "किन्नू", icon: "🍊" }, { id: "potato", name: "आलू", icon: "🥔" }]
      : [{ id: "wheat", name: "Wheat", icon: "🌾" }, { id: "paddy", name: "Paddy", icon: "🌱" }, { id: "cotton", name: "Cotton", icon: "☀️" }, { id: "maize", name: "Maize", icon: "🌽" }, { id: "kinnow", name: "Kinnow", icon: "🍊" }, { id: "potato", name: "Potato", icon: "🥔" }];
  const symptomOptions = [
    { id: "yellow", label: fieldCopy.yellow },
    { id: "spots", label: fieldCopy.spots },
    { id: "insects", label: fieldCopy.insects },
    { id: "weak", label: fieldCopy.weak },
  ];
  const submitCropGuideQuestion = (symptomId: string) => {
    const crop = cropOptions.find((option) => option.id === selectedCrop);
    if (!crop) return;
    const symptom = symptomOptions.find((option) => option.id === symptomId);
    const symptomEnglish: Record<string, string> = {
      yellow: "yellow leaves", spots: "spots on the leaves", insects: "insects on the crop", weak: "weak growth",
    };
    const symptomLabel = symptom?.label ?? fieldCopy.otherIssue;
    setCropGuideStep("closed");
    setSelectedCrop(null);
    onSubmit(fieldCopy.cropPrompt(crop.name, uiLanguage === "en" ? symptomEnglish[symptomId] ?? symptomLabel : symptomLabel));
  };
  const languageChoices = uiLanguage === "pa"
    ? "ਪੰਜਾਬੀ · हिंदी · English"
    : uiLanguage === "hi"
      ? "पंजाबी · हिंदी · English"
      : "Punjabi · Hindi · English";

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (!send) {
      setSlowConnection(false);
      return;
    }
    setSlowConnection(false);
    const timer = window.setTimeout(() => setSlowConnection(true), 10000);
    return () => window.clearTimeout(timer);
  }, [send]);

  useEffect(() => {
    if (!sidebarOpen) {
      if (wasSidebarOpenRef.current) menuButtonRef.current?.focus();
      wasSidebarOpenRef.current = false;
      return;
    }
    wasSidebarOpenRef.current = true;
    closeMenuButtonRef.current?.focus();
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen]);

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

  const goToPage = (index: number) => {
    setActivePage(index);
    const track = featureTrackRef.current;
    if (track) track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  };

  const updateActivePage = () => {
    const track = featureTrackRef.current;
    if (!track) return;
    setActivePage(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
  };

  return (
    <div className={`chat-app${sidebarOpen ? " sidebar-open" : ""}${listening ? " is-listening" : ""}${send ? " is-processing" : ""}${speaking ? " is-speaking" : ""}${speechError ? " has-speech-error" : ""}`} lang={uiLanguage}>
      <button className="sidebar-scrim" type="button" aria-label="Close navigation menu" onClick={() => setSidebarOpen(false)} tabIndex={sidebarOpen ? 0 : -1} />

      <aside ref={sidebarRef} id="main-navigation" className="sidebar" aria-label="Main navigation" aria-hidden={!sidebarOpen} aria-modal={sidebarOpen || undefined} role={sidebarOpen ? "dialog" : undefined}>
        <a className="brand" href="/" aria-label={copy.home}>
          <span className="brand-mark" aria-hidden="true"><Sprout size={21} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>Kisan AI</strong><small>{copy.tagline}</small></span>
        </a>
        <button ref={closeMenuButtonRef} className="sidebar-close-button" type="button" onClick={() => setSidebarOpen(false)} aria-label={uiLanguage === "hi" ? "बंद करें" : uiLanguage === "en" ? "Close menu" : "ਬੰਦ ਕਰੋ"}><X size={20} /></button>

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

        <div className="sidebar-section">
          <p className="sidebar-label">{copy.updates}</p>
          <nav className="primary-navigation" aria-label={copy.updates}>
            <a className="navigation-link" href="/news" onClick={() => setSidebarOpen(false)}>
              <Newspaper size={17} strokeWidth={1.8} /><span>{copy.news}</span>
            </a>
          </nav>
        </div>

        <div className="sidebar-section sidebar-language-section">
          <label className="language-select" htmlFor="speech-language"><span>{copy.language}</span>
            <select id="speech-language" value={speechLanguageChoice} onChange={onSpeechLanguageChange} disabled={voiceMode || send}>
              <option value="auto">{copy.auto}</option><option value="pa">{uiLanguage === "pa" ? "ਪੰਜਾਬੀ" : uiLanguage === "hi" ? "पंजाबी" : "Punjabi"}</option><option value="hi">{uiLanguage === "pa" ? "ਹਿੰਦੀ" : uiLanguage === "hi" ? "हिंदी" : "Hindi"}</option><option value="en">English</option>
            </select>
          </label>
        </div>
      </aside>

      <section className="chat-workspace">
        <header className="chat-header">
          <div className="header-leading"><button ref={menuButtonRef} className="mobile-menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label={uiLanguage === "hi" ? "नेविगेशन खोलें" : uiLanguage === "en" ? "Open navigation menu" : "ਮੁੱਖ ਸੂਚੀ ਖੋਲ੍ਹੋ"} aria-expanded={sidebarOpen} aria-controls="main-navigation"><Menu size={20} /></button><span className="header-page-title">{copy.assistant}</span></div>
          <nav className="feature-page-tabs" aria-label={uiLanguage === "en" ? "App pages" : uiLanguage === "hi" ? "ऐप पेज" : "ਐਪ ਪੰਨੇ"}>
            {featureTabs.map((tab, index) => <button type="button" key={tab.label} className={activePage === index ? "is-active" : ""} aria-current={activePage === index ? "page" : undefined} onClick={() => goToPage(index)}><span aria-hidden="true">{tab.icon}</span>{tab.label}</button>)}
          </nav>
          <div className="header-tools">
            <BatteryDisplay language={uiLanguage} />
          </div>
        </header>

        <div className="feature-track" ref={featureTrackRef} onScroll={updateActivePage}>
        <main ref={messagesContainerRef} className="chat-messages feature-page chat-page" onScroll={(event) => {
          const container = event.currentTarget;
          shouldAutoScrollRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 96;
        }}>
          {!response && !send && !chatError && (
            <section className="welcome field-day-welcome" aria-label={fieldCopy.title}>
              <div className="field-day-heading"><span className="field-day-heading-mark" aria-hidden="true"><Sprout size={23} /></span><h1>{fieldCopy.title}</h1></div>
              {cropGuideStep === "closed" ? (
                <div className="field-day-actions">
                  <button className="field-day-action field-day-voice" type="button" onClick={onVoiceInput}>
                    <span className="field-day-action-icon"><AudioLines size={26} /></span><span className="field-day-action-copy"><strong>{fieldCopy.voice}</strong><small>{fieldCopy.voiceHint}</small></span><span className="field-day-action-arrow" aria-hidden="true">›</span>
                  </button>
                  <button className="field-day-action field-day-crop" type="button" onClick={() => setCropGuideStep("crop")}>
                    <span className="field-day-action-icon"><Sprout size={25} /></span><span className="field-day-action-copy"><strong>{fieldCopy.crop}</strong><small>{fieldCopy.cropIssue}</small></span>
                  </button>
                  <button className="field-day-action field-day-weather" type="button" onClick={() => goToPage(1)}>
                    <span className="field-day-action-icon"><CloudSun size={25} /></span><span className="field-day-action-copy"><strong>{fieldCopy.weather}</strong><small>{fieldCopy.weatherHint}</small></span>
                  </button>
                </div>
              ) : (
                <div className="crop-guide-panel">
                  <div className="crop-guide-panel-heading"><button className="crop-guide-back" type="button" onClick={() => { if (cropGuideStep === "symptom") setCropGuideStep("crop"); else { setCropGuideStep("closed"); setSelectedCrop(null); } }} aria-label={fieldCopy.back}>‹</button><h2>{cropGuideStep === "crop" ? fieldCopy.chooseCrop : fieldCopy.chooseSymptom}</h2></div>
                  {cropGuideStep === "crop" ? (
                    <div className="crop-choice-grid">{cropOptions.map((crop) => <button type="button" className="crop-choice" key={crop.id} onClick={() => { setSelectedCrop(crop.id); setCropGuideStep("symptom"); }}><span aria-hidden="true">{crop.icon}</span><strong>{crop.name}</strong></button>)}<button type="button" className="crop-choice crop-choice-other" onClick={() => { setCropGuideStep("closed"); setSelectedCrop(null); onSubmit(fieldCopy.otherCropPrompt); }}><span aria-hidden="true">＋</span><strong>{fieldCopy.otherCrop}</strong></button></div>
                  ) : <div className="symptom-choice-grid">{symptomOptions.map((symptom, index) => <button type="button" className="symptom-choice" key={symptom.id} onClick={() => submitCropGuideQuestion(symptom.id)}><span aria-hidden="true">{["🍂", "🔎", "🐛", "🌱"][index]}</span>{symptom.label}</button>)}<button type="button" className="symptom-choice" onClick={() => submitCropGuideQuestion("other")}><span aria-hidden="true">💬</span>{fieldCopy.otherIssue}</button></div>}
                </div>
              )}
            </section>
          )}

          {conversation.slice(0, !send && !chatError && conversation.at(-2)?.content === submittedPrompt && conversation.at(-1)?.content === response ? -2 : undefined).map((message, index) => message.role === "user"
            ? <div className="message user-message" key={`user-${index}`}><div className="message-body"><div className="message-name">{copy.you}</div><div className="message-text">{message.content}</div></div></div>
            : <div className="message ai-message" key={`assistant-${index}`}><div className="avatar ai-avatar" aria-hidden="true"><Sprout size={19} /></div><div className="message-body"><div className="message-name">Kisan AI</div><div className="message-text"><ReactMarkdown>{message.content}</ReactMarkdown></div></div></div>)}

          {(send || response || chatError) && <div className="message user-message"><div className="message-body"><div className="message-name">{copy.you}</div><div className="message-text">{submittedPrompt}</div>{!send && !chatError && response && <button type="button" className="edit-question-button" onClick={onEditQuestion}>{uiLanguage === "pa" ? "ਸਵਾਲ ਠੀਕ ਕਰੋ" : uiLanguage === "hi" ? "सवाल सुधारें" : "Edit question"}</button>}</div></div>}

          {(response || send || chatError) && (
            <div className="message ai-message">
              <div className="avatar ai-avatar" aria-hidden="true"><Sprout size={19} /></div>
              <div className="message-body">
                <div className="message-name">Kisan AI <span>{uiLanguage === "pa" ? "ਖੇਤੀ ਸਹਾਇਕ" : uiLanguage === "hi" ? "खेती सहायक" : "FARM ASSISTANT"}</span></div>
                <div className="message-text" aria-live="polite">
                  {response && <ReactMarkdown>{response}</ReactMarkdown>}
                  {send && !response && <div className="thinking" role="status"><span /><span /><span /><p>{copy.thinking}</p></div>}
                  {response && !chatError && <button type="button" className="speak-button" onClick={onSpeak} disabled={send} aria-label={speaking ? copy.stop : uiLanguage === "pa" ? "ਜਵਾਬ ਸੁਣੋ" : uiLanguage === "hi" ? "जवाब सुनें" : "Listen to answer"}><Headphones size={16} />{speaking ? copy.stop : uiLanguage === "pa" ? "ਜਵਾਬ ਸੁਣੋ" : uiLanguage === "hi" ? "जवाब सुनें" : "Listen to answer"}</button>}
                  {chatError && <div className="chat-error" role="alert"><p>{friendlyChatError}</p><button type="button" onClick={() => onSubmit(submittedPrompt)} disabled={send}>{copy.retry}</button></div>}
                </div>
                {response && !chatError && !send && <div className="quick-followups" aria-label={uiLanguage === "en" ? "Suggested follow-up questions" : fieldCopy.crop}><span>{fieldCopy.firstCheck}</span><button type="button" onClick={() => onSubmit(fieldCopy.firstCheck)}><BookOpenText size={16} />{fieldCopy.firstCheck}</button><button type="button" onClick={() => onSubmit(fieldCopy.simpler)}>{fieldCopy.simpler}</button></div>}
              </div>
            </div>
          )}
        </main>
        <DiscoveryPages language={uiLanguage} onWeatherLoaded={onWeatherLoaded} onLocationSelected={onLocationSelected} />
        </div>

        {(!isOnline || (send && slowConnection)) && (
          <div className={`connection-notice${isOnline ? " is-slow" : " is-offline"}`} role={isOnline ? "status" : "alert"} aria-live="polite">
            {isOnline ? <LoaderCircle size={18} aria-hidden="true" /> : <WifiOff size={18} aria-hidden="true" />}
            <span>{isOnline ? connectionCopy.slow : connectionCopy.offline}</span>
          </div>
        )}

        {activePage === 0 && <footer className="chat-input-area">
          <div className="composer-wrap">
            <div className="composer-label"><span className="composer-mark"><Sprout size={14} /></span><span>{copy.askKisan}</span><span className="composer-language">{language ? getLanguageName(language) : languageChoices}</span></div>
            <div className="chat-input-wrapper">
              <button className={`voice-button${listening ? " listening" : ""}${speaking ? " speaking" : ""}`} type="button" onClick={onVoiceInput} disabled={directBusy || (send && !voiceMode)} aria-label={voiceMode ? copy.stop : listening ? copy.listening : copy.voice} aria-pressed={voiceMode} title={voiceMode ? copy.stop : copy.voice}>{voiceMode && (listening || speaking) ? <span className={`voice-wave${speaking ? " is-speaking" : " is-listening"}`} aria-hidden="true"><i /><i /><i /><i /><i /></span> : voiceMode ? <X size={22} /> : <AudioLines size={22} />}<span>{voiceMode ? copy.stop : listening ? (uiLanguage === "pa" ? "ਸੁਣੋ" : uiLanguage === "hi" ? "सुनें" : "Listening") : copy.voice}</span></button>
              <input type="text" placeholder={listening ? copy.listening : uiLanguage === "hi" ? "फसल, मिट्टी या कीट के बारे में पूछें…" : uiLanguage === "en" ? "Ask about crops, soil, or pests…" : "ਫ਼ਸਲ, ਮਿੱਟੀ ਜਾਂ ਕੀੜਿਆਂ ਬਾਰੇ ਪੁੱਛੋ…"} value={prompt} onChange={onPromptChange} onKeyDown={onKeyDown} disabled={send || directBusy || listening || voiceMode} aria-label={copy.askKisan} />
              <button className="send-button" type="button" onClick={() => onSubmit()} disabled={send || directBusy || voiceMode || !prompt.trim()} aria-label={copy.send} title={copy.send}>{send ? <span className="send-spinner" /> : <Send size={18} strokeWidth={2} />}</button>
            </div>
          </div>
          <div className="input-meta">
            {voiceMode && <p className="voice-mode-status" aria-live="polite">{listening ? copy.listening : send ? copy.thinking : speaking ? (uiLanguage === "pa" ? "ਬੋਲ ਰਹੇ ਹਾਂ…" : uiLanguage === "hi" ? "बोल रहे हैं…" : "Speaking…") : uiLanguage === "pa" ? "ਆਵਾਜ਼ੀ ਗੱਲਬਾਤ ਚਾਲੂ ਹੈ" : uiLanguage === "hi" ? "आवाज़ बातचीत चालू है" : "Voice conversation active"}</p>}
            {speechError && <p className="speech-error" role="status">{speechError}</p>}
            <p className="input-hint">{copy.mistakes}</p>
          </div>
        </footer>}
      </section>
    </div>
  );
}
