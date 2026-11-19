import { TRANSACTION_DATE_MAX, TRANSACTION_DATE_MIN } from '@montra/shared';
import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { cn } from '../../lib/cn';
import { formatDate, formatDay } from '../../lib/format';

/*
 * Montra's date field. A field that reads like every other input (the date
 * in words, in the interface language) opens a calendar in a floating
 * layer: the month as a grid of day pills, the chosen day filled with ink,
 * today ringed. The month and year title opens a month grid for long jumps.
 *
 * Keyboard: arrows move a day or a week, Home and End go to the week's ends,
 * Page Up and Page Down a month (with Shift, a year), Enter picks, Escape
 * closes. Values are ISO dates (yyyy-mm-dd); '' is no date.
 */

const iso = (date: Date) => format(date, 'yyyy-MM-dd');
const WEEK = { weekStartsOn: 1 } as const;
const monthOf = (date: string) => `${date.slice(0, 7)}-01`;

function clamp(date: string, min: string, max: string) {
  return date < min ? min : date > max ? max : date;
}

const fieldSizes = {
  md: 'h-9 px-3 text-body-sm',
  lg: 'h-13 px-3.5 text-base',
};

export function DatePicker({
  id,
  value,
  onChange,
  min = TRANSACTION_DATE_MIN,
  max = TRANSACTION_DATE_MAX,
  label,
  invalid = false,
  describedBy,
  size = 'md',
  clearable = false,
  disabled = false,
  className,
}: {
  id?: string;
  /** yyyy-mm-dd, or '' for none. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  /** Accessible name when no visible <label> points at `id`. */
  label?: string;
  invalid?: boolean;
  describedBy?: string;
  size?: keyof typeof fieldSizes;
  /** Offers a Clear action, for dates that may be left empty. */
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const m = useMessages(common).datePicker;
  const [open, setOpen] = useState(false);
  const today = iso(new Date());

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          data-value={value}
          className={cn(
            'tabular flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-control border bg-raised text-left transition-colors',
            'focus:outline-none focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
            'disabled:cursor-not-allowed disabled:opacity-55 data-[state=open]:border-ink-2',
            invalid
              ? 'border-negative focus-visible:border-negative focus-visible:outline-negative'
              : 'border-control hover:border-ink-2',
            fieldSizes[size],
            className,
          )}
        >
          <span className={cn('min-w-0 flex-1 truncate', value ? 'text-ink' : 'text-muted')}>
            {value ? formatDate(value, 'd MMM yyyy') : m.choose}
          </span>
          <CalendarDays aria-hidden className="size-4 shrink-0 text-muted" strokeWidth={1.75} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={16}
          aria-label={m.calendar}
          // The calendar focuses its own day on open.
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="z-[70] w-[19rem] rounded-panel border border-line bg-raised p-3 shadow-pop outline-none data-[state=open]:animate-[pop-in_160ms_var(--ease-out-soft)]"
        >
          <Calendar value={value} min={min} max={max} today={today} onPick={pick} />
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
            <button
              type="button"
              disabled={today < min || today > max}
              onClick={() => pick(today)}
              className={footerButton}
            >
              {m.today}
            </button>
            {clearable && value && (
              <button type="button" onClick={() => pick('')} className={footerButton}>
                {m.clear}
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const footerButton =
  'h-8 cursor-pointer rounded-control px-2.5 text-body-sm font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45';

const navButton =
  'flex size-8 cursor-pointer items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-35';

function Calendar({
  value,
  min,
  max,
  today,
  onPick,
}: {
  value: string;
  min: string;
  max: string;
  today: string;
  onPick: (date: string) => void;
}) {
  const m = useMessages(common).datePicker;
  const start = clamp(value || today, min, max);
  const [focused, setFocused] = useState(start);
  const [month, setMonth] = useState(monthOf(start));
  const [view, setView] = useState<'days' | 'months'>('days');
  const grid = useRef<HTMLTableElement>(null);
  const moved = useRef(true);

  // Keyboard and the first opening move focus to the day; clicks on the arrows do not.
  useEffect(() => {
    if (view !== 'days' || !moved.current) return;
    moved.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus();
  }, [focused, month, view]);

  function go(date: string) {
    const next = clamp(date, min, max);
    moved.current = true;
    setFocused(next);
    setMonth(monthOf(next));
  }

  function onKeyDown(event: KeyboardEvent) {
    const day = parseISO(focused);
    const steps: Record<string, () => Date> = {
      ArrowLeft: () => addDays(day, -1),
      ArrowRight: () => addDays(day, 1),
      ArrowUp: () => addDays(day, -7),
      ArrowDown: () => addDays(day, 7),
      Home: () => startOfWeek(day, WEEK),
      End: () => endOfWeek(day, WEEK),
      PageUp: () => (event.shiftKey ? addYears(day, -1) : addMonths(day, -1)),
      PageDown: () => (event.shiftKey ? addYears(day, 1) : addMonths(day, 1)),
    };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    go(iso(step()));
  }

  const first = parseISO(month);
  const shift = (months: number) => {
    const next = iso(addMonths(first, months));
    setMonth(next);
    setFocused(clamp(next, min, max));
  };
  const canGoBack = monthOf(min) < month;
  const canGoOn = monthOf(max) > month;

  if (view === 'months') {
    const year = first.getFullYear();
    return (
      <div>
        <div className="flex items-center justify-between gap-2 pb-2">
          <button
            type="button"
            aria-label={m.previousYear}
            className={navButton}
            disabled={`${year - 1}-12-31` < min}
            onClick={() => setMonth(`${year - 1}${month.slice(4)}`)}
          >
            <ChevronLeft className="size-4" strokeWidth={2} />
          </button>
          <span className="tabular text-body-sm font-semibold text-ink">{year}</span>
          <button
            type="button"
            aria-label={m.nextYear}
            className={navButton}
            disabled={`${year + 1}-01-01` > max}
            onClick={() => setMonth(`${year + 1}${month.slice(4)}`)}
          >
            <ChevronRight className="size-4" strokeWidth={2} />
          </button>
        </div>
        <div role="group" aria-label={m.chooseMonth} className="grid grid-cols-3 gap-1">
          {Array.from({ length: 12 }, (_, i) => {
            const key = `${year}-${String(i + 1).padStart(2, '0')}-01`;
            const outside = iso(endOfMonth(parseISO(key))) < min || key > max;
            const current = key === month;
            return (
              <button
                key={key}
                type="button"
                disabled={outside}
                aria-pressed={current}
                onClick={() => {
                  setMonth(key);
                  moved.current = true;
                  setFocused(clamp(`${key.slice(0, 8)}${focused.slice(8)}`, min, max));
                  setView('days');
                }}
                className={cn(
                  'h-10 cursor-pointer rounded-full text-body-sm transition-colors first-letter:uppercase focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-35',
                  current ? 'bg-accent font-semibold text-accent-ink' : 'text-ink hover:bg-hover',
                )}
              >
                {formatDay(parseISO(key), 'LLL')}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const weeks: Date[][] = [];
  for (
    let day = startOfWeek(first, WEEK);
    day <= endOfWeek(endOfMonth(first), WEEK);
    day = addDays(day, 1)
  ) {
    if (day.getDay() === 1) weeks.push([]);
    weeks.at(-1)!.push(day);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 pb-1">
        <button
          type="button"
          aria-label={m.previousMonth}
          className={navButton}
          disabled={!canGoBack}
          onClick={() => shift(-1)}
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label={m.chooseMonth}
          onClick={() => setView('months')}
          className="h-8 cursor-pointer rounded-control px-2.5 text-body-sm font-semibold text-ink transition-colors first-letter:uppercase hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <span aria-live="polite" className="inline-block first-letter:uppercase">
            {formatDay(first, 'LLLL yyyy')}
          </span>
        </button>
        <button
          type="button"
          aria-label={m.nextMonth}
          className={navButton}
          disabled={!canGoOn}
          onClick={() => shift(1)}
        >
          <ChevronRight className="size-4" strokeWidth={2} />
        </button>
      </div>

      <table
        ref={grid}
        role="grid"
        aria-label={formatDay(first, 'LLLL yyyy')}
        data-month={month.slice(0, 7)}
        onKeyDown={onKeyDown}
        className="w-full border-collapse"
      >
        <thead>
          <tr>
            {weeks[0]!.map((day) => (
              <th
                key={iso(day)}
                scope="col"
                abbr={formatDay(day, 'EEEE')}
                className="h-8 text-caption font-medium text-muted first-letter:uppercase"
              >
                {formatDay(day, 'EEEEEE')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={iso(week[0]!)}>
              {week.map((day) => {
                const date = iso(day);
                const selected = date === value;
                const inMonth = date.slice(0, 7) === month.slice(0, 7);
                const outside = date < min || date > max;
                return (
                  <td
                    key={date}
                    role="gridcell"
                    aria-selected={selected}
                    className="p-0.5 text-center"
                  >
                    <button
                      type="button"
                      data-day={date}
                      tabIndex={date === focused ? 0 : -1}
                      disabled={outside}
                      aria-label={formatDay(day, 'EEEE, d MMMM yyyy')}
                      aria-current={date === today ? 'date' : undefined}
                      onClick={() => onPick(date)}
                      onFocus={() => setFocused(date)}
                      className={cn(
                        'tabular mx-auto flex size-9 cursor-pointer items-center justify-center rounded-full text-body-sm transition-colors',
                        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                        'disabled:cursor-not-allowed disabled:opacity-35',
                        selected
                          ? 'bg-accent font-semibold text-accent-ink'
                          : cn(
                              'hover:bg-hover',
                              inMonth ? 'text-ink' : 'text-muted',
                              date === today && 'font-semibold ring-1 ring-line-strong ring-inset',
                            ),
                      )}
                    >
                      {day.getDate()}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
