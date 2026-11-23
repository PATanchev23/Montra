import { apiErrorSchema, authResponseSchema, billingResponseSchema } from '@montra/shared';
import Stripe from 'stripe';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from '../src/app';
import { fixtures, useTestDb } from './db';
import { createTestApp } from './helpers';

const PASSWORD = 'correct horse battery';
const WEBHOOK_SECRET = 'whsec_test_montra';
const PRODUCTS = { STRIPE_PRODUCT_PRO: 'prod_pro', STRIPE_PRODUCT_BUSINESS: 'prod_business' };

/*
 * Billing end to end, with a real Stripe client whose network calls are
 * stubbed: signatures are checked by the real SDK, and every write lands in
 * the test database.
 */

/** Just enough of a Stripe subscription for the sync. */
function subscription(
  overrides: Partial<{
    id: string;
    customer: string;
    status: Stripe.Subscription.Status;
    product: string;
    cancelAtPeriodEnd: boolean;
    periodEnd: number;
    userId: string;
  }> = {},
) {
  return {
    id: overrides.id ?? 'sub_1',
    object: 'subscription',
    customer: overrides.customer ?? 'cus_1',
    status: overrides.status ?? 'active',
    cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
    cancel_at: null,
    metadata: overrides.userId ? { userId: overrides.userId } : {},
    items: {
      data: [
        {
          price: { id: 'price_1', product: overrides.product ?? 'prod_pro' },
          current_period_end: overrides.periodEnd ?? 1_800_000_000,
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

describe('billing API', () => {
  const db = useTestDb();
  const stripe = new Stripe('sk_test_montra');
  let app: App;
  let counter = 0;

  beforeAll(async () => {
    app = await createTestApp(
      { AUTH_RATE_LIMIT_MAX: '1000', STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET, ...PRODUCTS },
      { stripe },
    );
  });
  afterAll(() => app.close());
  afterEach(() => vi.restoreAllMocks());

  async function signUp(role: 'OWNER' | 'VIEWER' = 'OWNER') {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { name: 'Ana', email: `bill${++counter}@example.com`, password: PASSWORD },
    });
    const body = authResponseSchema.parse(res.json());
    const business = await db.business.create({ data: fixtures.business() });
    await db.membership.create({ data: { userId: body.user.id, businessId: business.id, role } });
    return { userId: body.user.id, token: body.accessToken };
  }

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  /** Posts an event to the webhook, signed as Stripe would sign it. */
  function sendEvent(type: string, object: unknown, secret = WEBHOOK_SECRET) {
    const payload = JSON.stringify({
      id: `evt_${++counter}`,
      object: 'event',
      type,
      data: { object },
    });
    return app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret }),
      },
      payload,
    });
  }

  async function billingOf(token: string) {
    const res = await app.inject({ url: '/api/v1/billing', headers: auth(token) });
    expect(res.statusCode).toBe(200);
    return billingResponseSchema.parse(res.json());
  }

  let owner: { userId: string; token: string };
  beforeEach(async () => {
    owner = await signUp();
  });

  it('starts every account on Free', async () => {
    expect(await billingOf(owner.token)).toEqual({
      plan: 'free',
      status: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      configured: true,
      testMode: true,
      canSubscribe: true,
      canManage: false,
    });
    const viewer = await signUp('VIEWER');
    expect((await billingOf(viewer.token)).canSubscribe).toBe(false);
  });

  it('requires sign-in', async () => {
    const res = await app.inject({ url: '/api/v1/billing' });
    expect(res.statusCode).toBe(401);
  });

  describe('checkout', () => {
    it("opens Stripe Checkout for the plan's default price, creating the customer once", async () => {
      vi.spyOn(stripe.products, 'retrieve').mockResolvedValue({
        id: 'prod_pro',
        active: true,
        default_price: 'price_pro_monthly',
      } as never);
      const createCustomer = vi
        .spyOn(stripe.customers, 'create')
        .mockResolvedValue({ id: 'cus_new' } as never);
      const createSession = vi
        .spyOn(stripe.checkout.sessions, 'create')
        .mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' } as never);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers: auth(owner.token),
        payload: { plan: 'pro' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
      expect(stripe.products.retrieve).toHaveBeenCalledWith('prod_pro');
      expect(createCustomer).toHaveBeenCalledTimes(1);
      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          customer: 'cus_new',
          client_reference_id: owner.userId,
          line_items: [{ price: 'price_pro_monthly', quantity: 1 }],
          success_url: 'http://localhost:5173/plans?checkout=success',
          cancel_url: 'http://localhost:5173/plans?checkout=cancelled',
        }),
      );
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: owner.userId } })).stripeCustomerId,
      ).toBe('cus_new');

      // A second attempt reuses the customer.
      await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers: auth(owner.token),
        payload: { plan: 'business' },
      });
      expect(createCustomer).toHaveBeenCalledTimes(1);
      expect(createSession).toHaveBeenLastCalledWith(
        expect.objectContaining({ customer: 'cus_new' }),
      );
    });

    it('is for owners only', async () => {
      const viewer = await signUp('VIEWER');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers: auth(viewer.token),
        payload: { plan: 'pro' },
      });
      expect(res.statusCode).toBe(403);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe('BILLING_OWNERS_ONLY');
    });

    it('refuses a second subscription while one is running', async () => {
      await db.user.update({
        where: { id: owner.userId },
        data: {
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
          subscriptionStatus: 'active',
          plan: 'PRO',
        },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers: auth(owner.token),
        payload: { plan: 'business' },
      });
      expect(res.statusCode).toBe(409);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe('ALREADY_SUBSCRIBED');
    });

    it('says plainly when a plan has no price in Stripe', async () => {
      vi.spyOn(stripe.products, 'retrieve').mockResolvedValue({
        id: 'prod_pro',
        active: true,
        default_price: null,
      } as never);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers: auth(owner.token),
        payload: { plan: 'pro' },
      });
      expect(res.statusCode).toBe(503);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe('PLAN_UNAVAILABLE');
    });

    it('rejects plans that are not for sale', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers: auth(owner.token),
        payload: { plan: 'free' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('webhook', () => {
    it('rejects events without a valid Stripe signature', async () => {
      const res = await sendEvent('customer.subscription.updated', subscription(), 'whsec_wrong');
      expect(res.statusCode).toBe(400);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe('INVALID_SIGNATURE');
    });

    it('moves the account onto the plan it paid for when checkout completes', async () => {
      vi.spyOn(stripe.subscriptions, 'retrieve').mockResolvedValue(
        subscription({ product: 'prod_business', userId: owner.userId }) as never,
      );
      const res = await sendEvent('checkout.session.completed', {
        object: 'checkout.session',
        mode: 'subscription',
        subscription: 'sub_1',
        client_reference_id: owner.userId,
      });
      expect(res.statusCode).toBe(200);
      expect(await billingOf(owner.token)).toMatchObject({
        plan: 'business',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: new Date(1_800_000_000 * 1000).toISOString(),
        canManage: true,
      });
    });

    it("follows Stripe's current state, not the event's copy", async () => {
      await db.user.update({ where: { id: owner.userId }, data: { stripeCustomerId: 'cus_1' } });
      // The event says active; Stripe now says it was cancelled at the period end.
      vi.spyOn(stripe.subscriptions, 'retrieve').mockResolvedValue(
        subscription({ cancelAtPeriodEnd: true }) as never,
      );
      await sendEvent('customer.subscription.updated', subscription());
      expect(await billingOf(owner.token)).toMatchObject({ plan: 'pro', cancelAtPeriodEnd: true });
    });

    it('returns the account to Free when the subscription ends or stops being paid', async () => {
      await db.user.update({ where: { id: owner.userId }, data: { stripeCustomerId: 'cus_1' } });
      vi.spyOn(stripe.subscriptions, 'retrieve').mockResolvedValue(
        subscription({ status: 'past_due' }) as never,
      );
      await sendEvent('customer.subscription.updated', subscription());
      expect((await billingOf(owner.token)).plan).toBe('pro');

      vi.spyOn(stripe.subscriptions, 'retrieve').mockResolvedValue(
        subscription({ status: 'canceled' }) as never,
      );
      await sendEvent('customer.subscription.deleted', subscription());
      expect(await billingOf(owner.token)).toMatchObject({ plan: 'free', status: 'canceled' });
    });

    it('does not let an old subscription ending undo a newer one', async () => {
      await db.user.update({
        where: { id: owner.userId },
        data: {
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_new',
          subscriptionStatus: 'active',
          plan: 'BUSINESS',
        },
      });
      vi.spyOn(stripe.subscriptions, 'retrieve').mockResolvedValue(
        subscription({ id: 'sub_old', status: 'canceled' }) as never,
      );
      await sendEvent('customer.subscription.deleted', subscription({ id: 'sub_old' }));
      expect((await billingOf(owner.token)).plan).toBe('business');
    });

    it('acknowledges events it does not act on', async () => {
      const retrieve = vi.spyOn(stripe.subscriptions, 'retrieve');
      const res = await sendEvent('invoice.paid', { object: 'invoice' });
      expect(res.statusCode).toBe(200);
      expect(retrieve).not.toHaveBeenCalled();
    });
  });

  describe('portal', () => {
    it("opens Stripe's billing portal for a customer", async () => {
      await db.user.update({ where: { id: owner.userId }, data: { stripeCustomerId: 'cus_1' } });
      const create = vi
        .spyOn(stripe.billingPortal.sessions, 'create')
        .mockResolvedValue({ url: 'https://billing.stripe.com/p/session/test_1' } as never);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/portal',
        headers: auth(owner.token),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ url: 'https://billing.stripe.com/p/session/test_1' });
      expect(create).toHaveBeenCalledWith({
        customer: 'cus_1',
        return_url: 'http://localhost:5173/plans',
      });
    });

    it('has nothing to open before the first checkout', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/portal',
        headers: auth(owner.token),
      });
      expect(res.statusCode).toBe(409);
    });
  });
});

describe('billing API without Stripe', () => {
  useTestDb();
  let app: App;

  beforeAll(async () => {
    app = await createTestApp({ AUTH_RATE_LIMIT_MAX: '1000' }, { stripe: null });
  });
  afterAll(() => app.close());

  it('reports billing as not set up, and keeps everyone on Free', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { name: 'Ana', email: 'nostripe@example.com', password: PASSWORD },
    });
    const { accessToken } = authResponseSchema.parse(res.json());
    const billing = await app.inject({
      url: '/api/v1/billing',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(billingResponseSchema.parse(billing.json())).toMatchObject({
      plan: 'free',
      configured: false,
      canManage: false,
    });
    const checkout = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { plan: 'pro' },
    });
    expect(checkout.statusCode).toBe(503);
    expect(apiErrorSchema.parse(checkout.json()).error.code).toBe('BILLING_NOT_CONFIGURED');
  });
});
