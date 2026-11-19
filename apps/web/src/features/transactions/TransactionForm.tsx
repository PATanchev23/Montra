import { type Transaction, type TransactionType } from '@montra/shared';
import { useId, useState } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { useCreateTransaction, useUpdateTransaction } from '../../api/transactions';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { fieldErrorId, fieldHintId } from '../../components/ui/fieldIds';
import { Field, Input } from '../../components/ui/Input';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { showToast } from '../../stores/toasts';
import { FormNotice, TextField } from '../auth/AuthFields';
import { useSchemaForm } from '../auth/useSchemaForm';
import { useMessages } from '../../i18n';
import { transactionMessages } from './messages';
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
  const dateId = useId();
  const categoryListId = useId();
  const t = useMessages(transactionMessages);
  const m = t.form;

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
        showToast({ tone: 'positive', title: m.updated });
      } else {
        saved = await create.mutateAsync(createRequestFrom(data, currency));
        showToast({
          tone: 'positive',
          title: data.type === 'INCOME' ? m.incomeRecorded : m.expenseRecorded,
          body: data.description,
        });
      }
      onDone(saved);
    } catch (err) {
      const fieldErrors = err instanceof ApiError ? fieldErrorsFrom(err.details) : {};
      if (Object.keys(fieldErrors).length > 0) {
        setServer({ values: form.values, errors: fieldErrors });
      } else {
        setProblem(errorMessage(err, m.saveFailed));
      }
    }
  }

  const amountError = errorOf('amount');
  const amountHint = m.amountHint(currency);

  return (
    <form noValidate onSubmit={form.handleSubmit(save)} className="flex flex-col gap-5">
      {problem && <FormNotice tone="negative">{problem}</FormNotice>}

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink-2" aria-hidden>
          {m.type}
        </span>
        <SegmentedControl<TransactionType>
          label={m.type}
          value={form.values.type as TransactionType}
          onChange={(type) => form.setValue('type', type)}
          options={[
            { value: 'EXPENSE', label: t.type.EXPENSE },
            { value: 'INCOME', label: t.type.INCOME },
          ]}
          className="self-start"
        />
        {errorOf('type') && <p className="text-[12px] text-negative">{errorOf('type')}</p>}
      </div>

      <Field label={m.amount} htmlFor={amountId} hint={amountHint} error={amountError}>
        <div className="relative">
          <Input
            id={amountId}
            inputMode="decimal"
            autoComplete="off"
            placeholder={m.amountPlaceholder}
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
        label={m.description}
        autoComplete="off"
        placeholder={m.descriptionPlaceholder}
        error={errorOf('description')}
        {...form.register('description')}
      />

      <TextField
        label={m.category}
        autoComplete="off"
        placeholder={m.categoryPlaceholder}
        list={categoryListId}
        hint={categories.length > 0 ? m.categoryHint : undefined}
        error={errorOf('category')}
        {...form.register('category')}
      />
      <datalist id={categoryListId}>
        {categories.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <Field label={m.date} htmlFor={dateId} error={errorOf('date')}>
        <DatePicker
          id={dateId}
          size="lg"
          value={form.values.date}
          invalid={Boolean(errorOf('date'))}
          describedBy={errorOf('date') ? fieldErrorId(dateId) : undefined}
          onChange={(date) => form.setValue('date', date)}
        />
      </Field>

      <div className="mt-2 flex justify-end gap-2 border-t border-line-soft pt-5">
        <Button onClick={onCancel} disabled={busy}>
          {m.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={busy || unchanged}>
          {busy ? m.saving : transaction ? m.saveChanges : m.add}
        </Button>
      </div>
    </form>
  );
}
