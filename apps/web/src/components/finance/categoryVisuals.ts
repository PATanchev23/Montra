import {
  Building2,
  CreditCard,
  Landmark,
  Megaphone,
  Package,
  Puzzle,
  ShoppingBag,
  Store,
  Truck,
  Users,
  Warehouse,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryId } from '../../demo/types';

export type CategoryTone = 'positive' | 'negative' | 'analytic' | 'warning' | 'neutral';

interface CategoryVisual {
  icon: LucideIcon;
  tone: CategoryTone;
  /** Fill and background classes used when the category appears in a chart. */
  fill: string;
  swatch: string;
}

/** One place that decides how each category looks, so lists and charts agree. */
export const categoryVisuals: Record<CategoryId, CategoryVisual> = {
  'sales-store': { icon: Store, tone: 'positive', fill: 'fill-chart-1', swatch: 'bg-chart-1' },
  'sales-marketplace': {
    icon: ShoppingBag,
    tone: 'positive',
    fill: 'fill-chart-3',
    swatch: 'bg-chart-3',
  },
  'sales-b2b': { icon: Building2, tone: 'positive', fill: 'fill-chart-4', swatch: 'bg-chart-4' },
  inventory: { icon: Package, tone: 'negative', fill: 'fill-chart-1', swatch: 'bg-chart-1' },
  advertising: { icon: Megaphone, tone: 'analytic', fill: 'fill-chart-3', swatch: 'bg-chart-3' },
  shipping: { icon: Truck, tone: 'neutral', fill: 'fill-chart-4', swatch: 'bg-chart-4' },
  payroll: { icon: Users, tone: 'neutral', fill: 'fill-chart-5', swatch: 'bg-chart-5' },
  rent: { icon: Warehouse, tone: 'neutral', fill: 'fill-chart-6', swatch: 'bg-chart-6' },
  software: { icon: Puzzle, tone: 'neutral', fill: 'fill-chart-2', swatch: 'bg-chart-2' },
  fees: { icon: CreditCard, tone: 'neutral', fill: 'fill-chart-6', swatch: 'bg-chart-6' },
  utilities: { icon: Zap, tone: 'neutral', fill: 'fill-chart-2', swatch: 'bg-chart-2' },
  taxes: { icon: Landmark, tone: 'warning', fill: 'fill-chart-6', swatch: 'bg-chart-6' },
};

/** Breakdown charts colour by rank so adjacent segments always contrast. */
export const rankFills = [
  'fill-chart-1',
  'fill-chart-3',
  'fill-chart-4',
  'fill-chart-5',
  'fill-chart-2',
];
export const rankSwatches = ['bg-chart-1', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5', 'bg-chart-2'];
