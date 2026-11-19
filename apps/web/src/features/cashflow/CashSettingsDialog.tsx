import type { CashSettings } from '@montra/shared';
import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useState, type FormEvent, type ReactNode } from 'react';
import { errorMessage } from '../../api/client';
import { useUpdateCashSettings } from '../../api/finance';
import { Button } from '../../components/ui/Button';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { amountInputText, parseAmount } from '../../lib/amountInput';
import { cn } from '../../lib/cn';
import { formatDate, money } from '../../lib/format';
import { showToast } from '../../stores/toasts';
import { currencySymbol } from '../onboarding/options';
import { cashFlowMessages } from './messages';

/**
 * What a ledger cannot know: how much is in the bank today, and below what
 * balance the owner wants a warning. The balance is the figure every forecast
 * starts from, so it is typed as one: large, beside its currency, with what it
 * changes written out underneath. The warning level is shown against it as a
 * capsule, the chart's own shape.
 *
 * Mounted only while open, so every opening starts from the saved values.
 */
export function CashSettingsDialog({
  businessId,
  currency,
  settings,
  onOpenChange,
}: {
  businessId: string;
  currency: string;
  settings: CashSettings;
  onOpenChange: (open: boolean) => void;
}) {
  const m = useMessages(cashFlowMessages).settings;
  const c = useMessages(common);
  const save = useUpdateCashSettings(businessId);
  const [balanceText, setBalanceText] = useState(amountInputText(settings.balanceCents));
  const [thresholdText, setThresholdText] = useState(
    amountInputText(settings.lowBalanceThresholdCents),
  );
  const [errors, setErrors] = useState<{ balance?: string; threshold?: string }>({});
  const symbol = currencySymbol(currency);
  const fmt = (cents: number) => money(cents, { decimals: 0, currency });

  // What the fields read as right now, for the live lines; errors wait for Save.
  const balance = parseAmount(balanceText, { signed: true });
  const threshold = parseAmount(thresholdText);
  const balanceCents = balance.ok ? balance.cents : null;
  const thresholdCents = threshold.ok ? threshold.cents : null;

  function close(next: boolean) {
    if (!save.isPending) onOpenChange(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = {
      balance: balance.ok ? undefined : balance.message,
      threshold: threshold.ok ? undefined : threshold.message,
    };
    setErrors(nextErrors);
    if (!balance.ok || !threshold.ok) return;
    save.mutate(
      { balanceCents: balance.cents, lowBalanceThresholdCents: threshold.cents },
      {
        onSuccess: () => {
          showToast({ tone: 'positive', title: m.saved });
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog.Root open onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-overlay data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[60] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[28rem] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-panel border border-line bg-raised shadow-pop outline-none data-[state=open]:animate-[pop-in_160ms_var(--ease-out-soft)]">
          <form noValidate onSubmit={submit} aria-busy={save.isPending}>
            <header className="flex items-start justify-between gap-4 px-6 pt-5">
              <div className="min-w-0">
                <Dialog.Title className="text-title text-ink">{m.title}</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-body-sm text-muted">
                  {m.description}
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label={c.close}
                className="-mr-2 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted transition-colors hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              >
                <X className="size-4" strokeWidth={2} />
              </Dialog.Close>
            </header>

            {/* The balance: the figure everything else is measured from. */}
            <div className="px-6 pt-6">
              <label htmlFor="cash-balance" className="text-body-sm font-medium text-ink-2">
                {m.balance(currency)}
              </label>
              <div
                className={cn(
                  'mt-1.5 flex items-baseline gap-2 border-b pb-2 transition-colors',
                  'has-[:focus-visible]:border-accent',
                  errors.balance
                    ? 'border-negative has-[:focus-visible]:border-negative'
                    : 'border-control hover:border-ink-2',
                )}
              >
                <span aria-hidden className="text-figure-sm text-muted tabular">
                  {symbol}
                </span>
                <input
                  id="cash-balance"
                  inputMode="decimal"
                  autoComplete="off"
                  autoFocus
                  value={balanceText}
                  placeholder="0"
                  aria-invalid={errors.balance ? true : undefined}
                  aria-describedby="cash-balance-note"
                  onChange={(e) => {
                    setBalanceText(e.target.value);
                    setErrors((current) => ({ ...current, balance: undefined }));
                  }}
                  className="tabular min-w-0 flex-1 bg-transparent text-figure text-ink caret-ink placeholder:text-faint focus:outline-none"
                />
              </div>
              <Note id="cash-balance-note" error={errors.balance}>
                {balanceCents === null ? m.balanceEmpty : m.balancePreview(fmt(balanceCents))}{' '}
                <span className="text-muted">{m.balanceHint}</span>
              </Note>
            </div>

            {/* The warning level, and where it sits against the balance. */}
            <div className="mx-6 mt-6 border-t border-line pt-5">
              <label htmlFor="cash-threshold" className="text-body-sm font-medium text-ink-2">
                {m.threshold(currency)}
              </label>
              <div
                className={cn(
                  'mt-1.5 flex h-9 w-44 items-center gap-2 rounded-control border bg-raised px-3 transition-colors',
                  'has-[:focus-visible]:border-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent',
                  errors.threshold
                    ? 'border-negative has-[:focus-visible]:border-negative has-[:focus-visible]:outline-negative'
                    : 'border-control hover:border-ink-2',
                )}
              >
                <span aria-hidden className="text-body-sm text-muted tabular">
                  {symbol}
                </span>
                <input
                  id="cash-threshold"
                  inputMode="decimal"
                  autoComplete="off"
                  value={thresholdText}
                  placeholder={m.thresholdPlaceholder}
                  aria-invalid={errors.threshold ? true : undefined}
                  aria-describedby="cash-threshold-note"
                  onChange={(e) => {
                    setThresholdText(e.target.value);
                    setErrors((current) => ({ ...current, threshold: undefined }));
                  }}
                  className="tabular min-w-0 flex-1 bg-transparent text-body-sm text-ink placeholder:text-muted focus:outline-none"
                />
              </div>
              {thresholdCents !== null && balanceCents !== null && balanceCents > 0 && (
                <Headroom balance={balanceCents} threshold={thresholdCents} fmt={fmt} />
              )}
              <Note id="cash-threshold-note" error={errors.threshold}>
                {thresholdCents === null
                  ? m.thresholdEmpty
                  : balanceCents === null
                    ? m.thresholdPreview(fmt(thresholdCents))
                    : balanceCents < thresholdCents
                      ? m.alreadyBelow
                      : m.headroom(fmt(balanceCents - thresholdCents))}
              </Note>
            </div>

            {save.error && (
              <p role="alert" className="mx-6 mt-5 text-body-sm text-negative">
                {errorMessage(save.error)}
              </p>
            )}

            <footer className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line bg-sunken/60 px-6 py-4">
              <p className="text-caption text-muted tabular">
                {settings.balanceCents !== null && settings.balanceDate !== null
                  ? m.lastSaved(
                      fmt(settings.balanceCents),
                      formatDate(settings.balanceDate, 'd MMM yyyy'),
                    )
                  : m.neverSaved}
              </p>
              <div className="ml-auto flex gap-2">
                <Button disabled={save.isPending} onClick={() => close(false)}>
                  {m.cancel}
                </Button>
                <Button type="submit" variant="primary" disabled={save.isPending}>
                  {save.isPending ? m.saving : m.save}
                </Button>
              </div>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The line under a field: what the value means, or why it cannot be saved. */
function Note({ id, error, children }: { id: string; error?: string; children: ReactNode }) {
  return (
    <p
      id={id}
      aria-live="polite"
      className={cn('mt-2 text-body-sm', error ? 'text-negative' : 'text-ink-2')}
    >
      {error ?? children}
    </p>
  );
}

/**
 * The warning level as a capsule on a track that stands for today's balance:
 * the further it reaches, the less room before the warning. A level at or
 * above the balance fills the track in the warning tone.
 */
function Headroom({
  balance,
  threshold,
  fmt,
}: {
  balance: number;
  threshold: number;
  fmt: (cents: number) => string;
}) {
  const m = useMessages(cashFlowMessages).settings;
  const reached = threshold >= balance;
  const share = reached ? 1 : threshold / balance;
  return (
    <div aria-hidden className="mt-4">
      <div className="h-2.5 overflow-hidden rounded-full bg-chart-track">
        <div
          className={cn(
            'h-full min-w-2.5 rounded-full motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-[var(--ease-out-soft)]',
            reached ? 'bg-warning' : 'bg-chart-1',
          )}
          style={{ width: `${Math.max(share, 0) * 100}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-4 text-caption text-muted tabular">
        <span>{m.meterWarning(fmt(threshold))}</span>
        <span>{m.meterBalance(fmt(balance))}</span>
      </div>
    </div>
  );
}
