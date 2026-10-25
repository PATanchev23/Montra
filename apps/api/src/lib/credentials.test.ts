import { describe, expect, it } from 'vitest';
import { hashPassword, normalizeEmail, verifyPassword } from './credentials';

describe('credentials', () => {
  it('hashes with argon2id and verifies only the right password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('correct horse');
    expect(await verifyPassword(hash, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(hash, 'wrong horse battery')).toBe(false);
  });

  it('salts every hash', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same password'),
      hashPassword('same password'),
    ]);
    expect(a).not.toBe(b);
  });

  it('treats an unreadable hash as a failed check instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });

  it('normalises emails to the form the database accepts', () => {
    expect(normalizeEmail('  Ana.Petrova@Example.COM ')).toBe('ana.petrova@example.com');
  });
});
