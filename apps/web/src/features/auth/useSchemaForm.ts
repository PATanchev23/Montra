import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { z } from 'zod';

type FieldName<S extends z.ZodObject> = keyof z.input<S> & string;

/**
 * Form state validated by a shared Zod schema, so the browser applies exactly
 * the rules the API does. A field shows its error once it has been left or the
 * form submitted, and the error updates as the user types.
 */
export function useSchemaForm<S extends z.ZodObject>(
  schema: S,
  initialValues: Record<FieldName<S>, string>,
) {
  type Name = FieldName<S>;
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState<Partial<Record<Name, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const result = schema.safeParse(values);
  const allErrors: Partial<Record<Name, string>> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const name = issue.path[0] as Name;
      allErrors[name] ??= issue.message;
    }
  }

  const errors: Partial<Record<Name, string>> = {};
  for (const name of Object.keys(allErrors) as Name[]) {
    if (submitted || touched[name]) errors[name] = allErrors[name];
  }

  function register(name: Name) {
    return {
      name,
      value: values[name],
      onChange: (event: ChangeEvent<HTMLInputElement>) =>
        setValues((v) => ({ ...v, [name]: event.target.value })),
      onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
    };
  }

  /** Calls `onValid` with the parsed (normalised) values, or focuses the first invalid field. */
  function handleSubmit(onValid: (data: z.output<S>) => void) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitted(true);
      if (result.success) {
        onValid(result.data);
        return;
      }
      const first = Object.keys(initialValues).find((name) => allErrors[name as Name]);
      const element = first && event.currentTarget.elements.namedItem(first);
      if (element instanceof HTMLElement) element.focus();
    };
  }

  return { values, errors, register, handleSubmit };
}
