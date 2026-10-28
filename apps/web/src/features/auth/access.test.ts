import { describe, expect, it } from 'vitest';
import { profile } from '../../test/authApi';
import { firstName, hasBusinessAccess, returnPathFrom } from './access';

describe('hasBusinessAccess', () => {
  it('requires at least one membership, whatever the onboarding status', () => {
    expect(hasBusinessAccess(profile())).toBe(true);
    expect(hasBusinessAccess(profile({ memberships: [] }))).toBe(false);
  });
});

describe('returnPathFrom', () => {
  const from = (pathname: unknown, search = '', hash = '') => ({
    from: { pathname, search, hash },
  });

  it('returns to the page the user was stopped at', () => {
    expect(returnPathFrom(from('/transactions', '?q=dell', '#row'))).toBe(
      '/transactions?q=dell#row',
    );
  });

  it('falls back to the dashboard for anything else', () => {
    expect(returnPathFrom(undefined)).toBe('/');
    expect(returnPathFrom(null)).toBe('/');
    expect(returnPathFrom({})).toBe('/');
    expect(returnPathFrom(from(42))).toBe('/');
    expect(returnPathFrom(from('//evil.example/path'))).toBe('/');
    expect(returnPathFrom(from('https://evil.example'))).toBe('/');
    expect(returnPathFrom(from('/login'))).toBe('/');
  });
});

describe('firstName', () => {
  it('takes the first word', () => {
    expect(firstName('  Ana   Petrova ')).toBe('Ana');
    expect(firstName('Presiyan')).toBe('Presiyan');
  });
});
