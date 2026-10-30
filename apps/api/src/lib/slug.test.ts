import { describe, expect, it } from 'vitest';
import { slugify, suffixedSlug } from './slug';

describe('slugify', () => {
  it.each([
    ['TechStore', 'techstore'],
    ['  Ana’s Gadget Shop!  ', 'ana-s-gadget-shop'],
    ['Café Ünïcode', 'cafe-unicode'],
    ['Техностор ЕООД', 'tehnostor-eood'],
    ['Щастие и Юла', 'shtastie-i-yula'],
    ['!!!', 'business'],
    ['店', 'business'],
  ])('%j → %j', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it('keeps slugs short and never ends them with a hyphen', () => {
    const slug = slugify(`${'a'.repeat(47)} b`);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug).not.toMatch(/-$/);
  });
});

describe('suffixedSlug', () => {
  it('adds four random characters', () => {
    expect(suffixedSlug('techstore')).toMatch(/^techstore-[a-z0-9]{4}$/);
    expect(suffixedSlug('techstore')).not.toBe(suffixedSlug('techstore'));
  });
});
