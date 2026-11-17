import { Check, ChevronDown, Clock, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { popoverSurface } from '../../components/ui/Menu';
import { useMessages } from '../../i18n';
import { cn } from '../../lib/cn';
import { defaultTimeZone } from './draft';
import { onboardingMessages } from './messages';
import { filterTimeZones, timeIn, timeZoneCity, timeZoneOptions } from './options';

/**
 * A searchable time zone field (the WAI-ARIA combobox pattern): type part of
 * a city or region, move with the arrow keys, Enter to choose, Escape to
 * close. Closed, it shows the chosen zone; the local time there sits beneath.
 */
export function TimeZonePicker({
  id,
  value,
  onChange,
  describedBy,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (zone: string) => void;
  describedBy?: string;
  invalid?: boolean;
}) {
  const m = useMessages(onboardingMessages).explain;
  const options = useMemo(() => timeZoneOptions(value), [value]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => filterTimeZones(options, query), [options, query]);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
  const deviceZone = useMemo(() => defaultTimeZone(), []);
  const now = useNow();

  // Keep the highlighted zone in view as the arrow keys move through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);

  function openList() {
    if (open) return;
    setQuery('');
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setQuery('');
  }

  function choose(zone: string) {
    onChange(zone);
    close();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) openList();
        else setActive((index) => Math.min(results.length - 1, index + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) openList();
        else setActive((index) => Math.max(0, index - 1));
        break;
      case 'Enter':
        // Choosing a zone must not submit the step.
        if (open) {
          event.preventDefault();
          const option = results[active];
          if (option) choose(option.value);
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          close();
        }
        break;
    }
  }

  const activeOption = open && results[active] ? optionId(active) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted"
          strokeWidth={1.75}
        />
        <input
          id={id}
          name="timezone"
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeOption}
          aria-describedby={describedBy}
          aria-invalid={invalid ? true : undefined}
          value={open ? query : selectedLabel}
          placeholder={open ? m.timeZoneSearch : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onClick={openList}
          onKeyDown={onKeyDown}
          onBlur={close}
          className="h-12 w-full min-w-0 rounded-control border border-control bg-raised pr-11 pl-11 text-[16px] text-ink transition-colors placeholder:text-muted hover:border-ink-2 focus:outline-none focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-invalid:border-negative"
        />
        <ChevronDown
          aria-hidden
          className={cn(
            'pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted transition-transform duration-150',
            open && 'rotate-180',
          )}
          strokeWidth={1.75}
        />
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={m.timeZoneSearch}
          hidden={!open}
          className={cn(
            popoverSurface,
            'absolute inset-x-0 top-full mt-1.5 max-h-72 overflow-y-auto overscroll-contain',
          )}
        >
          {/* Over 400 zones: they are only drawn while the list is open. */}
          {(open ? results : []).map((option, index) => {
            const selected = option.value === value;
            return (
              <li
                key={option.value}
                id={optionId(index)}
                data-index={index}
                role="option"
                aria-selected={selected}
                // Keeps focus in the field, so the list stays open until the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option.value)}
                onMouseMove={() => setActive(index)}
                className={cn(
                  'flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-control px-3 py-2 text-[14px] text-ink-2',
                  index === active && 'bg-hover text-ink',
                  selected && 'font-medium text-ink',
                )}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {selected && <Check aria-hidden className="size-4 shrink-0" strokeWidth={2.25} />}
              </li>
            );
          })}
        </ul>
        {open && results.length === 0 && (
          <p
            className={cn(
              popoverSurface,
              'absolute inset-x-0 top-full mt-1.5 px-3.5 py-3 text-[14px] text-muted',
            )}
          >
            {m.timeZoneNone(query)}
          </p>
        )}
        <p aria-live="polite" className="sr-only">
          {open && query ? m.timeZoneResults(results.length) : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
        <span className="flex items-center gap-1.5 text-ink-2 tabular">
          <Clock aria-hidden className="size-3.5 text-muted" strokeWidth={1.75} />
          {m.localTime(timeIn(value, now))}
        </span>
        {deviceZone !== value && (
          <button
            type="button"
            onClick={() => onChange(deviceZone)}
            className="cursor-pointer rounded-sm text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {m.useDeviceZone(timeZoneCity(deviceZone))}
          </button>
        )}
      </div>
    </div>
  );
}

/** The current time, refreshed every 30 seconds, so a clock beside a zone stays right. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
