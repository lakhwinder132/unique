"use client";

import { Battery, BatteryCharging, CalendarDays, Clock3, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./home-status.css";

type Language = "pa" | "hi" | "en";

type BatteryStatus = EventTarget & {
  level: number;
  charging?: boolean;
};

type BatteryNavigator = Navigator & {
  getBattery?: () => Promise<BatteryStatus>;
};

const copy: Record<Language, { today: string; localTime: string }> = {
  pa: { today: "ਅੱਜ", localTime: "ਭਾਰਤੀ ਸਮਾਂ" },
  hi: { today: "आज", localTime: "भारतीय समय" },
  en: { today: "Today", localTime: "India time" },
};

function localeFor(language: Language) {
  return language === "pa" ? "pa-IN" : language === "hi" ? "hi-IN" : "en-IN";
}

export function BatteryDisplay({ language }: { language: Language }) {
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasExpandedRef = useRef(false);

  useEffect(() => {
    let active = true;
    let batteryStatus: BatteryStatus | undefined;
    const updateBattery = () => {
      if (!batteryStatus || !Number.isFinite(batteryStatus.level) || batteryStatus.level < 0 || batteryStatus.level > 1) {
        setBattery(null);
        return;
      }
      setBattery({ level: Math.round(batteryStatus.level * 100), charging: batteryStatus.charging === true });
    };
    const connectBattery = async () => {
      const getBattery = (navigator as BatteryNavigator).getBattery;
      if (!getBattery) return;
      try {
        batteryStatus = await getBattery.call(navigator);
        if (!active) return;
        updateBattery();
        batteryStatus.addEventListener("levelchange", updateBattery);
        batteryStatus.addEventListener("chargingchange", updateBattery);
      } catch {
        if (active) setBattery(null);
      }
    };
    void connectBattery();
    return () => {
      active = false;
      batteryStatus?.removeEventListener("levelchange", updateBattery);
      batteryStatus?.removeEventListener("chargingchange", updateBattery);
    };
  }, []);

  useEffect(() => {
    if (!expanded) {
      if (wasExpandedRef.current) triggerRef.current?.focus();
      wasExpandedRef.current = false;
      return;
    }
    wasExpandedRef.current = true;
    closeRef.current?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
      } else if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  if (!battery) return null;
  const BatteryIcon = battery.charging ? BatteryCharging : Battery;
  const strings = {
    pa: { battery: "ਬੈਟਰੀ", charging: "ਚਾਰਜ ਹੋ ਰਹੀ ਹੈ", low: "ਬੈਟਰੀ ਘੱਟ ਹੈ", close: "ਬੰਦ ਕਰੋ" },
    hi: { battery: "बैटरी", charging: "चार्ज हो रही है", low: "बैटरी कम है", close: "बंद करें" },
    en: { battery: "Battery", charging: "Charging", low: "Battery is low", close: "Close" },
  }[language];
  const label = `${strings.battery} ${battery.level}%${battery.charging ? `, ${strings.charging}` : ""}`;
  return (
    <>
      <button ref={triggerRef} className={`battery-indicator${battery.level <= 20 ? " is-low" : ""}`} type="button" aria-haspopup="dialog" aria-expanded={expanded} aria-label={label} title={label} onClick={() => setExpanded(true)}>
        <BatteryIcon size={32} strokeWidth={2} aria-hidden="true" />
        <strong>{battery.level}%</strong>
      </button>
      {expanded && (
        <div className="battery-overlay" onClick={() => setExpanded(false)}>
          <section className={`battery-dialog${battery.level <= 20 ? " is-low" : ""}`} role="dialog" aria-modal="true" aria-labelledby="battery-dialog-title">
            <button ref={closeRef} className="battery-dialog-close" type="button" aria-label={strings.close} onClick={() => setExpanded(false)}><X size={23} /></button>
            <BatteryIcon className="battery-dialog-icon" size={112} strokeWidth={1.5} aria-hidden="true" />
            <h2 id="battery-dialog-title">{battery.level}%</h2>
            <p>{battery.charging ? strings.charging : battery.level <= 20 ? strings.low : strings.battery}</p>
          </section>
        </div>
      )}
    </>
  );
}

export default function HomeStatusPanel({ language }: { language: Language }) {
  const [now, setNow] = useState<Date | null>(null);
  const strings = copy[language];
  const locale = localeFor(language);

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    updateClock();
    const interval = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const date = now
    ? new Intl.DateTimeFormat(locale, { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now)
    : "";
  const time = now
    ? new Intl.DateTimeFormat(locale, { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now)
    : "";

  return (
    <section className="home-status-panel" aria-label={strings.today}>
      <div className="home-status-date">
        <span className="home-status-icon" aria-hidden="true"><CalendarDays size={19} /></span>
        <div>
          <p className="home-status-label">{strings.today}</p>
          {now && <time dateTime={now.toISOString()}>{date}</time>}
        </div>
      </div>
      <div className="home-status-clock">
        <Clock3 size={18} aria-hidden="true" />
        <div>
          <p className="home-status-label">{strings.localTime}</p>
          {now && <time dateTime={now.toISOString()}>{time}</time>}
        </div>
      </div>
    </section>
  );
}
