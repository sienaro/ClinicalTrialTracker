"use client";

import { createContext, useContext, useEffect, useState } from "react";

export const LANGUAGES = [
  "English",
  "Español",
  "中文 (Chinese)",
  "हिन्दी (Hindi)",
  "العربية (Arabic)",
  "Français",
  "Português",
  "Tagalog",
  "Tiếng Việt",
  "Русский",
  "한국어 (Korean)",
  "Deutsch",
] as const;

export type ReadingLevel = "standard" | "simple";

type LangState = {
  language: string;
  readingLevel: ReadingLevel;
  setLanguage: (l: string) => void;
  setReadingLevel: (r: ReadingLevel) => void;
};

const STORAGE_KEY = "ctt_lang_pref_v1";

const LanguageContext = createContext<LangState>({
  language: "English",
  readingLevel: "standard",
  setLanguage: () => {},
  setReadingLevel: () => {},
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState("English");
  const [readingLevel, setReadingLevelState] = useState<ReadingLevel>("standard");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { language?: string; readingLevel?: ReadingLevel };
        if (p.language) setLanguageState(p.language);
        if (p.readingLevel === "simple" || p.readingLevel === "standard") setReadingLevelState(p.readingLevel);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function persist(next: { language: string; readingLevel: ReadingLevel }) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const setLanguage = (l: string) => {
    setLanguageState(l);
    persist({ language: l, readingLevel });
  };
  const setReadingLevel = (r: ReadingLevel) => {
    setReadingLevelState(r);
    persist({ language, readingLevel: r });
  };

  return (
    <LanguageContext.Provider value={{ language, readingLevel, setLanguage, setReadingLevel }}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Builds an instruction snippet for prompts based on current language/level preferences. */
export function languageInstruction(language: string, readingLevel: ReadingLevel): string {
  const parts: string[] = [];
  if (language && language !== "English") {
    const clean = language.replace(/\s*\(.*\)\s*/, "");
    parts.push(`Write your entire response in ${clean} (${language}).`);
  }
  if (readingLevel === "simple") {
    parts.push("Use very simple words at about a 6th-grade reading level. Short sentences. Define any medical term.");
  }
  return parts.join(" ");
}
