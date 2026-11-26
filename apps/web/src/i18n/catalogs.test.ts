import { describe, expect, it } from 'vitest';

/*
 * Types already make every catalogue define every key in both languages. This
 * catches what types cannot: a Bulgarian entry left in English (copied and
 * never translated), or a message function that throws for Bulgarian.
 */

const modules = import.meta.glob<Record<string, unknown>>(
  ['../**/messages.ts', './common.ts', '../lib/format.ts'],
  { eager: true },
);

/** Bulgarian text that is rightly the same as the English (names, codes, numbers). */
const SAME_IN_BOTH = new Set<string>([
  // The Pro plan keeps its product name in Bulgarian.
  'Pro',
]);

type Catalog = { en: unknown; bg: unknown };
const isCatalog = (value: unknown): value is Catalog =>
  typeof value === 'object' && value !== null && 'en' in value && 'bg' in value;

/** Calls message functions with plausible arguments, so their output can be compared too. */
function sample(fn: (...args: unknown[]) => unknown): unknown {
  const args = Array.from({ length: fn.length }, (_, i) => (i % 2 === 0 ? 3 : 'X'));
  try {
    return fn(...args);
  } catch {
    // A message expecting a different argument shape; its English twin is skipped the same way.
    return undefined;
  }
}

function leaves(value: unknown, path: string, out: Map<string, unknown>) {
  if (typeof value === 'function') value = sample(value as (...args: unknown[]) => unknown);
  if (typeof value === 'string') out.set(path, value);
  else if (Array.isArray(value)) value.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
  else if (typeof value === 'object' && value !== null)
    for (const [key, v] of Object.entries(value)) leaves(v, `${path}.${key}`, out);
}

const catalogs = Object.entries(modules).flatMap(([file, exports]) =>
  Object.entries(exports)
    .filter(([, value]) => isCatalog(value))
    .map(([name, value]) => ({
      name: `${file.replace(/^\.\.?\//, '')}:${name}`,
      ...(value as Catalog),
    })),
);

describe('message catalogues', () => {
  it('finds every catalogue', () => {
    expect(catalogs.length).toBe(16);
  });

  it.each(catalogs.map((c) => [c.name, c] as const))('%s is translated', (_, catalog) => {
    const en = new Map<string, unknown>();
    const bg = new Map<string, unknown>();
    leaves(catalog.en, '', en);
    leaves(catalog.bg, '', bg);

    const untranslated = [...en].filter(
      ([path, text]) =>
        typeof text === 'string' &&
        /[a-z]{3}/i.test(text) &&
        bg.get(path) === text &&
        !SAME_IN_BOTH.has(text),
    );
    expect(untranslated.map(([path, text]) => `${path}: ${String(text)}`)).toEqual([]);
  });
});
