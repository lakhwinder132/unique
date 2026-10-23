"use client";

import { useState, type FormEvent } from "react";
import { BookOpen, CalendarDays, Heart, HeartPulse, Handshake, MapPin, Plus, WalletCards, Wheat } from "lucide-react";
import WeatherWidget from "./WeatherWidget";
import type { WeatherData } from "../services/weather";

type DiscoveryPagesProps = {
  language: "pa" | "hi" | "en";
  onWeatherLoaded: (weather: WeatherData) => void;
  onLocationSelected: (place: { name: string; country: string; latitude: number; longitude: number; source: "device" | "search" }) => void;
};

const communityExamples = [
  { kind: "share", icon: "🛠️", tag: "TOOL SHARING · EXAMPLE", title: "Sharing a water-pump repair tip", body: "A sample community post showing how neighbors can share practical help.", by: "Example farmer", likes: 12 },
  { kind: "learn", icon: "📚", tag: "LEARNING · EXAMPLE", title: "Evening phone-skills circle", body: "A demo notice for a short, local-language learning meetup.", by: "Community board", likes: 8 },
  { kind: "help", icon: "🤝", tag: "HELPING HANDS · EXAMPLE", title: "Need a hand moving equipment?", body: "A sample request to illustrate how farmers could coordinate transport.", by: "Example farmer", likes: 5 },
];

const translations = {
  en: { today: "Today", todaySub: "A useful snapshot, all in one place.", community: "Community", communitySub: "People, ideas, and help—together.", sample: "SAMPLE DATA", life: "Everyday life", lifeSub: "Small tools for home, family, and money.", local: "Local forecast", board: "Village board", demoNote: "Examples only · not live community posts", helpful: "Helpful", all: "All", share: "Sharing", help: "Help", filterLearning: "Learning", family: "Family wellbeing", familyText: "A small reminder: make time for water, rest, and a check-in with someone you care about.", budget: "Weekly home budget", budgetNote: "Demo figures · your entries stay in this session", spent: "Sample spending", add: "Add expense", amount: "Amount ₹", category: "Category", food: "Food", travel: "Travel", home: "Home", learning: "Learning", lesson: "Learn something", lessonText: "Try one small skill today: save a contact, send a voice message, or spot a suspicious link.", plan: "Plan your week", planText: "A short checklist can help balance home, health, and work.", checklist: "A little plan for today", water: "Drink some water", familyCheck: "Check in with family", stretch: "Take a short rest", workPlan: "Note one priority", progress: "done today", empty: "No sample expenses yet." },
  hi: { today: "आज", todaySub: "ज़रूरी जानकारी, एक ही जगह।", community: "समुदाय", communitySub: "लोग, विचार और मदद—साथ में।", sample: "नमूना डेटा", life: "रोज़मर्रा की ज़िंदगी", lifeSub: "घर, परिवार और पैसों के छोटे काम।", local: "स्थानीय मौसम", board: "गाँव का बोर्ड", demoNote: "केवल उदाहरण · लाइव पोस्ट नहीं", helpful: "काम का", family: "परिवार की भलाई", familyText: "एक छोटा याद दिलाना: पानी पिएँ, आराम करें और अपने किसी करीबी का हाल पूछें।", budget: "हफ़्ते का घरेलू बजट", budgetNote: "डेमो आँकड़े · आपकी एंट्री इसी सत्र में रहती है", spent: "नमूना खर्च", add: "खर्च जोड़ें", amount: "राशि ₹", category: "श्रेणी", food: "खाना", travel: "यात्रा", home: "घर", learning: "सीखना", lesson: "कुछ नया सीखें", lessonText: "आज एक छोटा हुनर आज़माएँ: नंबर सेव करना, आवाज़ी संदेश भेजना या संदिग्ध लिंक पहचानना।", plan: "हफ़्ते की योजना", planText: "एक छोटी सूची घर, सेहत और काम के बीच संतुलन बनाने में मदद कर सकती है।", empty: "अभी कोई नमूना खर्च नहीं।" },
  pa: { today: "ਅੱਜ", todaySub: "ਕੰਮ ਦੀ ਜਾਣਕਾਰੀ, ਇੱਕੋ ਥਾਂ।", community: "ਭਾਈਚਾਰਾ", communitySub: "ਲੋਕ, ਵਿਚਾਰ ਅਤੇ ਮਦਦ—ਇਕੱਠੇ।", sample: "ਨਮੂਨਾ ਡਾਟਾ", life: "ਰੋਜ਼ਾਨਾ ਜ਼ਿੰਦਗੀ", lifeSub: "ਘਰ, ਪਰਿਵਾਰ ਅਤੇ ਪੈਸਿਆਂ ਲਈ ਛੋਟੇ ਸਾਧਨ।", local: "ਇਲਾਕੇ ਦਾ ਮੌਸਮ", board: "ਪਿੰਡ ਦਾ ਬੋਰਡ", demoNote: "ਸਿਰਫ਼ ਉਦਾਹਰਨਾਂ · ਲਾਈਵ ਪੋਸਟ ਨਹੀਂ", helpful: "ਫ਼ਾਇਦੇਮੰਦ", family: "ਪਰਿਵਾਰ ਦੀ ਤੰਦਰੁਸਤੀ", familyText: "ਇੱਕ ਛੋਟੀ ਯਾਦ: ਪਾਣੀ ਪੀਓ, ਆਰਾਮ ਕਰੋ ਅਤੇ ਆਪਣੇ ਕਿਸੇ ਪਿਆਰੇ ਦਾ ਹਾਲ ਪੁੱਛੋ।", budget: "ਹਫ਼ਤਾਵਾਰੀ ਘਰੇਲੂ ਬਜਟ", budgetNote: "ਨਮੂਨਾ ਅੰਕੜੇ · ਤੁਹਾਡੀ ਐਂਟਰੀ ਇਸ ਸੈਸ਼ਨ ਵਿੱਚ ਰਹਿੰਦੀ ਹੈ", spent: "ਨਮੂਨਾ ਖਰਚਾ", add: "ਖਰਚਾ ਜੋੜੋ", amount: "ਰਕਮ ₹", category: "ਸ਼੍ਰੇਣੀ", food: "ਖਾਣਾ", travel: "ਸਫ਼ਰ", home: "ਘਰ", learning: "ਸਿੱਖਣਾ", lesson: "ਕੁਝ ਨਵਾਂ ਸਿੱਖੋ", lessonText: "ਅੱਜ ਇੱਕ ਛੋਟਾ ਹੁਨਰ ਅਜ਼ਮਾਓ: ਨੰਬਰ ਸੰਭਾਲਣਾ, ਆਵਾਜ਼ੀ ਸੁਨੇਹਾ ਭੇਜਣਾ ਜਾਂ ਸ਼ੱਕੀ ਲਿੰਕ ਪਛਾਣਨਾ।", plan: "ਹਫ਼ਤੇ ਦੀ ਯੋਜਨਾ", planText: "ਇੱਕ ਛੋਟੀ ਸੂਚੀ ਘਰ, ਸਿਹਤ ਅਤੇ ਕੰਮ ਵਿਚਕਾਰ ਸੰਤੁਲਨ ਬਣਾਉਣ ਵਿੱਚ ਮਦਦ ਕਰਦੀ ਹੈ।", empty: "ਹਾਲੇ ਕੋਈ ਨਮੂਨਾ ਖਰਚਾ ਨਹੀਂ।" },
} as const;

const pageActions = {
  en: { all: "All", share: "Sharing", help: "Help", learning: "Learning", checklist: "A little plan for today", water: "Drink some water", family: "Check in with family", rest: "Take a short rest", priority: "Note one priority", done: "done today" },
  hi: { all: "सभी", share: "साझा करना", help: "मदद", learning: "सीखना", checklist: "आज की छोटी योजना", water: "थोड़ा पानी पिएँ", family: "परिवार का हाल पूछें", rest: "थोड़ा आराम करें", priority: "एक ज़रूरी काम लिखें", done: "आज पूरे" },
  pa: { all: "ਸਭ", share: "ਸਾਂਝਾ", help: "ਮਦਦ", learning: "ਸਿੱਖਣਾ", checklist: "ਅੱਜ ਦੀ ਛੋਟੀ ਯੋਜਨਾ", water: "ਥੋੜ੍ਹਾ ਪਾਣੀ ਪੀਓ", family: "ਪਰਿਵਾਰ ਦਾ ਹਾਲ ਪੁੱਛੋ", rest: "ਥੋੜ੍ਹਾ ਆਰਾਮ ਕਰੋ", priority: "ਇੱਕ ਜ਼ਰੂਰੀ ਕੰਮ ਲਿਖੋ", done: "ਅੱਜ ਪੂਰੇ" },
} as const;

export default function DiscoveryPages({ language, onWeatherLoaded, onLocationSelected }: DiscoveryPagesProps) {
  const copy = translations[language];
  const actionCopy = pageActions[language];
  const [helpful, setHelpful] = useState<Record<number, boolean>>({});
  const [communityFilter, setCommunityFilter] = useState("all");
  const [todayChecks, setTodayChecks] = useState<Record<number, boolean>>({});
  const [expenses, setExpenses] = useState<Array<{ name: string; amount: number }>>([{ name: copy.food, amount: 850 }, { name: copy.travel, amount: 260 }, { name: copy.home, amount: 420 }]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(copy.food);
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const filteredCommunityExamples = communityFilter === "all" ? communityExamples : communityExamples.filter((post) => post.kind === communityFilter);
  const dailyChecklist = [actionCopy.water, actionCopy.family, actionCopy.rest, actionCopy.priority];
  const checkedToday = Object.values(todayChecks).filter(Boolean).length;

  const addExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setExpenses((items) => [...items, { name: category, amount: value }]);
    setAmount("");
  };

  return <>
    <section className="discovery-page today-page" aria-label={copy.today}>
      <header className="discovery-heading"><span className="discovery-heading-icon"><CalendarDays size={21} /></span><div><p>{copy.local}</p><h1>{copy.today}</h1><span>{copy.todaySub}</span></div></header>
      <WeatherWidget language={language} onWeatherLoaded={onWeatherLoaded} onLocationSelected={onLocationSelected} />
    </section>

    <section className="discovery-page community-page" aria-label={copy.community}>
      <header className="discovery-heading"><span className="discovery-heading-icon"><Handshake size={21} /></span><div><p>{copy.board}</p><h1>{copy.community}</h1><span>{copy.communitySub}</span></div><span className="demo-badge">{copy.sample}</span></header>
      <div className="demo-banner"><MapPin size={17} /><span>{copy.demoNote}</span></div>
      <div className="community-filters" aria-label="Filter example posts">{[{ id: "all", label: actionCopy.all }, { id: "share", label: actionCopy.share }, { id: "help", label: actionCopy.help }, { id: "learn", label: actionCopy.learning }].map((filter) => <button key={filter.id} type="button" className={communityFilter === filter.id ? "is-active" : ""} aria-pressed={communityFilter === filter.id} onClick={() => setCommunityFilter(filter.id)}>{filter.label}</button>)}</div>
      <div className="community-example-list">{filteredCommunityExamples.map((post) => { const index = communityExamples.indexOf(post); return <article className="community-example-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl" key={post.title}><div className="community-example-art"><span className="transition-transform duration-300 hover:scale-110">{post.icon}</span><small>{post.tag}</small></div><div className="community-example-content"><span className="example-author">{post.by}</span><h2>{post.title}</h2><p>{post.body}</p><button type="button" className={helpful[index] ? "is-helpful" : ""} onClick={() => setHelpful((state) => ({ ...state, [index]: !state[index] }))}><Heart size={16} fill={helpful[index] ? "currentColor" : "none"} />{copy.helpful} · {post.likes + (helpful[index] ? 1 : 0)}</button></div></article>; })}</div>
    </section>

    <section className="discovery-page life-page" aria-label={copy.life}>
      <header className="discovery-heading"><span className="discovery-heading-icon"><HeartPulse size={21} /></span><div><p>{copy.lifeSub}</p><h1>{copy.life}</h1><span>{copy.planText}</span></div></header>
      <article className="life-wellbeing-card"><span className="life-card-icon"><HeartPulse size={21} /></span><div><p>{copy.family}</p><span>{copy.familyText}</span></div></article>
      <article className="daily-checklist"><div className="daily-checklist-heading"><CalendarDays size={18} /><h2>{actionCopy.checklist}</h2><span>{checkedToday}/4 {actionCopy.done}</span></div><div className="daily-checklist-progress"><span style={{ width: `${checkedToday * 25}%` }} /></div><div className="daily-checklist-items">{dailyChecklist.map((item, index) => <button key={item} type="button" className={todayChecks[index] ? "is-checked" : ""} aria-pressed={Boolean(todayChecks[index])} onClick={() => setTodayChecks((current) => ({ ...current, [index]: !current[index] }))}><span className="daily-check-box">{todayChecks[index] ? "✓" : ""}</span>{item}</button>)}</div></article>
      <article className="budget-card"><div className="budget-card-heading"><span className="life-card-icon money"><WalletCards size={21} /></span><div><h2>{copy.budget}</h2><p>{copy.budgetNote}</p></div></div><div className="budget-total"><span>{copy.spent}</span><strong>₹{total.toLocaleString("en-IN")}</strong></div><div className="budget-visual" aria-label={copy.spent}>{expenses.map((item, index) => <span key={`${item.name}-bar-${index}`} style={{ flexGrow: item.amount, background: ["#dca34a", "#6e9b76", "#7da8ad"][index % 3] }} />)}</div><ul className="budget-list">{expenses.map((item, index) => <li key={`${item.name}-${index}`}><span><i style={{ background: ["#dca34a", "#6e9b76", "#7da8ad"][index % 3] }} />{item.name}</span><strong>₹{item.amount.toLocaleString("en-IN")}</strong></li>)}{expenses.length === 0 && <li>{copy.empty}</li>}</ul><form className="budget-add-form" onSubmit={addExpense}><label><span>{copy.amount}</span><input type="number" min="1" step="1" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label><span>{copy.category}</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>{copy.food}</option><option>{copy.travel}</option><option>{copy.home}</option></select></label><button type="submit"><Plus size={17} />{copy.add}</button></form></article>
      <article className="life-learning-card"><span className="life-card-icon learning"><BookOpen size={21} /></span><div><h2>{copy.lesson}</h2><p>{copy.lessonText}</p></div><Wheat size={22} aria-hidden="true" /></article>
    </section>
  </>;
}
