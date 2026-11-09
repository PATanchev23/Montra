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
import { formatDate } from '../../lib/format';
import { showToast } from '../../stores/toasts';
import { FormNotice } from '../auth/AuthFields';
import { sourceLabels } from '../transactions/display';
import { isPending, plural, requirementMessages, statusLabels } from './labels';
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
        {value.toLocaleString('en')}
      </p>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="px-6 pb-3 text-[14px] font-semibold text-ink">{children}</h3>;
}

function FileLine({ detail }: { detail: ImportDetail }) {
  const { batch } = detail;
  const status = statusLabels[batch.status];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-6 pt-5">
      <Badge tone={status.tone} dot>
        {status.label}
      </Badge>
      <span className="text-[12px] text-muted">
        {sourceLabels[batch.source]} · {batch.fileFormat} · uploaded{' '}
        {formatDate(batch.createdAt, 'd MMM yyyy, HH:mm')}
        {batch.expiresAt && (
          <> · kept for review until {formatDate(batch.expiresAt, 'd MMM, HH:mm')}</>
        )}
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
        title: `Imported ${plural(result.batch.importedRecords, 'transaction')}`,
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
      showToast({ tone: 'neutral', title: 'Import cancelled', body: 'Nothing was imported.' });
      onClose();
    } catch {
      // The dialog shows the error.
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <FileLine detail={detail} />

      <div className="flex flex-col gap-2.5 px-6 pt-4">
        {detail.previousImportId && (
          <FormNotice tone="warning">
            This exact file was imported before. Records it already brought in show as duplicates
            and will be skipped.
          </FormNotice>
        )}
        {detail.missing.length > 0 && (
          <FormNotice tone="warning">
            <p className="font-medium">Map the columns to see a preview.</p>
            <ul className="mt-1 list-disc pl-4">
              {detail.missing.map((requirement) => (
                <li key={requirement}>{requirementMessages[requirement]}</li>
              ))}
            </ul>
          </FormNotice>
        )}
        {detail.notices.length > 0 && (
          <FormNotice tone="neutral">
            <ul className="flex flex-col gap-0.5">
              {detail.notices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          </FormNotice>
        )}
      </div>

      <section aria-labelledby={`${importId}-columns`} className="mt-6">
        <div className="flex items-center justify-between gap-3 px-6 pb-1">
          <h3 id={`${importId}-columns`} className="text-[14px] font-semibold text-ink">
            Columns
          </h3>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={mappingOpen}
            onClick={() => setMappingOpen((open) => !open)}
          >
            {mappingOpen ? 'Hide' : canEdit ? 'Review mapping' : 'Show mapping'}
            <ChevronDown className={cn('transition-transform', mappingOpen && 'rotate-180')} />
          </Button>
        </div>
        {!mappingOpen ? (
          <p className="px-6 text-[12px] text-muted">
            {isTemplate ? 'Read as the Montra template.' : 'Columns matched by their headers.'}
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
                  <p className="mr-auto text-[12px] text-muted">
                    Update the preview to see the effect.
                  </p>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!dirty || busy}
                  onClick={() => setDraft(draftFrom(detail.mapping))}
                >
                  Undo changes
                </Button>
                <Button
                  size="sm"
                  disabled={!dirty || Boolean(problem) || busy}
                  onClick={() => void applyMapping()}
                >
                  {updateMapping.isPending ? 'Updating…' : 'Update preview'}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      {preview && (
        <section aria-label="Preview" className={cn('mt-7', dirty && 'opacity-60')}>
          <SectionTitle>Preview</SectionTitle>
          <div className="mx-6 mb-4 grid grid-cols-3 divide-x divide-line rounded-control border border-line bg-sunken">
            <Stat label="To import" value={toImport} tone="positive" />
            <Stat label="To skip" value={skipped} tone="muted" />
            <Stat
              label="Invalid"
              value={preview.summary.invalid}
              tone={preview.summary.invalid ? 'negative' : 'muted'}
            />
          </div>
          {preview.summary.possibleDuplicates > 0 && (
            <p className="flex items-start gap-2 px-6 pb-3 text-[12px] text-muted">
              <Info className="mt-px size-3.5 shrink-0" strokeWidth={2} />
              Possible duplicates match an existing transaction’s date, type, amount and
              description. They are skipped unless {canEdit ? 'you tick' : 'the owner ticks'} them.
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
            <FormNotice tone="negative">
              {errorMessage(actionError, 'The import could not be updated. Try again.')}
            </FormNotice>
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
              Cancel import
            </Button>
            <div className="flex items-center gap-3">
              {preview && toImport === 0 && (
                <span className="text-[12px] text-muted">No records to import.</span>
              )}
              <Button
                variant="primary"
                disabled={
                  busy || dirty || detail.batch.status !== 'READY' || !preview || toImport === 0
                }
                onClick={() => void confirmImport()}
              >
                {confirm.isPending ? 'Importing…' : `Import ${plural(toImport, 'transaction')}`}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-muted">
            View only. The business owner reviews and confirms imports.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmingCancel}
        onOpenChange={setConfirmingCancel}
        title="Cancel this import?"
        description="The uploaded data is discarded and nothing is imported. You can upload the file again later."
        confirmLabel="Cancel import"
        cancelLabel="Keep reviewing"
        busyLabel="Cancelling…"
        busy={cancel.isPending}
        error={
          cancel.isError ? errorMessage(cancel.error, 'The import could not be cancelled.') : null
        }
        onConfirm={() => void cancelImport()}
      />
    </div>
  );
}

/** What became of a finished, cancelled or expired import. */
function ResultView({ detail, onClose }: { detail: ImportDetail; onClose: () => void }) {
  const { batch } = detail;
  const finished = batch.status === 'COMPLETED' || batch.status === 'FAILED';
  return (
    <div className="flex flex-col gap-5 pb-8">
      <FileLine detail={detail} />
      {finished ? (
        <>
          <div className="mx-6 grid grid-cols-3 divide-x divide-line rounded-control border border-line bg-sunken">
            <Stat label="Imported" value={batch.importedRecords} tone="positive" />
            <Stat label="Skipped" value={batch.skippedRecords} tone="muted" />
            <Stat
              label="Invalid"
              value={batch.failedRecords}
              tone={batch.failedRecords ? 'negative' : 'muted'}
            />
          </div>
          <p className="px-6 text-[13px] leading-relaxed text-ink-2">
            {batch.status === 'FAILED'
              ? 'No record could be imported: every record in the file was invalid. Correct the file and upload it again.'
              : `${plural(batch.importedRecords, 'transaction')} added to your history${
                  batch.completedAt
                    ? ` on ${formatDate(batch.completedAt, 'd MMM yyyy, HH:mm')}`
                    : ''
                }.`}
            {batch.skippedRecords > 0 &&
              ` ${plural(batch.skippedRecords, 'record')} matched transactions already recorded and ${
                batch.skippedRecords === 1 ? 'was' : 'were'
              } skipped.`}
            {batch.status === 'COMPLETED' &&
              batch.failedRecords > 0 &&
              ` ${plural(batch.failedRecords, 'invalid record')} ${batch.failedRecords === 1 ? 'was' : 'were'} left out.`}
          </p>
        </>
      ) : (
        <p className="px-6 text-[13px] leading-relaxed text-ink-2">
          {batch.status === 'EXPIRED'
            ? 'This import was not confirmed within 24 hours, so its data was discarded. Nothing was imported.'
            : 'This import was cancelled before confirmation. Nothing was imported.'}
        </p>
      )}
      <div className="flex justify-end px-6">
        <Button variant="primary" onClick={onClose}>
          Done
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

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={importId && data ? data.batch.fileName : 'Import transactions'}
      description={
        importId
          ? data && isPending(data.batch.status)
            ? 'Check how the file is read. Nothing is saved until the import is confirmed.'
            : undefined
          : 'Bring in transactions from a spreadsheet or bank statement.'
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
        <ErrorState title="Could not load this import" onRetry={() => detail.refetch()} />
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
