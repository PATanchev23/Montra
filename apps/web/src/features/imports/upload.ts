import { IMPORT_FILE_EXTENSIONS, IMPORT_MAX_FILE_BYTES, type ImportSource } from '@montra/shared';

import { messagesFor } from '../../i18n';
import { importMessages } from './messages';
export type Kind = 'template' | 'generic';

export const MAX_MB = IMPORT_MAX_FILE_BYTES / 1024 / 1024;

/** The source the API expects for a file: the template, or a generic CSV or workbook. */
export function sourceFor(kind: Kind, fileName: string): ImportSource {
  if (kind === 'template') return 'MONTRA_TEMPLATE';
  return fileName.toLowerCase().endsWith('.xlsx') ? 'GENERIC_EXCEL' : 'GENERIC_CSV';
}

/** Problems the browser can spot before uploading; the API checks everything again. */
export function fileProblem(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!IMPORT_FILE_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return messagesFor(importMessages).upload.wrongType;
  }
  if (file.size === 0) return messagesFor(importMessages).upload.empty;
  if (file.size > IMPORT_MAX_FILE_BYTES) return messagesFor(importMessages).upload.tooLarge(MAX_MB);
  return null;
}
