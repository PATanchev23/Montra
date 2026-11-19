/**
 * What a change between two periods amounts to. A percentage only means
 * something when the earlier figure is not zero; otherwise the change is
 * named in words, neither good nor bad.
 */
export type ChangeKind = 'none' | 'no-earlier' | 'ratio';

export function changeKind(
  ratio: number | null,
  cents?: number,
  previousCents?: number,
): ChangeKind {
  if (cents !== undefined && previousCents !== undefined) {
    if (cents === previousCents) return 'none';
    if (previousCents === 0) return 'no-earlier';
  }
  return ratio === null || !Number.isFinite(ratio) ? 'no-earlier' : 'ratio';
}
