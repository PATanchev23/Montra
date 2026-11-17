import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '../../stores/ui';
import { SystemStatusPage } from './SystemStatusPage';

afterEach(() => useUiStore.setState({ language: 'en' }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SystemStatusPage />
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('SystemStatusPage', () => {
  it('shows every tier connected when the API reports a healthy database', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        status: 'ok',
        version: '0.1.0',
        uptimeSeconds: 3700,
        timestamp: '2026-10-25T12:00:00.000Z',
        checks: { database: { status: 'up', latencyMs: 3 } },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('All systems operational')).toBeInTheDocument();
    expect(screen.getAllByText('Connected')).toHaveLength(3);
    expect(screen.getByText('3 ms')).toBeInTheDocument();
    expect(screen.getByText('1h 1m')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('writes times and the build mode in Bulgarian', async () => {
    useUiStore.setState({ language: 'bg' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          status: 'ok',
          version: '0.1.0',
          uptimeSeconds: 3700,
          timestamp: '2026-10-25T12:00:00.000Z',
          checks: { database: { status: 'up', latencyMs: 3 } },
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText('Всички системи работят')).toBeInTheDocument();
    // Round trip (measured) and database query (3 ms), both in Bulgarian units.
    expect(screen.getAllByText(/^\d+ мс$/)).toHaveLength(2);
    expect(screen.queryByText(/\bms\b/)).not.toBeInTheDocument();
    // Vitest runs in Vite's "test" mode.
    expect(screen.getByText('Тест')).toBeInTheDocument();
  });

  it('reports the API as unreachable when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    renderPage();

    expect(await screen.findByText('The API is unreachable')).toBeInTheDocument();
    expect(screen.getByText('Unreachable')).toBeInTheDocument();
  });

  it('rejects responses that do not match the shared contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' })));

    renderPage();

    expect(await screen.findByText('The API is returning errors')).toBeInTheDocument();
  });
});
