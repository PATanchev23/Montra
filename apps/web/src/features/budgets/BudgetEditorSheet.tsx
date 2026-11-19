import { categoryKey, type BudgetGoal, type BudgetMonthResponse } from '@montra/shared';
import { Plus, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { useBudgetRecommendation, useUpdateBudgets } from '../../api/finance';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Sheet } from '../../components/ui/Sheet';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { useMessages } from '../../i18n';
import { amountInputText, parseAmount } from '../../lib/amountInput';
import { cn } from '../../lib/cn';
import { money } from '../../lib/format';
import { showToast } from '../../stores/toasts';
import { budgetMessages } from './messages';
import { reason, type RecommendedLine } from './reason';
import { RecommendationSummary } from './recommendation';

interface Row {
  category: string;
  averageCents: number;
  text: string;
  error?: string;
}

/**
 * The one place budgets are set. It opens with Montra's recommendation for
 * the goal the owner picks (from the business's own months, checked against
 * the income it expects), which can fill every limit or one at a time; the
 * owner then adjusts anything before saving. Empty means no budget, and
 * saving replaces every limit.
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
  const r = useMessages(budgetMessages).recommend;
  const save = useUpdateBudgets(businessId);
  const [goal, setGoal] = useState<BudgetGoal>('within-income');
  const recommendation = useBudgetRecommendation(businessId, goal);
  const [rows, setRows] = useState<Row[]>(() =>
    data.categories.map((c) => ({
      category: c.category,
      averageCents: c.averageCents,
      text: amountInputText(c.limitCents),
    })),
  );
  const [newCategory, setNewCategory] = useState('');
  const fmt = (cents: number) => money(cents, { decimals: 0, currency: data.currency });

  const recommended = new Map(
    (recommendation.data?.lines ?? []).map((line) => [categoryKey(line.category), line]),
  );
  // A recommended category the list does not have yet (rare) is offered too.
  const shown: Row[] = [
    ...rows,
    ...[...recommended.values()]
      .filter(
        (line) => !rows.some((row) => categoryKey(row.category) === categoryKey(line.category)),
      )
      .map((line) => ({ category: line.category, averageCents: 0, text: '' })),
  ];

  const setText = (category: string, text: string) =>
    setRows((current) => {
      const key = categoryKey(category);
      const exists = current.some((row) => categoryKey(row.category) === key);
      return exists
        ? current.map((row) =>
            categoryKey(row.category) === key ? { ...row, text, error: undefined } : row,
          )
        : [...current, { category, averageCents: 0, text }];
    });

  function fillRecommendation() {
    for (const line of recommended.values())
      setText(line.category, amountInputText(line.limitCents));
  }

  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    if (!shown.some((r) => categoryKey(r.category) === categoryKey(name))) {
      setRows((current) => [...current, { category: name, averageCents: 0, text: '' }]);
    }
    setNewCategory('');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = shown.map((row) => ({ row, result: parseAmount(row.text) }));
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

  const matches =
    recommended.size > 0 &&
    [...recommended.values()].every((line) => {
      const row = shown.find((r) => categoryKey(r.category) === categoryKey(line.category));
      const parsed = row ? parseAmount(row.text) : null;
      return parsed?.ok && parsed.cents === line.limitCents;
    });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !save.isPending && onOpenChange(next)}
      title={m.title}
      description={m.description}
    >
      <form noValidate onSubmit={submit} className="flex min-h-full flex-col">
        {/* Montra's recommendation: a starting point the owner can take and adjust. */}
        <section
          aria-labelledby="budget-recommendation"
          className="mx-6 mt-4 rounded-control bg-sunken px-4 py-4"
        >
          <h3 id="budget-recommendation" className="text-body-sm font-medium text-ink">
            {r.title}
          </h3>
          <p className="mt-0.5 text-caption text-muted">
            {recommendation.data
              ? r.description(recommendation.data.monthsOfHistory)
              : r.descriptionLoading}
          </p>
          <SegmentedControl
            label={r.goal}
            size="sm"
            value={goal}
            onChange={setGoal}
            className="mt-3 w-full"
            options={[
              { value: 'within-income', label: r.goals['within-income'] },
              { value: 'save-10', label: r.goals['save-10'] },
              { value: 'save-20', label: r.goals['save-20'] },
            ]}
          />
          <div
            className={cn(
              'mt-4 transition-opacity',
              recommendation.isPlaceholderData && 'opacity-60',
            )}
          >
            {recommendation.isError ? (
              <ErrorState title={r.loadError} onRetry={() => recommendation.refetch()} />
            ) : !recommendation.data ? (
              <Skeleton className="h-20 w-full" />
            ) : recommendation.data.lines.length === 0 ? (
              <p className="text-body-sm text-muted">{r.notEnough}</p>
            ) : (
              <>
                <RecommendationSummary data={recommendation.data} fmt={fmt} />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <p className="text-caption text-muted">{matches ? r.filled : r.adjustAfter}</p>
                  <Button size="sm" onClick={fillRecommendation} disabled={matches}>
                    <Sparkles />
                    {r.fill}
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>

        <p className="px-6 pt-5 text-caption text-muted">{m.columns(data.currency)}</p>
        {shown.length === 0 && (
          <p className="mx-6 mt-3 rounded-control bg-sunken px-4 py-6 text-center text-body-sm text-muted">
            {m.noCategories}
          </p>
        )}
        <ul className="mt-1 divide-y divide-line-soft px-6">
          {shown.map((row, i) => (
            <EditorRow
              key={row.category}
              id={`budget-${i}`}
              row={row}
              line={recommended.get(categoryKey(row.category))}
              fmt={fmt}
              onChange={(text) => setText(row.category, text)}
            />
          ))}
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
            <p role="alert" className="text-body-sm text-negative">
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

/** One category: its limit, and what Montra recommends for it and why. */
function EditorRow({
  id,
  row,
  line,
  fmt,
  onChange,
}: {
  id: string;
  row: Row;
  line: RecommendedLine | undefined;
  fmt: (cents: number) => string;
  onChange: (text: string) => void;
}) {
  const m = useMessages(budgetMessages).editor;
  const r = useMessages(budgetMessages).recommend;
  const applied =
    line !== undefined &&
    (() => {
      const parsed = parseAmount(row.text);
      return parsed.ok && parsed.cents === line.limitCents;
    })();
  return (
    <li className="py-3">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="block truncate text-body text-ink">
            {row.category}
          </label>
          {line ? (
            <p className="text-caption text-muted">
              {applied ? (
                <span className="font-medium text-ink-2">
                  {r.recommendedAmount(fmt(line.limitCents))}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onChange(amountInputText(line.limitCents))}
                  aria-label={r.useOne(row.category)}
                  className="cursor-pointer rounded-sm font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                >
                  {r.recommendedAmount(fmt(line.limitCents))}
                </button>
              )}{' '}
              · {reason(line, fmt)}
            </p>
          ) : (
            <p className="text-caption text-muted">
              {row.averageCents > 0 ? m.average(fmt(row.averageCents)) : m.noRecent}
            </p>
          )}
        </div>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder={m.none}
          value={row.text}
          aria-invalid={row.error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="tabular w-32 shrink-0 text-right"
        />
      </div>
      {row.error && <p className="mt-1.5 text-right text-caption text-negative">{row.error}</p>}
    </li>
  );
}
