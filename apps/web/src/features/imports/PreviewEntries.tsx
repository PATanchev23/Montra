import type { ImportEntry, ImportEntryStatus, ImportSummary } from '@montra/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Amount } from '../../components/finance/Amount';
import { Badge } from '../../components/ui/Badge';
import { IconButton } from '../../components/ui/IconButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { formatDate } from '../../lib/format';
import { entryType } from '../transactions/display';
import { entryStatusLabels, fieldLabels } from './labels';

export const PREVIEW_PAGE_SIZE = 50;

type Filter = 'all' | ImportEntryStatus;

function EntryRow({
  entry,
  currency,
  included,
  canInclude,
  onToggle,
}: {
  entry: ImportEntry;
  currency: string;
  included: boolean;
  canInclude: boolean;
  onToggle: (included: boolean) => void;
}) {
  const t = entry.transaction;
  const status = entryStatusLabels[entry.status];
  return (
    <li className="grid grid-cols-[52px_minmax(0,1fr)_auto] gap-x-3 border-t border-line-soft px-6 py-3">
      <span className="tabular pt-0.5 text-[12px] text-faint">Row {entry.row}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={status.tone}>{status.label}</Badge>
          {t ? (
            <span className="min-w-0 truncate text-[13px] text-ink">{t.description}</span>
          ) : (
            <span className="text-[13px] text-muted">Could not be read</span>
          )}
        </div>
        {t && (
          <p className="mt-1 truncate text-[12px] text-muted">
            {formatDate(t.date, 'd MMM yyyy')} · {t.category}
            {t.externalId && <> · {t.externalId}</>}
          </p>
        )}
        {entry.issues.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {entry.issues.map((issue, i) => (
              <li key={i} className="text-[12px] leading-snug text-negative">
                {issue.field && <span className="font-medium">{fieldLabels[issue.field]}: </span>}
                {issue.message}
              </li>
            ))}
          </ul>
        )}
        {entry.notes.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {entry.notes.map((note, i) => (
              <li key={i} className="text-[12px] leading-snug text-muted">
                {note}
              </li>
            ))}
          </ul>
        )}
        {entry.cells && entry.status === 'INVALID' && (
          <p
            className="mt-1.5 truncate font-mono text-[11px] text-faint"
            title={entry.cells.join(' | ')}
          >
            {entry.cells.map((cell) => cell || '∅').join(' | ')}
          </p>
        )}
        {entry.status === 'POSSIBLE_DUPLICATE' && canInclude && (
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-[12px] text-ink-2">
            <input
              type="checkbox"
              checked={included}
              onChange={(e) => onToggle(e.target.checked)}
              className="size-3.5 accent-[var(--accent)]"
            />
            Import anyway
          </label>
        )}
      </div>
      <span className="pt-0.5 text-right text-[13px]">
        {t && <Amount cents={t.amountCents} type={entryType(t.type)} currency={currency} />}
      </span>
    </li>
  );
}

/**
 * Every record found in the file, by status, a page at a time. Possible
 * duplicates are left out unless the owner ticks them.
 */
export function PreviewEntries({
  entries,
  summary,
  currency,
  included,
  onToggleIncluded,
  canInclude,
}: {
  entries: ImportEntry[];
  summary: ImportSummary;
  currency: string;
  included: ReadonlySet<number>;
  onToggleIncluded: (index: number, included: boolean) => void;
  canInclude: boolean;
}) {
  const [filter, setFilter] = useState<Filter>(summary.invalid > 0 ? 'INVALID' : 'all');
  const [page, setPage] = useState(1);

  const shown = filter === 'all' ? entries : entries.filter((entry) => entry.status === filter);
  const pageCount = Math.max(1, Math.ceil(shown.length / PREVIEW_PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const slice = shown.slice((current - 1) * PREVIEW_PAGE_SIZE, current * PREVIEW_PAGE_SIZE);

  const counts: Record<Filter, number> = {
    all: summary.total,
    VALID: summary.valid,
    INVALID: summary.invalid,
    DUPLICATE: summary.duplicates,
    POSSIBLE_DUPLICATE: summary.possibleDuplicates,
  };
  const options = (
    [
      ['all', 'All'],
      ['VALID', 'Valid'],
      ['INVALID', 'Invalid'],
      ['DUPLICATE', 'Duplicates'],
      ['POSSIBLE_DUPLICATE', 'Possible duplicates'],
    ] as const
  )
    .filter(([value]) => value === 'all' || counts[value] > 0)
    .map(([value, label]) => ({ value, label: `${label} ${counts[value].toLocaleString('en')}` }));

  return (
    <div>
      <div className="overflow-x-auto px-6 pb-3">
        <SegmentedControl<Filter>
          label="Show records"
          size="sm"
          value={options.some((o) => o.value === filter) ? filter : 'all'}
          onChange={(next) => {
            setFilter(next);
            setPage(1);
          }}
          options={options}
        />
      </div>
      <ul aria-label="Records in the file">
        {slice.map((entry) => (
          <EntryRow
            key={entry.index}
            entry={entry}
            currency={currency}
            included={included.has(entry.index)}
            canInclude={canInclude}
            onToggle={(on) => onToggleIncluded(entry.index, on)}
          />
        ))}
      </ul>
      {shown.length > PREVIEW_PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 border-t border-line-soft px-6 py-2.5">
          <span className="tabular text-[12px] text-muted">
            {((current - 1) * PREVIEW_PAGE_SIZE + 1).toLocaleString('en')}–
            {Math.min(shown.length, current * PREVIEW_PAGE_SIZE).toLocaleString('en')} of{' '}
            {shown.length.toLocaleString('en')}
          </span>
          <div className="flex gap-1">
            <IconButton
              label="Previous records"
              size="sm"
              bordered
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft />
            </IconButton>
            <IconButton
              label="Next records"
              size="sm"
              bordered
              disabled={current >= pageCount}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  );
}
