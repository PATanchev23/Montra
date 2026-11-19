import { type TransactionCategory } from '@montra/shared';
import { ChevronDown, RotateCcw, Tags } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '../../components/ui/Menu';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Select } from '../../components/ui/Select';
import { useMessages } from '../../i18n';
import { transactionMessages } from './messages';
import { DATE_RANGES, type DateRange, type useTransactionFilters } from './useTransactionFilters';

type Filters = ReturnType<typeof useTransactionFilters>;

const ALL = '__all__';

function CategoryFilter({
  selected,
  categories,
  loading,
  onChange,
}: {
  selected: string;
  categories: TransactionCategory[];
  loading: boolean;
  onChange: (category: string) => void;
}) {
  // A category from a link may not be in use (yet); it is still the active filter.
  const known = categories.find((c) => c.name.toLowerCase() === selected.toLowerCase());
  const options =
    selected && !known
      ? [{ name: selected, incomeCount: 0, expenseCount: 0 }, ...categories]
      : categories;
  const value = known?.name ?? selected;
  const m = useMessages(transactionMessages).toolbar;

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="md" className={selected ? 'border-accent-line text-ink' : ''}>
          <Tags className="text-muted" strokeWidth={1.75} />
          <span className="max-w-40 truncate">{selected ? value : m.allCategories}</span>
          <ChevronDown className="text-muted" strokeWidth={1.75} />
        </Button>
      </MenuTrigger>
      <MenuContent
        align="start"
        className="max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] w-64 overflow-y-auto"
      >
        <MenuRadioGroup
          value={value || ALL}
          onValueChange={(next) => onChange(next === ALL ? '' : next)}
        >
          <MenuRadioItem value={ALL}>{m.allCategories}</MenuRadioItem>
          <MenuSeparator />
          <MenuLabel>
            {loading ? m.loadingCategories : options.length ? m.categoriesInUse : m.noCategories}
          </MenuLabel>
          {options.map((c) => (
            <MenuRadioItem
              key={c.name}
              value={c.name}
              hint={
                c.incomeCount + c.expenseCount > 0
                  ? m.categoryCounts(c.incomeCount, c.expenseCount)
                  : m.notUsed
              }
            >
              {c.name}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

export function TransactionsToolbar({
  filters,
  update,
  reset,
  activeCount,
  categories,
  categoriesLoading,
  rangeError,
}: Filters & {
  categories: TransactionCategory[];
  categoriesLoading: boolean;
  rangeError: string | null;
}) {
  const m = useMessages(transactionMessages);
  const t = m.toolbar;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <SegmentedControl
          label={t.type}
          value={filters.type}
          onChange={(type) => update({ type })}
          options={[
            { value: 'all', label: t.all },
            { value: 'income', label: t.income },
            { value: 'expense', label: t.expenses },
          ]}
        />
        <CategoryFilter
          selected={filters.category}
          categories={categories}
          loading={categoriesLoading}
          onChange={(category) => update({ category })}
        />
        <Select<DateRange>
          label={t.dateRange}
          value={filters.range}
          onChange={(range) => update({ range })}
          options={DATE_RANGES.map((value) => ({ value, label: m.ranges[value] }))}
          className="w-auto min-w-[148px]"
        />
        {filters.range === 'custom' && (
          <div className="flex items-center gap-2">
            <DatePicker
              label={t.fromDate}
              invalid={Boolean(rangeError)}
              value={filters.from}
              onChange={(from) => update({ from })}
              className="w-[150px]"
            />
            <span className="text-[13px] text-muted">{t.to}</span>
            <DatePicker
              label={t.toDate}
              invalid={Boolean(rangeError)}
              value={filters.to}
              onChange={(to) => update({ to })}
              className="w-[150px]"
            />
          </div>
        )}
        {activeCount > 0 && (
          <Button variant="ghost" onClick={reset}>
            <RotateCcw />
            {t.reset}
          </Button>
        )}
      </div>
      {rangeError && (
        <p role="alert" className="text-[12px] text-negative">
          {rangeError}
        </p>
      )}
    </div>
  );
}
