"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";
import NewsFeed from "../components/NewsFeed";
import "../components/news.css";

type Language = "pa" | "hi" | "en";

const languageLabels: Record<Language, string> = {
  pa: "ਪੰਜਾਬੀ",
  hi: "हिन्दी",
  en: "English",
};

export default function NewsPage() {
  const [language, setLanguage] = useState<Language>("pa");

  useEffect(() => {
    try {
      const savedLanguage = window.localStorage.getItem("kisan-ai-language");
      if (savedLanguage === "pa" || savedLanguage === "hi" || savedLanguage === "en") {
        setLanguage(savedLanguage);
      }
    } catch {
      // Keep Punjabi as the safe default when storage is unavailable.
    }
  }, []);

  const changeLanguage = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value !== "pa" && value !== "hi" && value !== "en") return;
    const nextLanguage = value;
    setLanguage(nextLanguage);
    try {
      window.localStorage.setItem("kisan-ai-language", nextLanguage);
    } catch {
      // The page remains usable for this visit if storage is unavailable.
    }
  };

  return (
    <div className="news-page" lang={language}>
      <header className="news-page-header">
        <Link href="/">{language === "pa" ? "← ਕਿਸਾਨ AI ਤੇ ਵਾਪਸ" : language === "hi" ? "← किसान AI पर वापस" : "← Back to Kisan AI"}</Link>
        <label>
          <span>{language === "pa" ? "ਭਾਸ਼ਾ" : language === "hi" ? "भाषा" : "Language"}</span>
          <select value={language} onChange={changeLanguage} aria-label="News language">
            {(Object.keys(languageLabels) as Language[]).map((code) => (
              <option value={code} key={code}>{languageLabels[code]}</option>
            ))}
          </select>
        </label>
      </header>
      <main className="news-page-main">
        <NewsFeed language={language} />
      </main>
      <p className="news-page-note">
        {language === "pa"
          ? "ਖ਼ਬਰਾਂ ਦੇ ਸਿਰਲੇਖ ਮੂਲ ਸਰੋਤ ਨਾਲ ਜੁੜੇ ਹਨ। ਮੌਸਮ ਜਾਂ ਮੰਡੀ ਦੇ ਲਾਈਵ ਅੰਕੜਿਆਂ ਲਈ ਇਹ ਖ਼ਬਰਾਂ ਦਾ ਫੀਡ ਨਹੀਂ ਹੈ।"
          : language === "hi"
            ? "खबरों के शीर्षक मूल स्रोत से जुड़े हैं। यह फ़ीड लाइव मौसम या मंडी आँकड़ों का स्रोत नहीं है।"
            : "Headlines link to their original sources. This feed is not a source for live weather or mandi prices."}
      </p>
    </div>
  );
}
