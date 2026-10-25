import { ChevronDown, RotateCcw, Tags } from 'lucide-react';
import { useEffect, useState } from 'react';
import { accounts, categories } from '../../api/finance';
import { CategoryIcon } from '../../components/finance/CategoryIcon';
import { Button } from '../../components/ui/Button';
import { SearchField } from '../../components/ui/Input';
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '../../components/ui/Menu';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Select } from '../../components/ui/Select';
import type { DateRange } from '../../demo/api';
import type { CategoryId } from '../../demo/types';
import type { useTransactionFilters } from './useTransactionFilters';

const rangeOptions: { value: DateRange; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

type Filters = ReturnType<typeof useTransactionFilters>;

function CategoryFilter({
  selected,
  onChange,
}: {
  selected: CategoryId[];
  onChange: (ids: CategoryId[]) => void;
}) {
  const label =
    selected.length === 0
      ? 'All categories'
      : selected.length === 1
        ? categories.find((c) => c.id === selected[0])?.name
        : `${selected.length} categories`;
  const toggle = (id: CategoryId, on: boolean) =>
    onChange(on ? [...selected, id] : selected.filter((s) => s !== id));

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button size="md" className={selected.length ? 'border-accent-line text-ink' : ''}>
          <Tags className="text-muted" strokeWidth={1.75} />
          <span className="max-w-32 truncate">{label}</span>
          <ChevronDown className="text-muted" strokeWidth={1.75} />
        </Button>
      </MenuTrigger>
      <MenuContent
        align="start"
        className="max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] w-60 overflow-y-auto"
      >
        {(['income', 'expense'] as const).map((type) => (
          <div key={type}>
            <MenuLabel>{type === 'income' ? 'Income' : 'Expenses'}</MenuLabel>
            {categories
              .filter((c) => c.type === type)
              .map((c) => (
                <MenuCheckboxItem
                  key={c.id}
                  checked={selected.includes(c.id)}
                  onCheckedChange={(on) => toggle(c.id, on === true)}
                >
                  <CategoryIcon
                    categoryId={c.id}
                    size="sm"
                    className="size-6 rounded-md [&_svg]:size-3.5"
                  />
                  {c.name}
                </MenuCheckboxItem>
              ))}
          </div>
        ))}
        {selected.length > 0 && (
          <>
            <MenuSeparator />
            <MenuItem onSelect={() => onChange([])}>Clear selection</MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

export function TransactionsToolbar({ filters, update, reset, activeCount }: Filters) {
  // Typing updates the URL after a short pause, so every keystroke doesn't refetch.
  const [search, setSearch] = useState(filters.q);
  // Follow outside changes to the URL (reset, global search) without an effect.
  const [syncedQuery, setSyncedQuery] = useState(filters.q);
  if (filters.q !== syncedQuery) {
    setSyncedQuery(filters.q);
    setSearch(filters.q);
  }
  useEffect(() => {
    if (search === filters.q) return;
    const timer = setTimeout(() => update({ q: search }), 250);
    return () => clearTimeout(timer);
  }, [search, filters.q, update]);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SearchField
        value={search}
        onValueChange={setSearch}
        placeholder="Search description, counterparty…"
        aria-label="Search transactions"
        className="w-full sm:w-64 lg:w-72"
      />
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
        selected={filters.categories}
        onChange={(ids) => update({ categories: ids })}
      />
      <Select
        label="Account"
        value={filters.account}
        onChange={(account) => update({ account })}
        options={[
          { value: 'all', label: 'All accounts' },
          ...accounts.map((a) => ({ value: a.id, label: a.name })),
        ]}
        className="w-[148px]"
      />
      <Select
        label="Date range"
        value={filters.range}
        onChange={(range) => update({ range })}
        options={rangeOptions}
        className="w-[140px]"
      />
      {activeCount > 0 && (
        <Button variant="ghost" onClick={reset}>
          <RotateCcw />
          Reset
        </Button>
      )}
    </div>
  );
}
