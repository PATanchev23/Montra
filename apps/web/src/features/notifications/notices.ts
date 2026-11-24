import { parseISO } from 'date-fns';
import { useAlerts } from '../../api/finance';
import { useMessages } from '../../i18n';
import { common } from '../../i18n/common';
import { money, relativeDay } from '../../lib/format';
import type { NotificationPrefs } from '../../stores/ui';
import { useCurrentMembership } from '../auth/currentUser';

/** What an alert is about, so a list can mark it: a payment close, or money over a line. */
export type NoticeTone = 'warning' | 'negative';

export interface Notice {
  /** Stable for one occurrence, so the desktop shows it once. */
  id: string;
  /** The Settings switch for this kind of alert. */
  pref: keyof NotificationPrefs;
  title: string;
  body: string;
  time: string;
  tone: NoticeTone;
  /** The page that resolves it. */
  to: string;
}

/**
 * The API's alerts, in words: a payment due soon, an overspent budget, a low
 * balance ahead. Shared by the notification bell and the dashboard's
 * "Needs your attention", so both say the same thing. `loading` is true
 * until the alerts have arrived once.
 */
export function useNotices(): { notices: Notice[]; loading: boolean; failed: boolean } {
  const { business } = useCurrentMembership();
  const { data, isPending, isError } = useAlerts(business.id);
  const m = useMessages(common).topBar.alerts;
  if (!data) return { notices: [], loading: isPending && !isError, failed: isError };
  const today = parseISO(data.today);
  const fmt = (cents: number) => money(cents, { decimals: 0, currency: business.currency });
  const notices = data.alerts.map((alert): Notice => {
    switch (alert.kind) {
      case 'due-soon':
        return {
          id: `due-soon:${alert.description}:${alert.dueDate}`,
          pref: 'dueReminders',
          title: m.due(alert.description),
          body: m.dueBody(fmt(alert.amountCents)),
          time: relativeDay(alert.dueDate, today, 'EEE d MMM'),
          tone: 'warning',
          to: '/cash-flow#upcoming',
        };
      case 'over-budget':
        return {
          id: `over-budget:${alert.category}:${data.today.slice(0, 7)}`,
          pref: 'budgetAlerts',
          title: m.overBudget(alert.category),
          body: m.overBudgetBody(fmt(alert.spentCents), fmt(alert.limitCents)),
          time: m.thisMonth,
          tone: 'negative',
          to: '/budgets',
        };
      case 'low-balance':
        return {
          id: `low-balance:${alert.date}`,
          pref: 'lowBalance',
          title: m.lowBalance,
          body: m.lowBalanceBody(fmt(alert.balanceCents), fmt(alert.thresholdCents)),
          time: relativeDay(alert.date, today, 'd MMM'),
          tone: 'negative',
          to: '/cash-flow',
        };
    }
  });
  return { notices, loading: false, failed: false };
}
