import { categoryKey, type BudgetMonthResponse } from '@montra/shared';
import { Plus, Wand2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { useUpdateBudgets } from '../../api/finance';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import { useMessages } from '../../i18n';
import { amountInputText, parseAmount } from '../../lib/amountInput';
import { money } from '../../lib/format';
import { showToast } from '../../stores/toasts';
import { budgetMessages } from './messages';

interface Row {
  category: string;
  averageCents: number;
  text: string;
  error?: string;
}

/** A suggested limit: the recent monthly average, rounded up to a whole 10. */
const suggestion = (averageCents: number) => Math.ceil(averageCents / 1_000) * 1_000;

/**
 * One limit per expense category. The categories are the ones the business
 * actually spends in (from its transactions), each with its recent monthly
 * average; empty means no budget. Saving replaces every limit.
 */
export function BudgetEditorSheet({
  businessId,
  data,
  open,
  onOpenChange,
}: {
  businessId: string;
  data: BudgetMonthResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const m = useMessages(budgetMessages).editor;
  const save = useUpdateBudgets(businessId);
  const [rows, setRows] = useState<Row[]>(() =>
    data.categories.map((c) => ({
      category: c.category,
      averageCents: c.averageCents,
      text: amountInputText(c.limitCents),
    })),
  );
  const [newCategory, setNewCategory] = useState('');
  const fmt = (cents: number) => money(cents, { decimals: 0, currency: data.currency });

  const update = (index: number, text: string) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, text, error: undefined } : row)),
    );

  function fillAverages() {
    setRows((current) =>
      current.map((row) =>
        row.text.trim() === '' && row.averageCents > 0
          ? { ...row, text: amountInputText(suggestion(row.averageCents)), error: undefined }
          : row,
      ),
    );
  }

  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    if (rows.some((r) => categoryKey(r.category) === categoryKey(name))) {
      setNewCategory('');
      return;
    }
    setRows((current) => [...current, { category: name, averageCents: 0, text: '' }]);
    setNewCategory('');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = rows.map((row) => ({ row, result: parseAmount(row.text) }));
    if (parsed.some(({ result }) => !result.ok)) {
      setRows(
        parsed.map(({ row, result }) => ({
          ...row,
          error: result.ok ? undefined : result.message,
        })),
      );
      return;
    }
    const limits = parsed.flatMap(({ row, result }) =>
      result.ok && result.cents ? [{ category: row.category, limitCents: result.cents }] : [],
    );
    save.mutate(
      { limits },
      {
        onSuccess: () => {
          showToast({ tone: 'positive', title: m.saved });
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !save.isPending && onOpenChange(next)}
      title={m.title}
      description={m.description}
    >
      <form noValidate onSubmit={submit} className="flex min-h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-6 pt-4">
          <p className="text-[12px] text-muted">{m.columns(data.currency)}</p>
          <Button size="sm" variant="ghost" onClick={fillAverages}>
            <Wand2 />
            {m.fill}
          </Button>
        </div>
        {rows.length === 0 && (
          <p className="mx-6 mt-3 rounded-control bg-sunken px-4 py-6 text-center text-body-sm text-muted">
            {m.noCategories}
          </p>
        )}
        <ul className="mt-2 divide-y divide-line-soft px-6">
          {rows.map((row, i) => {
            const id = `budget-${i}`;
            return (
              <li key={row.category} className="py-3">
                <div className="flex items-center gap-4">
                  <label htmlFor={id} className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-ink">{row.category}</span>
                    <span className="block text-[12px] text-muted">
                      {row.averageCents > 0 ? m.average(fmt(row.averageCents)) : m.noRecent}
                    </span>
                  </label>
                  <Input
                    id={id}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={m.none}
                    value={row.text}
                    aria-invalid={row.error ? true : undefined}
                    onChange={(e) => update(i, e.target.value)}
                    className="tabular w-32 text-right"
                  />
                </div>
                {row.error && (
                  <p className="mt-1.5 text-right text-[12px] text-negative">{row.error}</p>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mx-6 mt-2 flex gap-2 border-t border-line pt-4">
          <Input
            aria-label={m.newCategory}
            placeholder={m.newCategory}
            value={newCategory}
            maxLength={60}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCategory();
              }
            }}
          />
          <Button onClick={addCategory} disabled={!newCategory.trim()}>
            <Plus />
            {m.add}
          </Button>
        </div>

        <div className="mt-auto flex flex-col gap-3 border-t border-line px-6 py-4">
          {save.error && (
            <p role="alert" className="text-[13px] text-negative">
              {errorMessage(save.error)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button disabled={save.isPending} onClick={() => onOpenChange(false)}>
              {m.cancel}
            </Button>
            <Button type="submit" variant="primary" disabled={save.isPending}>
              {save.isPending ? m.saving : m.save}
            </Button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}
