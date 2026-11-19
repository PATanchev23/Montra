import type { ImportBatch } from '@montra/shared';
import { FileSpreadsheet, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../../api/client';
import { useImportList, useRemoveImport } from '../../api/imports';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { IconButton } from '../../components/ui/IconButton';
import { showToast } from '../../stores/toasts';
import { Panel, PanelHeader } from '../../components/ui/Panel';
import { ErrorState } from '../../components/ui/States';
import { formatDate } from '../../lib/format';
import { sourceName } from '../transactions/display';
import { useMessages } from '../../i18n';
import { isPending, outcomeLine, statusLabel } from './labels';
import { importMessages } from './messages';

const COLLAPSED = 4;

function ImportRow({
  batch,
  canEdit,
  onOpen,
  onRemove,
}: {
  batch: ImportBatch;
  canEdit: boolean;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const status = statusLabel(batch.status);
  const pending = isPending(batch.status);
  const m = useMessages(importMessages).history;
  return (
    <li className="flex items-center gap-3 border-t border-line-soft px-5 py-3 sm:px-6">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-hover text-ink-2">
        <FileSpreadsheet className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[14px] text-ink">{batch.fileName}</p>
        <p className="mt-1 truncate text-[12px] text-muted">
          {sourceName(batch.source)} · {formatDate(batch.createdAt, 'd MMM yyyy')} ·{' '}
          {outcomeLine(batch)}
        </p>
      </div>
      <Badge tone={status.tone} dot className="hidden sm:inline-flex">
        {status.label}
      </Badge>
      <Button size="sm" variant={pending && canEdit ? 'primary' : 'secondary'} onClick={onOpen}>
        {pending && canEdit ? m.review : m.view}
        <span className="sr-only"> {batch.fileName}</span>
      </Button>
      {canEdit && (
        <IconButton label={m.remove(batch.fileName)} size="sm" onClick={onRemove}>
          <Trash2 />
        </IconButton>
      )}
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
  const remove = useRemoveImport(businessId);
  const [expanded, setExpanded] = useState(false);
  const [removing, setRemoving] = useState<ImportBatch | null>(null);
  const m = useMessages(importMessages).history;

  function confirmRemove() {
    if (!removing) return;
    const { id, fileName } = removing;
    remove.mutate(id, {
      onSuccess: ({ removedTransactions }) => {
        showToast({ tone: 'positive', title: m.removed(fileName, removedTransactions) });
        setRemoving(null);
      },
    });
  }

  if (imports.isPending) return null;
  if (imports.isError) {
    return (
      <Panel>
        <ErrorState title={m.loadError} onRetry={() => imports.refetch()} />
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
        title={m.title}
        description={pendingCount > 0 ? m.waiting(pendingCount, canEdit) : m.intro}
        className="px-5 py-4 sm:px-6"
      />
      <ul>
        {shown.map((batch) => (
          <ImportRow
            key={batch.id}
            batch={batch}
            canEdit={canEdit}
            onOpen={() => onOpen(batch.id)}
            onRemove={() => {
              remove.reset();
              setRemoving(batch);
            }}
          />
        ))}
      </ul>
      {items.length > COLLAPSED && (
        <div className="border-t border-line-soft px-5 py-2.5 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((open) => !open)}>
            {expanded ? m.showFewer : m.showAll(items.length)}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={m.removeTitle}
        description={removing ? m.removeBody(removing.fileName, removing.importedRecords) : ''}
        confirmLabel={m.removeConfirm}
        busyLabel={m.removing}
        busy={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onConfirm={confirmRemove}
      />
    </Panel>
  );
}
