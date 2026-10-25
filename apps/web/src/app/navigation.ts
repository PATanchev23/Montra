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

export const primaryNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: CircleGauge },
  { to: '/cash-flow', label: 'Cash Flow', icon: BarChart3 },
  { to: '/simulations', label: 'Simulations', icon: TrendingUp },
  { to: '/reports', label: 'Reports', icon: FileText },
];

export const secondaryNav: NavItem[] = [
  { to: '/status', label: 'System status', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
];
