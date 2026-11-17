import type { ImportDetail } from '@montra/shared';
import { ChevronDown, Info } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../../api/client';
import {
  useCancelImport,
  useConfirmImport,
  useImportDetail,
  useUpdateImportMapping,
} from '../../api/imports';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Sheet } from '../../components/ui/Sheet';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { cn } from '../../lib/cn';
import { useMessages } from '../../i18n';
import { localizeMessage } from '../../i18n/serverMessages';
import { count, formatDate } from '../../lib/format';
import { showToast } from '../../stores/toasts';
import { FormNotice } from '../auth/AuthFields';
import { sourceName } from '../transactions/display';
import { isPending, records, requirementMessage, statusLabel, transactions } from './labels';
import { importMessages } from './messages';
import { draftFrom, draftProblem, isDirty, mappingFrom } from './mapping';
import { MappingEditor } from './MappingEditor';
import { PreviewEntries } from './PreviewEntries';
import { UploadStep } from './UploadStep';

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'positive' | 'negative' | 'muted';
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p
        className={cn(
          'tabular mt-0.5 text-[20px] font-semibold tracking-[-0.02em]',
          tone === 'positive'
            ? 'text-positive'
            : tone === 'negative'
              ? 'text-negative'
              : 'text-ink',
        )}
      >
        {count(value)}
      </p>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="px-6 pb-3 text-[14px] font-semibold text-ink">{children}</h3>;
}

function FileLine({ detail }: { detail: ImportDetail }) {
  const { batch } = detail;
  const status = statusLabel(batch.status);
  const m = useMessages(importMessages).sheet;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-6 pt-5">
      <Badge tone={status.tone} dot>
        {status.label}
      </Badge>
      <span className="text-[12px] text-muted">
        {sourceName(batch.source)} · {batch.fileFormat} · {m.uploaded}{' '}
        {formatDate(batch.createdAt, 'd MMM yyyy, HH:mm')}
        {batch.expiresAt && <> · {m.keptUntil(formatDate(batch.expiresAt, 'd MMM, HH:mm'))}</>}
      </span>
    </div>
  );
}

/** Review an unconfirmed import: check the mapping, read the preview, then confirm or cancel. */
function ReviewStep({
  detail,
  businessId,
  currency,
  canEdit,
  onClose,
}: {
  detail: ImportDetail;
  businessId: string;
  currency: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const importId = detail.batch.id;
  const updateMapping = useUpdateImportMapping(businessId);
  const confirm = useConfirmImport(businessId);
  const cancel = useCancelImport(businessId);
  const m = useMessages(importMessages).sheet;

  // The draft follows the API's mapping whenever that changes (adjusted during render).
  const savedKey = JSON.stringify(detail.mapping);
  const [syncedKey, setSyncedKey] = useState(savedKey);
  const [draft, setDraft] = useState(() => draftFrom(detail.mapping));
  const [included, setIncluded] = useState<ReadonlySet<number>>(new Set());
  if (savedKey !== syncedKey) {
    setSyncedKey(savedKey);
    setDraft(draftFrom(detail.mapping));
    // Entry indexes belong to one mapping's preview.
    setIncluded(new Set());
  }

  const isTemplate = detail.batch.source === 'MONTRA_TEMPLATE';
  const [mappingOpen, setMappingOpen] = useState(!isTemplate || detail.missing.length > 0);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const dirty = isDirty(draft, detail.mapping);
  const problem = draftProblem(draft);
  const preview = detail.preview;
  const toImport = preview ? preview.summary.valid + included.size : 0;
  const skipped = preview
    ? preview.summary.duplicates + preview.summary.possibleDuplicates - included.size
    : 0;

  const busy = updateMapping.isPending || confirm.isPending || cancel.isPending;
  const actionError = [updateMapping, confirm].find((m) => m.isError)?.error;

  async function applyMapping() {
    confirm.reset();
    try {
      await updateMapping.mutateAsync({ importId, mapping: mappingFrom(draft) });
    } catch {
      // Shown from the mutation's error.
    }
  }

  async function confirmImport() {
    updateMapping.reset();
    try {
      const result = await confirm.mutateAsync({
        importId,
        includePossibleDuplicates: [...included],
      });
      showToast({
        tone: 'positive',
        title: m.importedToast(transactions(result.batch.importedRecords)),
        body: result.batch.fileName,
      });
    } catch {
      // Shown from the mutation's error. An import that finished or expired
      // meanwhile is reloaded (see api/imports.ts) and shown as it is now.
    }
  }

  async function cancelImport() {
    try {
      await cancel.mutateAsync(importId);
      setConfirmingCancel(false);
      showToast({ tone: 'neutral', title: m.cancelled, body: m.nothingImported });
      onClose();
    } catch {
      // The dialog shows the error.
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <FileLine detail={detail} />

      <div className="flex flex-col gap-2.5 px-6 pt-4">
        {detail.previousImportId && <FormNotice tone="warning">{m.seenBefore}</FormNotice>}
        {detail.missing.length > 0 && (
          <FormNotice tone="warning">
            <p className="font-medium">{m.mapToPreview}</p>
            <ul className="mt-1 list-disc pl-4">
              {detail.missing.map((requirement) => (
                <li key={requirement}>{requirementMessage(requirement)}</li>
              ))}
            </ul>
          </FormNotice>
        )}
        {detail.notices.length > 0 && (
          <FormNotice tone="neutral">
            <ul className="flex flex-col gap-0.5">
              {detail.notices.map((notice) => (
                <li key={notice}>{localizeMessage(notice)}</li>
              ))}
            </ul>
          </FormNotice>
        )}
      </div>

      <section aria-labelledby={`${importId}-columns`} className="mt-6">
        <div className="flex items-center justify-between gap-3 px-6 pb-1">
          <h3 id={`${importId}-columns`} className="text-[14px] font-semibold text-ink">
            {m.columns}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={mappingOpen}
            onClick={() => setMappingOpen((open) => !open)}
          >
            {mappingOpen ? m.hide : canEdit ? m.reviewMapping : m.showMapping}
            <ChevronDown className={cn('transition-transform', mappingOpen && 'rotate-180')} />
          </Button>
        </div>
        {!mappingOpen ? (
          <p className="px-6 text-[12px] text-muted">
            {isTemplate ? m.readAsTemplate : m.matchedByHeaders}
          </p>
        ) : (
          <div className="px-6">
            <MappingEditor
              columns={detail.columns}
              sampleRows={detail.sampleRows}
              draft={draft}
              onChange={setDraft}
              missing={dirty ? [] : detail.missing}
              typeRequired={isTemplate}
              readOnly={!canEdit || busy}
            />
            {canEdit && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft pt-3">
                {problem && <p className="mr-auto text-[12px] text-negative">{problem}</p>}
                {dirty && !problem && (
                  <p className="mr-auto text-[12px] text-muted">{m.updateToSee}</p>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!dirty || busy}
                  onClick={() => setDraft(draftFrom(detail.mapping))}
                >
                  {m.undo}
                </Button>
                <Button
                  size="sm"
                  disabled={!dirty || Boolean(problem) || busy}
                  onClick={() => void applyMapping()}
                >
                  {updateMapping.isPending ? m.updating : m.update}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {preview && (
        <section aria-label={m.preview} className={cn('mt-7', dirty && 'opacity-60')}>
          <SectionTitle>{m.preview}</SectionTitle>
          <div className="mx-6 mb-4 grid grid-cols-3 divide-x divide-line rounded-control border border-line bg-sunken">
            <Stat label={m.toImport} value={toImport} tone="positive" />
            <Stat label={m.toSkip} value={skipped} tone="muted" />
            <Stat
              label={m.invalid}
              value={preview.summary.invalid}
              tone={preview.summary.invalid ? 'negative' : 'muted'}
            />
          </div>
          {preview.summary.possibleDuplicates > 0 && (
            <p className="flex items-start gap-2 px-6 pb-3 text-[12px] text-muted">
              <Info className="mt-px size-3.5 shrink-0" strokeWidth={2} />
              {m.possibleDuplicates(canEdit)}
            </p>
          )}
          <PreviewEntries
            // A fresh view (filter, page) for each preview.
            key={savedKey}
            entries={preview.entries}
            summary={preview.summary}
            currency={currency}
            included={included}
            canInclude={canEdit}
            onToggleIncluded={(index, on) =>
              setIncluded((current) => {
                const next = new Set(current);
                if (on) next.add(index);
                else next.delete(index);
                return next;
              })
            }
          />
        </section>
      )}

      <div className="sticky bottom-0 mt-auto border-t border-line bg-surface px-6 py-4">
        {actionError && (
          <div className="mb-3">
            <FormNotice tone="negative">{errorMessage(actionError, m.updateFailed)}</FormNotice>
          </div>
        )}
        {canEdit ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="ghost"
              className="text-negative hover:text-negative"
              disabled={busy}
              onClick={() => {
                cancel.reset();
                setConfirmingCancel(true);
              }}
            >
              {m.cancelImport}
            </Button>
            <div className="flex items-center gap-3">
              {preview && toImport === 0 && (
                <span className="text-[12px] text-muted">{m.noRecords}</span>
              )}
              <Button
                variant="primary"
                disabled={
                  busy || dirty || detail.batch.status !== 'READY' || !preview || toImport === 0
                }
                onClick={() => void confirmImport()}
              >
                {confirm.isPending ? m.importing : m.importN(transactions(toImport))}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-muted">{m.viewOnly}</p>
        )}
      </div>

      <ConfirmDialog
        open={confirmingCancel}
        onOpenChange={setConfirmingCancel}
        title={m.cancelTitle}
        description={m.cancelBody}
        confirmLabel={m.cancelImport}
        cancelLabel={m.keepReviewing}
        busyLabel={m.cancelling}
        busy={cancel.isPending}
        error={cancel.isError ? errorMessage(cancel.error, m.cancelFailed) : null}
        onConfirm={() => void cancelImport()}
      />
    </div>
  );
}

/** What became of a finished, cancelled or expired import. */
function ResultView({ detail, onClose }: { detail: ImportDetail; onClose: () => void }) {
  const { batch } = detail;
  const finished = batch.status === 'COMPLETED' || batch.status === 'FAILED';
  const m = useMessages(importMessages).sheet;
  return (
    <div className="flex flex-col gap-5 pb-8">
      <FileLine detail={detail} />
      {finished ? (
        <>
          <div className="mx-6 grid grid-cols-3 divide-x divide-line rounded-control border border-line bg-sunken">
            <Stat label={m.imported} value={batch.importedRecords} tone="positive" />
            <Stat label={m.skipped} value={batch.skippedRecords} tone="muted" />
            <Stat
              label={m.invalid}
              value={batch.failedRecords}
              tone={batch.failedRecords ? 'negative' : 'muted'}
            />
          </div>
          <p className="px-6 text-[13px] leading-relaxed text-ink-2">
            {batch.status === 'FAILED'
              ? m.allInvalid
              : m.added(
                  transactions(batch.importedRecords),
                  batch.importedRecords,
                  batch.completedAt ? formatDate(batch.completedAt, 'd MMM yyyy, HH:mm') : null,
                )}
            {batch.skippedRecords > 0 &&
              m.skippedLine(records(batch.skippedRecords), batch.skippedRecords)}
            {batch.status === 'COMPLETED' &&
              batch.failedRecords > 0 &&
              m.invalidLine(count(batch.failedRecords), batch.failedRecords)}
          </p>
        </>
      ) : (
        <p className="px-6 text-[13px] leading-relaxed text-ink-2">
          {batch.status === 'EXPIRED' ? m.expired : m.cancelledBefore}
        </p>
      )}
      <div className="flex justify-end px-6">
        <Button variant="primary" onClick={onClose}>
          {m.done}
        </Button>
      </div>
    </div>
  );
}

function DetailLoading() {
  return (
    <div aria-hidden className="flex flex-col gap-3 px-6 pt-6">
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/**
 * The import workflow in a side sheet: upload (owners only), then review an
 * import by id. Opening an existing import shows it as it stands now.
 */
export function ImportSheet({
  open,
  importId,
  onImportIdChange,
  onClose,
  businessId,
  currency,
  canEdit,
}: {
  open: boolean;
  /** Null to start with an upload. */
  importId: string | null;
  onImportIdChange: (importId: string) => void;
  onClose: () => void;
  businessId: string;
  currency: string;
  canEdit: boolean;
}) {
  const detail = useImportDetail(businessId, open ? importId : null);
  const data = detail.data;
  const m = useMessages(importMessages).sheet;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={importId && data ? data.batch.fileName : m.title}
      description={
        importId ? (data && isPending(data.batch.status) ? m.reviewHint : undefined) : m.uploadHint
      }
      className="max-w-3xl"
    >
      {importId === null ? (
        canEdit && (
          <UploadStep
            businessId={businessId}
            onUploaded={(uploaded) => onImportIdChange(uploaded.batch.id)}
            onCancel={onClose}
          />
        )
      ) : detail.isError ? (
        <ErrorState title={m.loadError} onRetry={() => detail.refetch()} />
      ) : !data ? (
        <DetailLoading />
      ) : isPending(data.batch.status) ? (
        <ReviewStep
          key={data.batch.id}
          detail={data}
          businessId={businessId}
          currency={currency}
          canEdit={canEdit}
          onClose={onClose}
        />
      ) : (
        <ResultView detail={data} onClose={onClose} />
      )}
    </Sheet>
  );
}
