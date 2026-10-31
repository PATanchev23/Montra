import { SUPPORTED_CURRENCIES, type Currency, type OnboardingStep } from '@montra/shared';
import type { SelectOption } from '../../components/ui/Select';

const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });

export function currencyLabel(code: string): string {
  return `${currencyNames.of(code) ?? code} (${code})`;
}

export const currencyOptions: SelectOption<Currency>[] = SUPPORTED_CURRENCIES.map((code) => ({
  value: code,
  label: currencyLabel(code),
}));

const monthFormat = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' });

/** January to December; values are month numbers as text, 1 to 12. */
export const monthOptions: SelectOption<string>[] = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: monthFormat.format(Date.UTC(2026, index, 1)),
}));

export function monthName(month: number): string {
  return monthOptions[month - 1]?.label ?? String(month);
}

/** "America/New_York" → "America/New York (GMT-4)", with the offset in effect today. */
export function timeZoneLabel(zone: string): string {
  const offset = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'shortOffset' })
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

export const stepCopy: Record<
  OnboardingStep,
  { label: string; title: string; description: string }
> = {
  BUSINESS_DETAILS: {
    label: 'Business',
    title: 'Tell us about your business',
    description: 'Montra uses these details to label, date and format your figures.',
  },
  FINANCIAL_PREFERENCES: {
    label: 'Preferences',
    title: 'Financial preferences',
    description: 'How your financial year runs, and when Montra should warn you about cash.',
  },
  REVIEW: {
    label: 'Review',
    title: 'Review and create',
    description: 'Check your answers. Montra then creates your business and makes you its owner.',
  },
};
