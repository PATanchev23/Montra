import type { CashSettings } from '@montra/shared';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import { useUpdateCashSettings } from '../../api/finance';
import { Button } from '../../components/ui/Button';
import { fieldErrorId, fieldHintId } from '../../components/ui/fieldIds';
import { Field, Input } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import { useMessages } from '../../i18n';
import { amountInputText, parseAmount } from '../../lib/amountInput';
import { showToast } from '../../stores/toasts';
import { cashFlowMessages } from './messages';

/**
 * What a ledger cannot know: how much is in the bank today, and below what
 * balance the owner wants a warning. The forecasts start from the balance.
 */
export function CashSettingsSheet({
  businessId,
  currency,
  settings,
  open,
  onOpenChange,
}: {
  businessId: string;
  currency: string;
  settings: CashSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const m = useMessages(cashFlowMessages).settings;
  const save = useUpdateCashSettings(businessId);
  const [balance, setBalance] = useState(amountInputText(settings.balanceCents));
  const [threshold, setThreshold] = useState(amountInputText(settings.lowBalanceThresholdCents));
  const [errors, setErrors] = useState<{ balance?: string; threshold?: string }>({});

  // Mounted only while open, so every opening starts from the saved values.
  function change(next: boolean) {
    if (!save.isPending) onOpenChange(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedBalance = parseAmount(balance, { signed: true });
    const parsedThreshold = parseAmount(threshold);
    const nextErrors = {
      balance: parsedBalance.ok ? undefined : parsedBalance.message,
      threshold: parsedThreshold.ok ? undefined : parsedThreshold.message,
    };
    setErrors(nextErrors);
    if (!parsedBalance.ok || !parsedThreshold.ok) return;
    save.mutate(
      { balanceCents: parsedBalance.cents, lowBalanceThresholdCents: parsedThreshold.cents },
      {
        onSuccess: () => {
          showToast({ tone: 'positive', title: m.saved });
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={change} title={m.title} description={m.description}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5 px-6 pt-5 pb-6">
        <Field
          label={m.balance(currency)}
          htmlFor="cash-balance"
          hint={m.balanceHint}
          error={errors.balance}
        >
          <Input
            id="cash-balance"
            inputMode="decimal"
            autoComplete="off"
            value={balance}
            placeholder="0"
            aria-invalid={errors.balance ? true : undefined}
            aria-describedby={
              errors.balance ? fieldErrorId('cash-balance') : fieldHintId('cash-balance')
            }
            onChange={(e) => setBalance(e.target.value)}
          />
        </Field>
        <Field
          label={m.threshold(currency)}
          htmlFor="cash-threshold"
          hint={m.thresholdHint}
          error={errors.threshold}
        >
          <Input
            id="cash-threshold"
            inputMode="decimal"
            autoComplete="off"
            value={threshold}
            aria-invalid={errors.threshold ? true : undefined}
            aria-describedby={
              errors.threshold ? fieldErrorId('cash-threshold') : fieldHintId('cash-threshold')
            }
            onChange={(e) => setThreshold(e.target.value)}
          />
        </Field>
        {save.error && (
          <p role="alert" className="text-[13px] text-negative">
            {errorMessage(save.error)}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button disabled={save.isPending} onClick={() => change(false)}>
            {m.cancel}
          </Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {save.isPending ? m.saving : m.save}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
