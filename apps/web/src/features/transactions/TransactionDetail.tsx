import type { ReactNode } from 'react';
import { accounts, categories } from '../../api/finance';
import { Amount } from '../../components/finance/Amount';
import { CategoryIcon } from '../../components/finance/CategoryIcon';
import { Badge } from '../../components/ui/Badge';
import { Sheet } from '../../components/ui/Sheet';
import type { Transaction } from '../../demo/types';
import { formatDate } from '../../lib/format';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-t border-line-soft py-3.5 text-[13px]">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-ink">{children}</dd>
    </div>
  );
}

export function TransactionDetail({
  transaction,
  onClose,
}: {
  transaction: Transaction | null;
  onClose: () => void;
}) {
  const t = transaction;
  const category = categories.find((c) => c.id === t?.categoryId);
  const account = accounts.find((a) => a.id === t?.accountId);

  return (
    <Sheet
      open={t !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Transaction details"
    >
      {t && (
        <div className="px-6 pt-6 pb-8">
          <div className="flex items-center gap-3.5">
            <CategoryIcon categoryId={t.categoryId} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-ink">{t.description}</p>
              <p className="truncate text-[13px] text-muted">{t.counterparty}</p>
            </div>
          </div>
          <p className="mt-6 text-[32px] leading-none font-semibold tracking-[-0.03em]">
            <Amount cents={t.amountCents} type={t.type} />
          </p>
          <div className="mt-3">
            {t.status === 'pending' ? (
              <Badge tone="warning" dot>
                Pending — settles within 2 business days
              </Badge>
            ) : (
              <Badge tone="positive" dot>
                Cleared
              </Badge>
            )}
          </div>

          <dl className="mt-8">
            <Row label="Date">{formatDate(t.date, 'EEEE, d MMMM yyyy')}</Row>
            <Row label="Type">{t.type === 'income' ? 'Income' : 'Expense'}</Row>
            <Row label="Category">{category?.name}</Row>
            <Row label="Account">
              {account?.name} <span className="text-muted">{account?.detail}</span>
            </Row>
            <Row label="Counterparty">{t.counterparty}</Row>
            {t.reference && <Row label="Reference">{t.reference}</Row>}
            <Row label="Transaction ID">
              <span className="font-mono text-[12px] text-ink-2">{t.id}</span>
            </Row>
          </dl>

          <p className="mt-8 rounded-control bg-sunken px-4 py-3 text-[12px] leading-relaxed text-muted">
            Editing, recategorising and deleting transactions arrive with the transactions API.
          </p>
        </div>
      )}
    </Sheet>
  );
}
