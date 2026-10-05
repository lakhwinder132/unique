import { franc } from "franc-min";
import { iso6393To1 } from "iso-639-3";

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });
const romanizedPunjabiWords = /\b(tusi|tuhanu|tuhada|tuhadi|tuhade|sanu|sada|sadi|sade|assi|aapan|kiven|kithe|kithon|kidda|kida|chahida|dasso|dso|veere|kehda|kehri|kehde|naal|vich)\b/i;
const romanizedHindiWords = /\b(kya|kaise|kyun|mujhe|aap|mera|meri|mere|tum|hum|hai|hain|ho|raha|rahi|rahe|karo|karu|karun|chahiye|mein|wala|gehu|gehun|patta|patte|sinchai|beej|batao|kab|kitna|kaisa|pani|fasal|karna)\b/i;
const commonPunjabiWords = /\b(aa|ae|ne|nu|khet|fasal|kanak|paani|pani|da|di|de|kara|karna|karda|karde)\b/gi;

export function getLanguageName(code: string) {
  const normalizedCode = code.toLowerCase().split("-")[0] ?? code;
  return languageNames.of(normalizedCode) ?? code;
}

export function detectTextLanguage(text: string) {
  const sample = text.trim();
  if (sample.length < 3) return null;

  if (/^[\p{Script=Latin}\p{M}\p{N}\p{P}\s]+$/u.test(sample)) {
    if (romanizedPunjabiWords.test(sample)) {
      return { code: "pa", name: getLanguageName("pa") };
    }

    const commonWordCount = sample.match(commonPunjabiWords)?.length ?? 0;
    if (commonWordCount >= 3 && /\b(aa|ae|ne)\b/i.test(sample)) {
      return { code: "pa", name: getLanguageName("pa") };
    }

    if (romanizedHindiWords.test(sample)) {
      return { code: "hi", name: getLanguageName("hi") };
    }
  }

  const iso6393 = franc(sample, { minLength: 3 });
  if (iso6393 === "und") return null;

  const code = iso6393To1[iso6393] ?? iso6393;
  return { code, name: getLanguageName(code) };
}