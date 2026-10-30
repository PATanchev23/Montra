import { randomBytes } from 'node:crypto';

const SLUG_BASE_MAX_LENGTH = 48;
const FALLBACK = 'business';

/** Bulgarian Cyrillic in the official Streamlined System, so "Техностор" becomes "tehnostor". */
// prettier-ignore
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: 'y', ю: 'yu', я: 'ya',
};

/** A URL-safe slug for a business name: lower-case ASCII words joined by hyphens. */
export function slugify(name: string): string {
  const latin = [...name.toLowerCase()].map((char) => CYRILLIC[char] ?? char).join('');
  const slug = latin
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // accents: "café" → "cafe"
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_BASE_MAX_LENGTH)
    .replace(/^-+|-+$/g, '');
  return slug || FALLBACK;
}

/** The slug with a short random suffix, for when the plain one is taken: "techstore-x7k2". */
export function suffixedSlug(slug: string): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const suffix = [...randomBytes(4)].map((byte) => alphabet[byte % alphabet.length]).join('');
  return `${slug}-${suffix}`;
}
