import {
  TRANSACTION_DATE_MAX,
  TRANSACTION_DATE_MIN,
  type Transaction,
  type TransactionType,
} from '@montra/shared';
import { useId, useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { useCreateTransaction, useUpdateTransaction } from '../../api/transactions';
import { Button } from '../../components/ui/Button';
import { fieldErrorId, fieldHintId } from '../../components/ui/fieldIds';
import { Field, Input } from '../../components/ui/Input';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { showToast } from '../../stores/toasts';
import { FormNotice, TextField } from '../auth/AuthFields';
import { useSchemaForm } from '../auth/useSchemaForm';
import {
  createRequestFrom,
  fieldErrorsFrom,
  formValuesFrom,
  transactionFormSchema,
  updateRequestFrom,
  type TransactionFormValues,
} from './formSchema';

type FieldName = keyof TransactionFormValues;

/**
 * Records a new transaction, or changes `transaction`. Validates with the
 * shared schemas as the user types; the API validates again and has the
 * final say (including on who may make changes).
 */
export function TransactionForm({
  businessId,
  currency,
  transaction,
  categories,
  onDone,
  onCancel,
}: {
  businessId: string;
  currency: string;
  /** Null to record a new one. */
  transaction: Transaction | null;
  /** Suggestions for the category field. */
  categories: string[];
  onDone: (saved: Transaction) => void;
  onCancel: () => void;
}) {
  const form = useSchemaForm(transactionFormSchema, formValuesFrom(transaction));
  const create = useCreateTransaction(businessId);
  const update = useUpdateTransaction(businessId);
  const [problem, setProblem] = useState<string | null>(null);
  // API field errors, shown until the field is changed.
  const [server, setServer] = useState<{
    values: TransactionFormValues;
    errors: Partial<Record<FieldName, string>>;
  } | null>(null);
  const amountId = useId();
  const categoryListId = useId();

  const busy = create.isPending || update.isPending;
  const unchanged =
    transaction !== null &&
    (Object.keys(form.values) as FieldName[]).every(
      (name) => form.values[name] === formValuesFrom(transaction)[name],
    );

  const errorOf = (name: FieldName) =>
    form.errors[name] ??
    (server && server.values[name] === form.values[name] ? server.errors[name] : undefined);

  async function save(data: ReturnType<typeof transactionFormSchema.parse>) {
    setProblem(null);
    setServer(null);
    try {
      let saved: Transaction;
      if (transaction) {
        const changes = updateRequestFrom(data, transaction, currency);
        if (!changes) return onDone(transaction);
        saved = await update.mutateAsync({ id: transaction.id, changes });
        showToast({ tone: 'positive', title: 'Transaction updated' });
      } else {
        saved = await create.mutateAsync(createRequestFrom(data, currency));
        showToast({
          tone: 'positive',
          title: data.type === 'INCOME' ? 'Income recorded' : 'Expense recorded',
          body: data.description,
        });
      }
      onDone(saved);
    } catch (err) {
      const fieldErrors = err instanceof ApiError ? fieldErrorsFrom(err.details) : {};
      if (Object.keys(fieldErrors).length > 0) {
        setServer({ values: form.values, errors: fieldErrors });
      } else {
        setProblem(
          errorMessage(
            err,
            'The transaction could not be saved. Check your connection and try again.',
          ),
        );
      }
    }
  }

  const amountError = errorOf('amount');
  const amountHint = `In ${currency}, the business currency.`;

  return (
    <form noValidate onSubmit={form.handleSubmit(save)} className="flex flex-col gap-5">
      {problem && <FormNotice tone="negative">{problem}</FormNotice>}

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-2" aria-hidden>
          Type
        </span>
        <SegmentedControl<TransactionType>
          label="Type"
          value={form.values.type as TransactionType}
          onChange={(type) => form.setValue('type', type)}
          options={[
            { value: 'EXPENSE', label: 'Expense' },
            { value: 'INCOME', label: 'Income' },
          ]}
          className="self-start"
        />
        {errorOf('type') && <p className="text-[12px] text-negative">{errorOf('type')}</p>}
      </div>

      <Field label="Amount" htmlFor={amountId} hint={amountHint} error={amountError}>
        <div className="relative">
          <Input
            id={amountId}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            aria-invalid={amountError ? true : undefined}
            aria-describedby={amountError ? fieldErrorId(amountId) : fieldHintId(amountId)}
            className="tabular h-11 pr-14 text-[14px]"
            {...form.register('amount')}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[12px] text-muted"
          >
            {currency}
          </span>
        </div>
      </Field>

      <TextField
        label="Description"
        autoComplete="off"
        placeholder="e.g. Supplier invoice 1042"
        error={errorOf('description')}
        {...form.register('description')}
      />

      <TextField
        label="Category"
        autoComplete="off"
        placeholder="e.g. Advertising"
        list={categoryListId}
        hint={
          categories.length > 0
            ? 'Choose a category you already use, or type a new one.'
            : undefined
        }
        error={errorOf('category')}
        {...form.register('category')}
      />
      <datalist id={categoryListId}>
        {categories.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <TextField
        label="Date"
        type="date"
        min={TRANSACTION_DATE_MIN}
        max={TRANSACTION_DATE_MAX}
        error={errorOf('date')}
        {...form.register('date')}
      />

      <div className="mt-2 flex justify-end gap-2 border-t border-line-soft pt-5">
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy || unchanged}>
          {busy ? 'Saving…' : transaction ? 'Save changes' : 'Add transaction'}
        </Button>
      </div>
    </form>
  );
}
