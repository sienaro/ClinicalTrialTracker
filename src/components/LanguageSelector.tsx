"use client";

import { LANGUAGES, useLanguage } from "@/components/LanguageProvider";

const selectClass =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100";

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { language, readingLevel, setLanguage, setReadingLevel } = useLanguage();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compact ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9L21 21m-1-1l-5.5-11M3 21l6-6" />
          </svg>
          AI replies in
        </span>
      ) : null}
      <select
        aria-label="AI response language"
        className={selectClass}
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      >
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <select
        aria-label="Reading level"
        className={selectClass}
        value={readingLevel}
        onChange={(e) => setReadingLevel(e.target.value as "standard" | "simple")}
      >
        <option value="standard">Standard</option>
        <option value="simple">Simple (plain)</option>
      </select>
    </div>
  );
}
