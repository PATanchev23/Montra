import { SUPPORTED_CURRENCIES, type Currency } from '@montra/shared';
import type { SelectOption } from '../../components/ui/Select';
import { currentIntlLocale } from '../../i18n';

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
