import {
  TRANSACTION_DATE_MAX,
  TRANSACTION_DATE_MIN,
  type TransactionCategory,
} from '@montra/shared';
import { ChevronDown, RotateCcw, Tags } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
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

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="md" className={selected ? 'border-accent-line text-ink' : ''}>
          <Tags className="text-muted" strokeWidth={1.75} />
          <span className="max-w-40 truncate">{selected ? value : 'All categories'}</span>
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
          <MenuRadioItem value={ALL}>All categories</MenuRadioItem>
          <MenuSeparator />
          <MenuLabel>
            {loading
              ? 'Loading categories…'
              : options.length
                ? 'Categories in use'
                : 'No categories yet'}
          </MenuLabel>
          {options.map((c) => (
            <MenuRadioItem
              key={c.name}
              value={c.name}
              hint={
                c.incomeCount + c.expenseCount > 0
                  ? [
                      c.incomeCount && `${c.incomeCount} income`,
                      c.expenseCount &&
                        `${c.expenseCount} expense${c.expenseCount === 1 ? '' : 's'}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Not used yet'
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
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <SegmentedControl
          label="Type"
          value={filters.type}
          onChange={(type) => update({ type })}
          options={[
            { value: 'all', label: 'All' },
            { value: 'income', label: 'Income' },
            { value: 'expense', label: 'Expenses' },
          ]}
        />
        <CategoryFilter
          selected={filters.category}
          categories={categories}
          loading={categoriesLoading}
          onChange={(category) => update({ category })}
        />
        <Select<DateRange>
          label="Date range"
          value={filters.range}
          onChange={(range) => update({ range })}
          options={DATE_RANGES}
          className="w-[148px]"
        />
        {filters.range === 'custom' && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label="From date"
              aria-invalid={rangeError ? true : undefined}
              min={TRANSACTION_DATE_MIN}
              max={TRANSACTION_DATE_MAX}
              value={filters.from}
              onChange={(e) => update({ from: e.target.value })}
              className="w-[150px]"
            />
            <span className="text-[13px] text-muted">to</span>
            <Input
              type="date"
              aria-label="To date"
              aria-invalid={rangeError ? true : undefined}
              min={TRANSACTION_DATE_MIN}
              max={TRANSACTION_DATE_MAX}
              value={filters.to}
              onChange={(e) => update({ to: e.target.value })}
              className="w-[150px]"
            />
          </div>
        )}
        {activeCount > 0 && (
          <Button variant="ghost" onClick={reset}>
            <RotateCcw />
            Reset
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
