import type { ImportBatch } from '@montra/shared';
import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { useImportList } from '../../api/imports';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { ErrorState } from '../../components/ui/States';
import { formatDate } from '../../lib/format';
import { sourceLabels } from '../transactions/display';
import { isPending, outcomeLine, statusLabels } from './labels';

const COLLAPSED = 4;

function ImportRow({
  batch,
  canEdit,
  onOpen,
}: {
  batch: ImportBatch;
  canEdit: boolean;
  onOpen: () => void;
}) {
  const status = statusLabels[batch.status];
  const pending = isPending(batch.status);
  return (
    <li className="flex items-center gap-3 border-t border-line-soft px-5 py-3 sm:px-6">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-hover text-ink-2">
        <FileSpreadsheet className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[14px] text-ink">{batch.fileName}</p>
        <p className="mt-1 truncate text-[12px] text-muted">
          {sourceLabels[batch.source]} · {formatDate(batch.createdAt, 'd MMM yyyy')} ·{' '}
          {outcomeLine(batch)}
        </p>
      </div>
      <Badge tone={status.tone} dot className="hidden sm:inline-flex">
        {status.label}
      </Badge>
      <Button size="sm" variant={pending && canEdit ? 'primary' : 'secondary'} onClick={onOpen}>
        {pending && canEdit ? 'Review' : 'View'}
        <span className="sr-only"> {batch.fileName}</span>
      </Button>
    </li>
  );
}

/** Recent uploads and what became of them. Pending ones can be picked up again. */
export function ImportHistory({
  businessId,
  canEdit,
  onOpen,
}: {
  businessId: string;
  canEdit: boolean;
  onOpen: (importId: string) => void;
}) {
  const imports = useImportList(businessId);
  const [expanded, setExpanded] = useState(false);

  if (imports.isPending) return null;
  if (imports.isError) {
    return (
      <Panel>
        <ErrorState title="Could not load imports" onRetry={() => imports.refetch()} />
      </Panel>
    );
  }
  const items = imports.data.items;
  if (items.length === 0) return null;

  const pendingCount = items.filter((batch) => isPending(batch.status)).length;
  const shown = expanded ? items : items.slice(0, COLLAPSED);

  return (
    <Panel aria-labelledby="imports-heading" className="overflow-hidden">
      <PanelHeader
        id="imports-heading"
        title="Imports"
        description={
          pendingCount > 0
            ? `${pendingCount} waiting for review. Nothing is saved until ${canEdit ? 'you confirm' : 'the owner confirms'}.`
            : 'Files brought in from spreadsheets and bank statements.'
        }
        className="px-5 py-4 sm:px-6"
      />
      <ul>
        {shown.map((batch) => (
          <ImportRow
            key={batch.id}
            batch={batch}
            canEdit={canEdit}
            onOpen={() => onOpen(batch.id)}
          />
        ))}
      </ul>
      {items.length > COLLAPSED && (
        <div className="border-t border-line-soft px-5 py-2.5 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((open) => !open)}>
            {expanded ? 'Show fewer' : `Show all ${items.length} imports`}
          </Button>
        </div>
      )}
    </Panel>
  );
}
