import type { Transaction } from '@montra/shared';
import { Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { errorMessage } from '../../api/client';
import { useDeleteTransaction } from '../../api/transactions';
import { Amount } from '../../components/finance/Amount';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Sheet } from '../../components/ui/Sheet';
import { formatDate, money } from '../../lib/format';
import { showToast } from '../../stores/toasts';
import { entryType, sourceLabel, typeLabel } from './display';
import { TypeIcon } from './TypeIcon';
import { TransactionForm } from './TransactionForm';

/** What the transaction sheet shows: one transaction, its edit form, or a new one. */
export type SheetState =
  | { mode: 'view'; transaction: Transaction }
  | { mode: 'edit'; transaction: Transaction }
  | { mode: 'create' }
  | null;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-t border-line-soft py-3.5 text-[13px]">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-ink">{children}</dd>
    </div>
  );
}

const timestamp = (iso: string) => formatDate(iso, 'd MMM yyyy, HH:mm');

function Details({
  transaction: t,
  currency,
  canEdit,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  currency: string;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="px-6 pt-6 pb-8">
      <div className="flex items-center gap-3.5">
        <TypeIcon type={t.type} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium text-ink">{t.description}</p>
          <p className="truncate text-[13px] text-muted">{t.category}</p>
        </div>
      </div>
      <p className="mt-6 text-[32px] leading-none font-semibold tracking-[-0.03em]">
        <Amount cents={t.amountCents} type={entryType(t.type)} currency={currency} />
      </p>
      {t.importSource && (
        <div className="mt-3">
          <Badge tone="neutral">{sourceLabel(t.importSource)}</Badge>
        </div>
      )}

      <dl className="mt-8">
        <Row label="Date">{formatDate(t.date, 'EEEE, d MMMM yyyy')}</Row>
        <Row label="Type">{typeLabel(t.type)}</Row>
        <Row label="Category">{t.category}</Row>
        <Row label="Source">{sourceLabel(t.importSource)}</Row>
        {t.externalId && (
          <Row label="External ID">
            <span className="font-mono text-[12px] text-ink-2">{t.externalId}</span>
          </Row>
        )}
        <Row label="Recorded">{timestamp(t.createdAt)}</Row>
        {t.updatedAt !== t.createdAt && <Row label="Last changed">{timestamp(t.updatedAt)}</Row>}
      </dl>

      {canEdit ? (
        <div className="mt-8 flex gap-2">
          <Button onClick={onEdit}>
            <Pencil />
            Edit
          </Button>
          <Button variant="ghost" className="text-negative hover:text-negative" onClick={onDelete}>
            <Trash2 />
            Delete
          </Button>
        </div>
      ) : (
        <p className="mt-8 rounded-control bg-sunken px-4 py-3 text-[12px] leading-relaxed text-muted">
          You have view-only access. Only the business owner can change or delete transactions.
        </p>
      )}
    </div>
  );
}

/**
 * The side sheet for one transaction: its details, the edit form, or the
 * form for a new one. Changes go through the API, which refuses them for
 * anyone but the owner whatever this sheet shows.
 */
export function TransactionSheet({
  state,
  onStateChange,
  businessId,
  currency,
  canEdit,
  categories,
}: {
  state: SheetState;
  onStateChange: (state: SheetState) => void;
  businessId: string;
  currency: string;
  canEdit: boolean;
  categories: string[];
}) {
  const remove = useDeleteTransaction(businessId);
  const [confirming, setConfirming] = useState(false);
  const close = () => onStateChange(null);

  const title =
    state?.mode === 'create'
      ? 'New transaction'
      : state?.mode === 'edit'
        ? 'Edit transaction'
        : 'Transaction details';

  async function confirmDelete(transaction: Transaction) {
    try {
      await remove.mutateAsync(transaction.id);
      setConfirming(false);
      close();
      showToast({ tone: 'neutral', title: 'Transaction deleted', body: transaction.description });
    } catch {
      // The dialog shows the error and stays open for another try.
    }
  }

  return (
    <>
      <Sheet
        open={state !== null}
        onOpenChange={(open) => !open && close()}
        title={title}
        description={
          state?.mode === 'create'
            ? `Record money coming in or going out, in ${currency}.`
            : undefined
        }
      >
        {state?.mode === 'view' && (
          <Details
            transaction={state.transaction}
            currency={currency}
            canEdit={canEdit}
            onEdit={() => onStateChange({ mode: 'edit', transaction: state.transaction })}
            onDelete={() => {
              remove.reset();
              setConfirming(true);
            }}
          />
        )}
        {(state?.mode === 'edit' || state?.mode === 'create') && canEdit && (
          <div className="px-6 pt-6 pb-8">
            <TransactionForm
              // A fresh form for each transaction.
              key={state.mode === 'edit' ? state.transaction.id : 'new'}
              businessId={businessId}
              currency={currency}
              transaction={state.mode === 'edit' ? state.transaction : null}
              categories={categories}
              onDone={(saved) =>
                state.mode === 'edit'
                  ? onStateChange({ mode: 'view', transaction: saved })
                  : close()
              }
              onCancel={() =>
                state.mode === 'edit'
                  ? onStateChange({ mode: 'view', transaction: state.transaction })
                  : close()
              }
            />
          </div>
        )}
      </Sheet>

      {state?.mode === 'view' && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title="Delete this transaction?"
          description={
            <>
              <span className="text-ink-2">{state.transaction.description}</span> (
              {money(state.transaction.amountCents, { currency })},{' '}
              {formatDate(state.transaction.date, 'd MMM yyyy')}) will be removed from your history.
              This cannot be undone.
            </>
          }
          confirmLabel="Delete transaction"
          busyLabel="Deleting…"
          busy={remove.isPending}
          error={
            remove.isError
              ? errorMessage(remove.error, 'The transaction could not be deleted. Try again.')
              : null
          }
          onConfirm={() => void confirmDelete(state.transaction)}
        />
      )}
    </>
  );
}
