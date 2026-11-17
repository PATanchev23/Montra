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

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const dashboard: NavItem = { to: '/', label: 'Dashboard', icon: LayoutDashboard };
const transactions: NavItem = { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight };
const cashFlow: NavItem = { to: '/cash-flow', label: 'Cash flow', icon: BarChart3 };
const budgets: NavItem = { to: '/budgets', label: 'Budgets', icon: CircleGauge };
const simulations: NavItem = { to: '/simulations', label: 'Simulations', icon: TrendingUp };
const reports: NavItem = { to: '/reports', label: 'Reports', icon: FileText };

/** The sidebar's destinations, grouped the way an owner thinks about money. */
export const navGroups: NavGroup[] = [
  { label: 'Overview', items: [dashboard] },
  { label: 'Money', items: [transactions, cashFlow, budgets] },
  { label: 'Planning', items: [simulations, reports] },
];

export const primaryNav: NavItem[] = navGroups.flatMap((group) => group.items);

export const secondaryNav: NavItem[] = [
  { to: '/status', label: 'System status', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/** The phone tab bar: the four destinations used most, plus "More". */
export const tabBarNav: NavItem[] = [dashboard, transactions, cashFlow, budgets];
