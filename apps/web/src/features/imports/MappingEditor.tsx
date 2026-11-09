import {
  IMPORT_FIELDS,
  TRANSACTION_CATEGORY_MAX_LENGTH,
  type DateFormat,
  type DecimalSeparator,
  type ImportField,
  type ImportRequirement,
} from '@montra/shared';
import { useId, type ReactNode } from 'react';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { cn } from '../../lib/cn';
import { dateFormatOptions, decimalOptions, fieldHint, fieldLabels } from './labels';
import { assignColumn, columnOptions, type MappingDraft } from './mapping';

const NONE = 'none';

function SettingRow({
  label,
  hint,
  required,
  missing,
  htmlFor,
  children,
}: {
  label: string;
  hint: string;
  required?: boolean;
  missing?: boolean;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid items-center gap-x-6 gap-y-2 border-t border-line-soft py-3 sm:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0">
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-2 text-[13px] font-medium text-ink"
        >
          {label}
          {required && (
            <span
              className={cn('text-[11px] font-normal', missing ? 'text-warning' : 'text-faint')}
            >
              {missing ? 'Required — not mapped' : 'Required'}
            </span>
          )}
        </label>
        <p className="mt-0.5 text-[12px] leading-snug text-muted">{hint}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Which column holds each transaction field, plus how dates and amounts are
 * written. Read-only for viewers.
 */
export function MappingEditor({
  columns,
  sampleRows,
  draft,
  onChange,
  missing,
  typeRequired,
  readOnly,
}: {
  columns: string[];
  sampleRows: string[][];
  draft: MappingDraft;
  onChange: (draft: MappingDraft) => void;
  missing: ImportRequirement[];
  /** The template needs a type column; generic files can use the amount's sign. */
  typeRequired: boolean;
  readOnly: boolean;
}) {
  const idBase = useId();
  const options = [
    { value: NONE, label: 'Not in this file' },
    ...columnOptions(columns, sampleRows),
  ];
  const requiredFields: ImportField[] = [
    'date',
    'description',
    'amount',
    ...(typeRequired ? ['type' as const] : []),
  ];

  return (
    <div>
      {IMPORT_FIELDS.map((field) => {
        const id = `${idBase}-${field}`;
        const index = draft.columns[field];
        return (
          <SettingRow
            key={field}
            label={fieldLabels[field]}
            hint={fieldHint(field, typeRequired)}
            required={requiredFields.includes(field)}
            missing={missing.includes(field)}
            htmlFor={id}
          >
            <Select
              id={id}
              label={`${fieldLabels[field]} column`}
              value={index === undefined ? NONE : String(index)}
              onChange={(value) =>
                onChange(assignColumn(draft, field, value === NONE ? undefined : Number(value)))
              }
              options={options}
              disabled={readOnly}
              className="w-full"
            />
          </SettingRow>
        );
      })}

      <SettingRow
        label="Dates are written"
        hint="Detected when the file’s dates can only be read one way."
        required={missing.includes('dateFormat')}
        missing={missing.includes('dateFormat')}
        htmlFor={`${idBase}-dateFormat`}
      >
        <Select<DateFormat | 'auto'>
          id={`${idBase}-dateFormat`}
          label="Date format"
          value={draft.dateFormat}
          onChange={(dateFormat) => onChange({ ...draft, dateFormat })}
          options={dateFormatOptions}
          disabled={readOnly}
          className="w-full"
        />
      </SettingRow>

      <SettingRow
        label="Decimal separator"
        hint="How amounts mark cents."
        htmlFor={`${idBase}-decimal`}
      >
        <Select<DecimalSeparator | 'auto'>
          id={`${idBase}-decimal`}
          label="Decimal separator"
          value={draft.decimalSeparator}
          onChange={(decimalSeparator) => onChange({ ...draft, decimalSeparator })}
          options={decimalOptions}
          disabled={readOnly}
          className="w-full"
        />
      </SettingRow>

      <SettingRow
        label="Default category"
        hint="Used for records without a category."
        htmlFor={`${idBase}-defaultCategory`}
        missing={missing.includes('category')}
      >
        <Input
          id={`${idBase}-defaultCategory`}
          value={draft.defaultCategory}
          placeholder="e.g. Uncategorised"
          maxLength={TRANSACTION_CATEGORY_MAX_LENGTH}
          onChange={(e) => onChange({ ...draft, defaultCategory: e.target.value })}
          disabled={readOnly}
          aria-invalid={missing.includes('category') ? true : undefined}
        />
      </SettingRow>
    </div>
  );
}
