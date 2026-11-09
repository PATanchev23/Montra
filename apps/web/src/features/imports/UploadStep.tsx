import { IMPORT_ERROR_CODES, IMPORT_MAX_ROWS, type ImportDetail } from '@montra/shared';
import { Download, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { useId, useState, type DragEvent } from 'react';
import { ApiError, errorMessage } from '../../api/client';
import { templateUrl, useUploadImport } from '../../api/imports';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { FormNotice } from '../auth/AuthFields';
import { fileProblem, MAX_MB, sourceFor, type Kind } from './upload';

const fileSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function KindOption({
  name,
  value,
  checked,
  onChange,
  title,
  body,
}: {
  name: string;
  value: Kind;
  checked: boolean;
  onChange: (kind: Kind) => void;
  title: string;
  body: string;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded-control border p-3.5 transition-colors',
        checked ? 'border-accent-line bg-accent-soft/40' : 'border-line hover:border-line-strong',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-0.5 size-4 accent-[var(--accent)]"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-muted">{body}</span>
      </span>
    </label>
  );
}

/** Step 1: choose the kind of file and upload it for a preview. Nothing is imported yet. */
export function UploadStep({
  businessId,
  onUploaded,
  onCancel,
}: {
  businessId: string;
  onUploaded: (detail: ImportDetail) => void;
  onCancel: () => void;
}) {
  const upload = useUploadImport(businessId);
  const [kind, setKind] = useState<Kind>('generic');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const kindName = useId();
  const inputId = useId();

  function choose(next: File | undefined) {
    upload.reset();
    if (!next) return;
    setFile(next);
    setProblem(fileProblem(next));
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  async function submit() {
    if (!file || problem) return;
    try {
      onUploaded(await upload.mutateAsync({ file, source: sourceFor(kind, file.name) }));
    } catch {
      // Shown below from the mutation's error.
    }
  }

  const uploadError =
    upload.error &&
    errorMessage(
      upload.error,
      'The file could not be uploaded. Check your connection and try again.',
    );
  const notTemplate =
    upload.error instanceof ApiError && upload.error.code === IMPORT_ERROR_CODES.COLUMNS_MISSING;

  return (
    <div className="flex flex-col gap-6 px-6 pt-6 pb-8">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-medium text-ink-2">What are you importing?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <KindOption
            name={kindName}
            value="generic"
            checked={kind === 'generic'}
            onChange={setKind}
            title="A CSV or Excel file"
            body="A bank statement or any spreadsheet. You check how its columns are read."
          />
          <KindOption
            name={kindName}
            value="template"
            checked={kind === 'template'}
            onChange={setKind}
            title="The Montra template"
            body="Columns are already in Montra’s format."
          />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
          <span>Download the template:</span>
          <a
            className="inline-flex items-center gap-1 text-accent hover:underline"
            href={templateUrl('xlsx')}
            download
          >
            <Download className="size-3.5" strokeWidth={2} />
            Excel (.xlsx)
          </a>
          <a
            className="inline-flex items-center gap-1 text-accent hover:underline"
            href={templateUrl('csv')}
            download
          >
            <Download className="size-3.5" strokeWidth={2} />
            CSV
          </a>
        </p>
      </fieldset>

      <div>
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center rounded-panel border border-dashed px-6 py-8 text-center transition-colors',
            dragging
              ? 'border-accent bg-accent-soft/40'
              : 'border-line-strong bg-sunken hover:border-accent-line',
          )}
        >
          {file ? (
            <>
              <FileSpreadsheet className="size-6 text-accent" strokeWidth={1.6} />
              <span className="mt-3 max-w-full truncate text-[14px] font-medium text-ink">
                {file.name}
              </span>
              <span className="mt-0.5 text-[12px] text-muted">
                {fileSize(file.size)} · Choose another file
              </span>
            </>
          ) : (
            <>
              <UploadCloud className="size-6 text-muted" strokeWidth={1.6} />
              <span className="mt-3 text-[14px] font-medium text-ink">
                Choose a file or drop it here
              </span>
              <span className="mt-0.5 text-[12px] text-muted">
                .csv or .xlsx · up to {MAX_MB} MB and {IMPORT_MAX_ROWS.toLocaleString('en')} rows
              </span>
            </>
          )}
        </label>
        <input
          id={inputId}
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="File to import"
          className="sr-only"
          onChange={(e) => {
            choose(e.target.files?.[0]);
            // Choosing the same file again still counts as a choice.
            e.target.value = '';
          }}
        />
      </div>

      {problem && <FormNotice tone="negative">{problem}</FormNotice>}
      {uploadError && (
        <FormNotice tone="negative">
          {uploadError}
          {notTemplate && kind === 'template' && (
            <span className="mt-1 block text-ink-2">
              To import it anyway, choose “A CSV or Excel file” and map its columns.
            </span>
          )}
        </FormNotice>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-5">
        <p className="text-[12px] text-muted">Nothing is imported until you review and confirm.</p>
        <div className="flex gap-2">
          <Button onClick={onCancel} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!file || Boolean(problem) || upload.isPending}
            onClick={() => void submit()}
          >
            {upload.isPending ? 'Uploading…' : 'Upload and preview'}
          </Button>
        </div>
      </div>
    </div>
  );
}
