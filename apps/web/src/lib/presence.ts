import { useEffect, useState } from 'react';

/** A little longer than the longest closing animation of a sheet or dialog (index.css). */
export const EXIT_MS = 240;

/**
 * True while `open`, and for a moment after it turns false, so a sheet or
 * dialog that its parent mounts only while open can still animate out.
 */
export function useStayMounted(open: boolean, ms = EXIT_MS): boolean {
  const [lingering, setLingering] = useState(open);
  if (open && !lingering) setLingering(true);
  useEffect(() => {
    if (open) return;
    const timer = setTimeout(() => setLingering(false), ms);
    return () => clearTimeout(timer);
  }, [open, ms]);
  return open || lingering;
}

/**
 * Counts openings. Used as the key of a sheet kept mounted by useStayMounted,
 * so reopening it while it is still animating out starts a fresh form.
 */
export function useOpenCount(open: boolean): number {
  const [count, setCount] = useState(open ? 1 : 0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setCount(count + 1);
  }
  return count;
}

/** `value` while `active`; once inactive, the last active value, so closing content does not blank out. */
export function useLastWhile<T>(value: T, active: boolean): T {
  const [last, setLast] = useState(value);
  if (active && value !== last) setLast(value);
  return active ? value : last;
}
