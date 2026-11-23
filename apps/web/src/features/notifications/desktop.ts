import { useEffect, useState } from 'react';
import { MARK_PATH } from '../../components/Logo';
import { useUiStore, type NotificationPrefs } from '../../stores/ui';

/**
 * Desktop notifications through the browser's Notification API: they appear
 * in the computer's own notification area (Windows Action Center, macOS
 * Notification Center) while Montra is open in a tab, even in the background.
 */

export type DesktopPermission = NotificationPermission | 'unsupported';

/** What the browser allows right now. */
export function desktopPermission(): DesktopPermission {
  return typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission
    : 'unsupported';
}

/** The browser's permission, kept current if it changes in the site settings. */
export function useDesktopPermission(): [DesktopPermission, (p: DesktopPermission) => void] {
  const [permission, setPermission] = useState(desktopPermission);
  useEffect(() => {
    if (permission === 'unsupported' || !navigator.permissions?.query) return;
    let status: PermissionStatus | undefined;
    const update = () => setPermission(desktopPermission());
    navigator.permissions
      .query({ name: 'notifications' })
      .then((s) => {
        status = s;
        s.addEventListener('change', update);
      })
      .catch(() => {});
    return () => status?.removeEventListener('change', update);
  }, [permission]);
  return [permission, setPermission];
}

/** Asks for permission; browsers only show the prompt after a click. */
export async function requestDesktopPermission(): Promise<DesktopPermission> {
  if (desktopPermission() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return desktopPermission();
  }
}

/** Windows does not draw SVG icons in notifications, so the mark is drawn once as a PNG. */
let icon: string | undefined;
function iconUrl(): string | undefined {
  if (icon !== undefined) return icon || undefined;
  try {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 28);
    ctx.fill();
    ctx.translate(24, 24);
    ctx.scale(2, 2);
    ctx.fillStyle = '#171717';
    ctx.fill(new Path2D(MARK_PATH), 'evenodd');
    icon = canvas.toDataURL('image/png');
  } catch {
    icon = '';
  }
  return icon || undefined;
}

/** Shows one notification; clicking it brings Montra forward and runs `onClick`. */
export function showDesktop(
  title: string,
  options: { body?: string; tag?: string; onClick?: () => void },
) {
  if (desktopPermission() !== 'granted') return;
  try {
    const notification = new Notification(title, {
      body: options.body,
      tag: options.tag,
      icon: iconUrl(),
    });
    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };
  } catch {
    // Some browsers only allow notifications from a service worker; the bell still lists them.
  }
}

export interface DesktopNotice {
  /** Stable for one occurrence (this payment, this month's overspend), so it is shown once. */
  key: string;
  /** The setting that switches this kind on or off. */
  pref: keyof NotificationPrefs;
  title: string;
  body: string;
  onClick: () => void;
}

const SEEN_LIMIT = 200;
const seenKey = (businessId: string) => `montra-notified:${businessId}`;

function readSeen(businessId: string): string[] {
  try {
    const raw = localStorage.getItem(seenKey(businessId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

function writeSeen(businessId: string, keys: string[]) {
  try {
    localStorage.setItem(seenKey(businessId), JSON.stringify(keys.slice(-SEEN_LIMIT)));
  } catch {
    // Storage full or blocked: at worst a notice is shown again after a reload.
  }
}

/**
 * Sends each new alert to the desktop once, if desktop notifications are on,
 * the browser allows them, and that kind of alert is switched on in Settings.
 */
export function useDesktopNotifications(businessId: string, notices: DesktopNotice[]) {
  const prefs = useUiStore((s) => s.notifications);
  const keys = notices.map((n) => n.key).join('|');
  useEffect(() => {
    if (!prefs.desktop || desktopPermission() !== 'granted' || notices.length === 0) return;
    const seen = readSeen(businessId);
    const fresh = notices.filter((n) => prefs[n.pref] && !seen.includes(n.key));
    if (fresh.length === 0) return;
    for (const n of fresh) showDesktop(n.title, { body: n.body, tag: n.key, onClick: n.onClick });
    writeSeen(businessId, [...seen, ...fresh.map((n) => n.key)]);
    // `keys` stands in for `notices`, which is a new array on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, keys, prefs]);
}
