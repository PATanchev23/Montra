import { screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetSessionForTests } from '../api/session';
import { useUiStore } from '../stores/ui';
import { ledgerServer, transaction } from '../test/ledgerApi';
import { polyfillRadix, renderTransactions } from '../test/renderTransactions';
import { TopBar } from './TopBar';

/*
 * Cash flow, Budgets, Simulations and Reports still run on the TechStore
 * sample layer. A business with transactions of its own sees that sample,
 * labelled; a business with none sees the same pages laid out at zero, and
 * never a TechStore figure, name or note.
 */

const pages = [
  {
    path: '/cash-flow',
    heading: 'Balance & projection',
    emptyLine: 'No upcoming payments yet',
    chartNote: 'Add your first transactions to see income and expenses month by month',
  },
  {
    path: '/budgets',
    heading: 'Where it went',
    emptyLine: 'No budgets yet',
    chartNote: null,
  },
  {
    path: '/simulations',
    heading: 'Projected balance',
    emptyLine: 'No scenarios yet',
    chartNote: 'Add your first transactions to test decisions against your own cash flow',
  },
  {
    path: '/reports',
    heading: 'Monthly revenue',
    emptyLine: 'No revenue yet',
    chartNote: 'Add your first transactions to see revenue month by month',
  },
] as const;

/** Text only the TechStore sample shows, whichever page it is on. */
const SAMPLE_ONLY = /TechStore|Meta Ads|Marketplace payout|Increase ad spend|online store remains/;

const someTransactions = () => [
  transaction({
    id: 't1',
    type: 'INCOME',
    amountCents: 150_000,
    description: 'Wholesale order',
    category: 'Sales',
    date: '2026-11-05',
  }),
];

beforeAll(polyfillRadix);
beforeEach(() => resetSessionForTests());
afterEach(() => {
  resetSessionForTests();
  useUiStore.setState({ language: 'en' });
});

describe.each(pages)('$path', ({ path, heading, emptyLine, chartNote }) => {
  it('lays the page out at zero for an owner with no transactions', async () => {
    ledgerServer();
    renderTransactions(path);

    // The same panels as with data, empty: €0, an empty line, no sample anywhere.
    expect(await screen.findByText(heading)).toBeInTheDocument();
    expect(await screen.findByText(emptyLine)).toBeInTheDocument();
    expect(screen.getAllByText(/€0(?![\d,.])/).length).toBeGreaterThan(0);
    expect(screen.queryByText(SAMPLE_ONLY)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);

    if (chartNote) {
      expect(screen.getByText(chartNote)).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: 'Import transactions' })[0]).toHaveAttribute(
        'href',
        '/transactions?import=new',
      );
    }
  });

  it('shows a viewer the same empty layout, with nothing that leads to an import', async () => {
    ledgerServer({ role: 'VIEWER' });
    renderTransactions(path);

    expect(await screen.findByText(heading)).toBeInTheDocument();
    expect(await screen.findByText(emptyLine)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Import|Add transaction/ })).not.toBeInTheDocument();
    if (chartNote) expect(screen.queryByText(chartNote)).not.toBeInTheDocument();
    expect(screen.queryByText(SAMPLE_ONLY)).not.toBeInTheDocument();
  });

  it('keeps the labelled sample for a business that has transactions', async () => {
    ledgerServer({ transactions: someTransactions() });
    renderTransactions(path);

    expect(await screen.findByText(heading)).toBeInTheDocument();
    expect(screen.queryByText(emptyLine)).not.toBeInTheDocument();
  });
});

describe('reports for a business with no transactions', () => {
  it('turns the exports off, so nothing of TechStore can be downloaded', async () => {
    ledgerServer();
    renderTransactions('/reports');

    await screen.findByText('No revenue yet');
    expect(screen.getByRole('button', { name: 'Export P&L' })).toBeDisabled();
    for (const button of screen.getAllByRole('button', { name: /^Download/ })) {
      expect(button).toBeDisabled();
    }
  });
});

describe('the top bar', () => {
  const topBar = <TopBar onOpenNavigation={() => {}} />;

  it('shows no sample badge or sample notifications to a business with no transactions', async () => {
    ledgerServer();
    renderTransactions('/cash-flow', topBar);

    await screen.findByText('No upcoming payments yet');
    expect(screen.queryByText('Sample data')).not.toBeInTheDocument();
    const bell = screen.getByRole('button', { name: 'Notifications' });
    expect(bell.querySelector('span.rounded-full')).toBeNull();
  });

  it('labels the sample for a business that has transactions', async () => {
    ledgerServer({ transactions: someTransactions() });
    renderTransactions('/cash-flow', topBar);

    expect(await screen.findByText('Sample data')).toBeInTheDocument();
  });
});

describe('in Bulgarian', () => {
  it('lays the empty pages out in Bulgarian', async () => {
    useUiStore.setState({ language: 'bg' });
    ledgerServer();
    renderTransactions('/cash-flow');

    expect(await screen.findByText('Все още няма предстоящи плащания')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Добавете първите си транзакции, за да видите приходите и разходите по месеци',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Още няма данни').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Импортирай транзакции' })).toBeInTheDocument();
  });
});

describe('cash flow for a business with no transactions', () => {
  it('shows money out as €0, never as a negative zero', async () => {
    ledgerServer();
    renderTransactions('/cash-flow');

    await screen.findByText('No upcoming payments yet');
    expect(screen.queryByText('−€0')).not.toBeInTheDocument();
  });
});
