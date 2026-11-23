import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '../../stores/ui';
import { useDesktopNotifications, type DesktopNotice } from './desktop';

/** A stand-in for the browser's Notification, recording what was shown. */
const shown: { title: string; body?: string; tag?: string }[] = [];
class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static requestPermission = vi.fn(async () => FakeNotification.permission);
  onclick: (() => void) | null = null;
  constructor(title: string, options: NotificationOptions = {}) {
    shown.push({ title, body: options.body, tag: options.tag });
  }
  close() {}
}

const notice = (key: string, pref: DesktopNotice['pref'] = 'dueReminders'): DesktopNotice => ({
  key,
  pref,
  title: `Title ${key}`,
  body: `Body ${key}`,
  onClick: () => {},
});

const prefs = useUiStore.getState().notifications;

// jsdom cannot draw on a canvas and logs "Not implemented" when asked to; the
// icon is optional, so the notifications go out without it, as in such a browser.
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);

beforeEach(() => {
  shown.length = 0;
  localStorage.clear();
  FakeNotification.permission = 'granted';
  vi.stubGlobal('Notification', FakeNotification);
  useUiStore.setState({ notifications: { ...prefs, desktop: true } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  useUiStore.setState({ notifications: prefs });
});

describe('desktop notifications', () => {
  it('shows each alert once, also after a reload', () => {
    const { rerender, unmount } = renderHook(({ list }) => useDesktopNotifications('b1', list), {
      initialProps: { list: [notice('rent')] },
    });
    expect(shown).toEqual([{ title: 'Title rent', body: 'Body rent', tag: 'rent' }]);

    // A refetch with one new alert shows only the new one.
    rerender({ list: [notice('rent'), notice('payroll')] });
    expect(shown.map((s) => s.tag)).toEqual(['rent', 'payroll']);

    // A reload remembers both.
    unmount();
    renderHook(() => useDesktopNotifications('b1', [notice('rent'), notice('payroll')]));
    expect(shown).toHaveLength(2);
  });

  it('keeps each business apart', () => {
    renderHook(() => useDesktopNotifications('b1', [notice('rent')]));
    renderHook(() => useDesktopNotifications('b2', [notice('rent')]));
    expect(shown).toHaveLength(2);
  });

  it('respects the switch for each kind of alert', () => {
    useUiStore.setState({ notifications: { ...prefs, desktop: true, budgetAlerts: false } });
    renderHook(() =>
      useDesktopNotifications('b1', [notice('over', 'budgetAlerts'), notice('low', 'lowBalance')]),
    );
    expect(shown.map((s) => s.tag)).toEqual(['low']);
  });

  it('shows nothing while desktop notifications are off', () => {
    useUiStore.setState({ notifications: { ...prefs, desktop: false } });
    renderHook(() => useDesktopNotifications('b1', [notice('rent')]));
    expect(shown).toEqual([]);
  });

  it('shows nothing, and remembers nothing, when the browser blocks them', () => {
    FakeNotification.permission = 'denied';
    renderHook(() => useDesktopNotifications('b1', [notice('rent')]));
    expect(shown).toEqual([]);

    // Allowed later, the alert still arrives.
    FakeNotification.permission = 'granted';
    renderHook(() => useDesktopNotifications('b1', [notice('rent')]));
    expect(shown.map((s) => s.tag)).toEqual(['rent']);
  });

  it('does nothing in a browser without notifications', () => {
    vi.unstubAllGlobals();
    // jsdom has no Notification at all.
    expect('Notification' in window).toBe(false);
    renderHook(() => useDesktopNotifications('b1', [notice('rent')]));
    expect(shown).toEqual([]);
  });
});
