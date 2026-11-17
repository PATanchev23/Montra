// English dates keep date-fns' default (en-US) names, as before languages existed.
import { bg as bgDateLocale, enUS as enDateLocale } from 'date-fns/locale';
import { useUiStore } from '../stores/ui';

import { INTL_LOCALES, type Language } from './language';

export * from './language';

const DATE_LOCALES = { en: enDateLocale, bg: bgDateLocale };

/** The shape every translation must match: the English messages with literal types widened. */
export type Translation<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => R
    : T extends readonly (infer U)[]
      ? readonly Translation<U>[]
      : { [K in keyof T]: Translation<T[K]> };

export type Catalog<T> = Record<Language, Translation<T>>;

/**
 * Declares one area's messages. English is the source; `bg` must provide every
 * key with the same parameters. Messages that depend on a count or a value are
 * functions, so each language can build its own grammar (Bulgarian counted
 * forms, word order) instead of concatenating fragments.
 */
export function defineMessages<T>(en: T, bg: Translation<T>): Catalog<T> {
  return { en: en as Translation<T>, bg };
}

/** The active language, re-rendering when it changes. */
export function useLanguage(): Language {
  return useUiStore((state) => state.language);
}

/** One catalogue in the active language, for components. */
export function useMessages<T>(catalog: Catalog<T>): Translation<T> {
  return catalog[useLanguage()];
}

/** The active language outside React (formatters, API error handling). */
export function currentLanguage(): Language {
  return useUiStore.getState().language;
}

/** One catalogue in the active language, outside React. */
export function messagesFor<T>(catalog: Catalog<T>): Translation<T> {
  return catalog[currentLanguage()];
}

export const currentIntlLocale = () => INTL_LOCALES[currentLanguage()];
export const currentDateLocale = () => DATE_LOCALES[currentLanguage()];
