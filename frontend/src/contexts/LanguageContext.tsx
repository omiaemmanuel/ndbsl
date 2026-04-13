import React, { createContext, useContext, useState, useCallback } from 'react';
import { type Lang, getTranslation } from '../utils/i18n';

const LANG_KEY = 'nbsl_lang';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem(LANG_KEY) as Lang) ?? 'en';
  });

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(LANG_KEY, l);
    setLangState(l);
  }, []);

  const t = useCallback(
    (key: string): string => getTranslation(lang, key),
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}

/** Small inline toggle button — drop anywhere in a sidebar footer */
export function LangToggleButton({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}
      title={`Switch to ${lang === 'en' ? 'Korean' : 'English'}`}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors
        border-gray-300 text-gray-600 hover:border-primary-400 hover:text-primary-700 hover:bg-primary-50
        ${className}`}
    >
      <span className="w-4 h-4 flex items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold leading-none">
        {t('lang.badge')}
      </span>
      {t('lang.toggle')}
    </button>
  );
}
