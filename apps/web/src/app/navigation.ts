import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  CircleGauge,
  FileText,
  LayoutDashboard,
  Settings,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { common } from '../i18n/common';

/** A key into the shared navigation messages. */
export type NavLabel = keyof (typeof common)['en']['nav'];

export interface NavItem {
  to: string;
  label: NavLabel;
  /** A shorter name for the phone tab bar, where every label has 78px. */
  tabLabel?: NavLabel;
  icon: LucideIcon;
}

export interface NavGroup {
  label: NavLabel;
  items: NavItem[];
}

const dashboard: NavItem = { to: '/', label: 'dashboard', icon: LayoutDashboard };
const transactions: NavItem = { to: '/transactions', label: 'transactions', icon: ArrowLeftRight };
const cashFlow: NavItem = {
  to: '/cash-flow',
  label: 'cashFlow',
  tabLabel: 'cashFlowTab',
  icon: BarChart3,
};
const budgets: NavItem = { to: '/budgets', label: 'budgets', icon: CircleGauge };
const simulations: NavItem = { to: '/simulations', label: 'simulations', icon: TrendingUp };
const reports: NavItem = { to: '/reports', label: 'reports', icon: FileText };

/** The sidebar's destinations, grouped the way an owner thinks about money. */
export const navGroups: NavGroup[] = [
  { label: 'groupOverview', items: [dashboard] },
  { label: 'groupMoney', items: [transactions, cashFlow, budgets] },
  { label: 'groupPlanning', items: [simulations, reports] },
];

export const primaryNav: NavItem[] = navGroups.flatMap((group) => group.items);

export const secondaryNav: NavItem[] = [
  { to: '/status', label: 'status', icon: Activity },
  { to: '/settings', label: 'settings', icon: Settings },
];

/** The phone tab bar: the four destinations used most, plus "More". */
export const tabBarNav: NavItem[] = [dashboard, transactions, cashFlow, budgets];
