import { SUPPORTED_CURRENCIES, type Currency } from '@montra/shared';
import type { SelectOption } from '../../components/ui/Select';
import { currentIntlLocale } from '../../i18n';
import { INDUSTRY_PRESETS, onboardingMessages, type IndustryPreset } from './messages';

/**
 * The preset card a saved industry answer came from, in either language, so
 * "Electronics" chosen in English still shows its card in Bulgarian. Anything
 * else the owner typed is their own text and belongs to "Something else".
 */
export function industryPresetFor(industry: string): IndustryPreset | undefined {
  const text = industry.trim().toLocaleLowerCase();
  if (!text) return undefined;
  return INDUSTRY_PRESETS.find((preset) =>
    [onboardingMessages.en, onboardingMessages.bg].some(
      (catalog) => catalog.industries[preset].label.toLocaleLowerCase() === text,
    ),
  );
}

/*
 * Names come from Intl in the interface language ("Euro" / "евро",
 * "January" / "януари"), so these are built on each call, not once.
 */

export function currencyLabel(code: string): string {
  const names = new Intl.DisplayNames([currentIntlLocale()], { type: 'currency' });
  return `${names.of(code) ?? code} (${code})`;
}

export function currencyOptions(): SelectOption<Currency>[] {
  return SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: currencyLabel(code) }));
}

export interface CurrencyChoice {
  code: Currency;
  /** "Euro" / "евро", in the interface language. */
  name: string;
  /** The sign written beside amounts: €, $, £, zł, Kč … (the code when there is none). */
  symbol: string;
}

/** Every supported currency with its name and the sign amounts are written with. */
export function currencyChoices(): CurrencyChoice[] {
  const locale = currentIntlLocale();
  const names = new Intl.DisplayNames([locale], { type: 'currency' });
  return SUPPORTED_CURRENCIES.map((code) => ({
    code,
    name: names.of(code) ?? code,
    symbol: currencySymbol(code),
  }));
}

export function currencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat(currentIntlLocale(), {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0);
    return parts.find((part) => part.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}

/**
 * Short month names for the month grid: "Jan" / "Яну". Taken from the long
 * name, because some locales' own short form is a number (bg-BG gives "01").
 */
export function shortMonthName(month: number): string {
  const long = new Intl.DateTimeFormat(currentIntlLocale(), {
    month: 'long',
    timeZone: 'UTC',
  }).format(Date.UTC(2026, month - 1, 1));
  return long.slice(0, 3);
}

/**
 * The financial year that contains `today` when it starts in `startMonth`
 * (1–12): its first and last day, and which month of it today falls in.
 */
export function financialYearAround(startMonth: number, today = new Date()) {
  const month = today.getMonth() + 1;
  const startYear = month >= startMonth ? today.getFullYear() : today.getFullYear() - 1;
  const start = new Date(startYear, startMonth - 1, 1);
  const end = new Date(startYear + 1, startMonth - 1, 0);
  const format = new Intl.DateTimeFormat(currentIntlLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return {
    range: format.formatRange(start, end),
    /** 1 for the first month of the financial year … 12 for the last. */
    monthOf: ((month - startMonth + 12) % 12) + 1,
  };
}

/** The place part of a zone, for compact display: "America/New_York" → "New York". */
export function timeZoneCity(zone: string): string {
  return (zone.split('/').at(-1) ?? zone).replaceAll('_', ' ');
}

/** The time of day in `zone` now, e.g. "19:42", in the interface language. */
export function timeIn(zone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat(currentIntlLocale(), {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(now);
  } catch {
    return '';
  }
}

/** Lower case, no accents, separators as spaces: how time zones are searched. */
export function searchable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[/_()-]+/g, ' ');
}

/** The zones whose label holds every word of `query`, in their usual order. */
export function filterTimeZones(
  options: SelectOption<string>[],
  query: string,
): SelectOption<string>[] {
  const words = searchable(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return options;
  return options.filter((option) => {
    const haystack = searchable(option.label);
    return words.every((word) => haystack.includes(word));
  });
}

/** January to December; values are month numbers as text, 1 to 12. */
export function monthOptions(): SelectOption<string>[] {
  const format = new Intl.DateTimeFormat(currentIntlLocale(), { month: 'long', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: format.format(Date.UTC(2026, index, 1)),
  }));
}

export function monthName(month: number): string {
  return monthOptions()[month - 1]?.label ?? String(month);
}

/** "America/New_York" → "America/New York (GMT-4)", with the offset in effect today. */
export function timeZoneLabel(zone: string): string {
  const offset = new Intl.DateTimeFormat(currentIntlLocale(), {
    timeZone: zone,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(new Date())
    .find((part) => part.type === 'timeZoneName')?.value;
  return `${zone.replaceAll('_', ' ')}${offset ? ` (${offset})` : ''}`;
}

let allTimeZones: SelectOption<string>[] | undefined;

/**
 * Every IANA time zone this browser knows, built on first use. The selected
 * zone is always listed, even if the browser names it differently.
 */
export function timeZoneOptions(selected: string): SelectOption<string>[] {
  allTimeZones ??= Intl.supportedValuesOf('timeZone').map((zone) => ({
    value: zone,
    label: timeZoneLabel(zone),
  }));
  return allTimeZones.some((option) => option.value === selected)
    ? allTimeZones
    : [{ value: selected, label: timeZoneLabel(selected) }, ...allTimeZones];
}
