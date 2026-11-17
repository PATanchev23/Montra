/**
 * Montra's interface languages. English and Bulgarian are both required, so
 * every catalogue defines both. Kept free of imports so the preferences store
 * can use it without a cycle.
 */
export const LANGUAGES = ['en', 'bg'] as const;
export type Language = (typeof LANGUAGES)[number];

export const isLanguage = (value: unknown): value is Language =>
  LANGUAGES.includes(value as Language);

/** Each language's own name for itself, for the language switcher. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', bg: 'Български' };

/** The BCP 47 locale behind each language, for `Intl` number and date formatting. */
export const INTL_LOCALES: Record<Language, string> = { en: 'en-IE', bg: 'bg-BG' };

/**
 * A browser asking for Bulgarian first gets Bulgarian; everyone else starts in
 * English. index.html applies the same rule before first paint.
 */
export function detectLanguage(): Language {
  const preferred = typeof navigator === 'undefined' ? '' : (navigator.language ?? '');
  return preferred.toLowerCase().startsWith('bg') ? 'bg' : 'en';
}
