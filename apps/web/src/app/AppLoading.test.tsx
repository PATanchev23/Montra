import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLoading, LoadingVeil } from './AppLoading';

describe('loading veil', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps the logo up a moment after a quick load, then fades it out', () => {
    const { rerender } = render(
      <>
        <AppLoading />
        <LoadingVeil />
      </>,
    );
    expect(screen.getByRole('status', { name: 'Loading Montra' })).toBeInTheDocument();

    // The page is ready almost at once…
    act(() => vi.advanceTimersByTime(50));
    rerender(<LoadingVeil />);
    // …but the logo holds, no longer announced as loading.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(document.querySelector('svg')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(800));
    expect(document.querySelector('svg')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60 + 240));
    expect(document.querySelector('svg')).not.toBeInTheDocument();
  });

  it('does not hold any longer after a slow load', () => {
    const { rerender } = render(
      <>
        <AppLoading />
        <LoadingVeil />
      </>,
    );
    act(() => vi.advanceTimersByTime(2_000));
    rerender(<LoadingVeil />);
    // Past the minimum already: straight to the fade.
    act(() => vi.advanceTimersByTime(240));
    expect(document.querySelector('svg')).not.toBeInTheDocument();
  });
});
