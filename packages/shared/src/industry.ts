import { z } from 'zod';

/**
 * The kinds of business onboarding offers as cards. The owner's answer is
 * saved as free text (the card's label in their language, or their own
 * words), so it is read back into one of these by its wording.
 */
export const INDUSTRY_KINDS = [
  'electronics',
  'fashion',
  'home',
  'beauty',
  'food',
  'sports',
  'handmade',
] as const;
export const industryKindSchema = z.enum(INDUSTRY_KINDS);
export type IndustryKind = z.infer<typeof industryKindSchema>;

/**
 * Word beginnings that name each kind, in English and Bulgarian: the card
 * labels first ("Electronics", "Мода"), then what owners tend to type.
 */
const STEMS: Record<IndustryKind, string[]> = {
  electronics: [
    'electronic',
    'phone',
    'smartphone',
    'computer',
    'laptop',
    'gadget',
    'електрон',
    'телефон',
    'компют',
  ],
  fashion: [
    'fashion',
    'cloth',
    'apparel',
    'shoe',
    'jewel',
    'мода',
    'дрех',
    'облекл',
    'обув',
    'бижу',
  ],
  home: ['home', 'furniture', 'decor', 'kitchen', 'дом', 'мебел', 'декор', 'кухн', 'обзавежд'],
  beauty: ['beauty', 'cosmetic', 'health', 'skincare', 'красот', 'козмет', 'здрав'],
  food: ['food', 'drink', 'grocer', 'coffee', 'bakery', 'хран', 'напит', 'кафе', 'пекар'],
  sports: [
    'sport',
    'outdoor',
    'bike',
    'bicycle',
    'camping',
    'fitness',
    'спорт',
    'туриз',
    'велосипед',
    'къмпинг',
  ],
  handmade: ['handmade', 'craft', 'art', 'print', 'gift', 'ръчн', 'занаят', 'изкуств', 'подар'],
};

/**
 * The months (1–12) each kind usually sells most in: the gift season for
 * most shops, spring for outdoor gear, the new collections for fashion.
 */
export const INDUSTRY_PEAK_MONTHS: Record<IndustryKind, number[]> = {
  electronics: [11, 12],
  fashion: [3, 9, 11, 12],
  home: [11, 12],
  beauty: [2, 12],
  food: [12],
  sports: [4, 5, 6],
  handmade: [11, 12],
};

/** The kind an industry answer describes, or null when it names none of them. */
export function industryKind(industry: string | null | undefined): IndustryKind | null {
  const text = industry?.trim().toLocaleLowerCase();
  if (!text) return null;
  // A stem counts only at the start of a word, so "art" is not found in "smartphones".
  const words = text.split(/[^\p{L}]+/u).filter(Boolean);
  const matches = (kind: IndustryKind) =>
    STEMS[kind].some((stem) => words.some((word) => word.startsWith(stem)));
  return INDUSTRY_KINDS.find(matches) ?? null;
}
