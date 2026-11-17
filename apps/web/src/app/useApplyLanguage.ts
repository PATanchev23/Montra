import { useEffect } from 'react';
import { useLanguage } from '../i18n';

/** Keeps <html lang> on the interface language, for screen readers, hyphenation and fonts. */
export function useApplyLanguage() {
  const language = useLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return language;
}
