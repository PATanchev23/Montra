import type { PlanId } from '@montra/shared';
import type { plansMessages } from './messages';

export type { PlanId };

export interface Plan {
  id: PlanId;
  /** Monthly price in euro cents. */
  priceCents: number;
  /** The plan before it, whose features this one includes. */
  builds?: PlanId;
  recommended?: boolean;
}

/** Plans are priced in euro, whatever currency a business keeps its books in. */
export const PLAN_CURRENCY = 'EUR';

export const PLANS: Plan[] = [
  { id: 'free', priceCents: 0 },
  { id: 'pro', priceCents: 1200, builds: 'free', recommended: true },
  { id: 'business', priceCents: 2900, builds: 'pro' },
];

type CompareKey = keyof (typeof plansMessages)['en']['compare'];
type RowKey = keyof (typeof plansMessages)['en']['compare']['rows'];

/** A cell: included or not, or a short value (a limit) from the compare messages. */
export type Availability = boolean | CompareKey;

/** The comparison table, row by row: Free, Pro, Business. */
export const COMPARISON: { row: RowKey; plans: Record<PlanId, Availability> }[] = [
  { row: 'businesses', plans: { free: 'oneBusiness', pro: 'upToThree', business: 'upToFive' } },
  { row: 'dashboard', plans: { free: true, pro: true, business: true } },
  { row: 'budgets', plans: { free: true, pro: true, business: true } },
  { row: 'import', plans: { free: 'importLimit', pro: 'unlimited', business: 'unlimited' } },
  { row: 'forecast', plans: { free: false, pro: true, business: true } },
  { row: 'simulations', plans: { free: false, pro: true, business: true } },
  { row: 'reports', plans: { free: false, pro: true, business: true } },
  { row: 'desktop', plans: { free: false, pro: true, business: true } },
  { row: 'viewers', plans: { free: false, pro: false, business: true } },
  { row: 'support', plans: { free: false, pro: false, business: true } },
];
