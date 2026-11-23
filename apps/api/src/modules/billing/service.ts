import {
  BILLING_ERROR_CODES,
  type BillingRedirect,
  type BillingResponse,
  type PaidPlanId,
} from '@montra/shared';
import type { FastifyBaseLogger } from 'fastify';
import Stripe from 'stripe';
import type { Db } from '../../db';
import type { Plan } from '../../generated/prisma/client';
import { AppError } from '../../lib/app-error';

/*
 * Stripe billing for the account (not a business: Business covers up to five).
 * Checkout and the billing portal are Stripe-hosted; Montra never sees a card.
 * The account's plan follows Stripe through the webhook, which always re-reads
 * the subscription from Stripe, so events arriving late or out of order cannot
 * leave a stale plan behind. Nothing in Montra is locked by plan yet.
 */

export interface BillingConfig {
  /** Null when no secret key is configured: billing then reports itself unavailable. */
  stripe: Stripe | null;
  webhookSecret: string | undefined;
  /** The Stripe product behind each paid plan. */
  products: Record<PaidPlanId, string>;
  /** Where Stripe sends the browser back to. */
  webAppUrl: string;
  /** The key is a test key: test cards only, no real money. */
  testMode: boolean;
}

const PLAN_IDS = { FREE: 'free', PRO: 'pro', BUSINESS: 'business' } as const satisfies Record<
  Plan,
  BillingResponse['plan']
>;

/** Statuses in which the subscriber keeps the plan they pay for (past_due: Stripe is retrying). */
const ENTITLED = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due']);

/** A subscription in one of these still exists, so a second checkout would charge twice. */
const LIVE = new Set<string>(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']);

const notConfigured = () =>
  new AppError(503, BILLING_ERROR_CODES.NOT_CONFIGURED, 'Billing is not set up yet.');

const providerError = () =>
  new AppError(
    502,
    BILLING_ERROR_CODES.PROVIDER_ERROR,
    'The payment provider could not be reached. Try again in a moment.',
  );

/** Runs a Stripe call, turning its failures into a message safe to show. */
async function stripeCall<T>(log: FastifyBaseLogger, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof AppError) throw error;
    log.error({ err: error }, 'Stripe request failed');
    throw providerError();
  }
}

async function isOwnerAnywhere(db: Db, userId: string) {
  const owned = await db.membership.count({ where: { userId, role: 'OWNER' } });
  return owned > 0;
}

export async function getBilling(
  db: Db,
  config: BillingConfig,
  userId: string,
): Promise<BillingResponse> {
  const [user, canSubscribe] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        plan: true,
        subscriptionStatus: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
        stripeCustomerId: true,
      },
    }),
    isOwnerAnywhere(db, userId),
  ]);
  return {
    plan: PLAN_IDS[user.plan],
    status: user.subscriptionStatus,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
    configured: config.stripe !== null,
    testMode: config.stripe !== null && config.testMode,
    canSubscribe,
    canManage: config.stripe !== null && user.stripeCustomerId !== null,
  };
}

/** The monthly price to charge for a plan: its product's default price in Stripe. */
async function priceFor(stripe: Stripe, config: BillingConfig, plan: PaidPlanId) {
  const unavailable = new AppError(
    503,
    BILLING_ERROR_CODES.PLAN_UNAVAILABLE,
    'This plan is not available to buy yet.',
  );
  const productId = config.products[plan];
  if (!productId) throw unavailable;
  let product: Stripe.Product;
  try {
    product = await stripe.products.retrieve(productId);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError) throw unavailable;
    throw error;
  }
  const price = product.default_price;
  const priceId = typeof price === 'string' ? price : price?.id;
  if (!product.active || !priceId) throw unavailable;
  return priceId;
}

export async function startCheckout(
  db: Db,
  config: BillingConfig,
  log: FastifyBaseLogger,
  userId: string,
  plan: PaidPlanId,
): Promise<BillingRedirect> {
  const { stripe } = config;
  if (!stripe) throw notConfigured();
  if (!(await isOwnerAnywhere(db, userId))) {
    throw new AppError(
      403,
      BILLING_ERROR_CODES.OWNERS_ONLY,
      'Only business owners can choose a paid plan.',
    );
  }

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
    },
  });
  if (user.stripeSubscriptionId && LIVE.has(user.subscriptionStatus ?? '')) {
    throw new AppError(
      409,
      BILLING_ERROR_CODES.ALREADY_SUBSCRIBED,
      'You already have a subscription. Change or cancel it in Manage billing.',
    );
  }

  return stripeCall(log, async () => {
    const price = await priceFor(stripe, config, plan);

    let customer = user.stripeCustomerId;
    if (!customer) {
      const created = await stripe.customers.create(
        { email: user.email, name: user.name, metadata: { userId } },
        // A double click creates one customer, not two.
        { idempotencyKey: `montra-customer-${userId}` },
      );
      customer = created.id;
      await db.user.update({ where: { id: userId }, data: { stripeCustomerId: customer } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: userId,
      line_items: [{ price, quantity: 1 }],
      subscription_data: { metadata: { userId } },
      success_url: `${config.webAppUrl}/plans?checkout=success`,
      cancel_url: `${config.webAppUrl}/plans?checkout=cancelled`,
    });
    if (!session.url) throw providerError();
    return { url: session.url };
  });
}

export async function openPortal(
  db: Db,
  config: BillingConfig,
  log: FastifyBaseLogger,
  userId: string,
): Promise<BillingRedirect> {
  const { stripe } = config;
  if (!stripe) throw notConfigured();
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  const customer = user.stripeCustomerId;
  if (!customer) {
    throw new AppError(
      409,
      BILLING_ERROR_CODES.NO_SUBSCRIPTION,
      'There is no billing to manage yet.',
    );
  }
  return stripeCall(log, async () => {
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${config.webAppUrl}/plans`,
    });
    return { url: session.url };
  });
}

/** The plan a subscription pays for, from its first item's product. */
function planOf(subscription: Stripe.Subscription, config: BillingConfig): Plan | null {
  const product = subscription.items.data[0]?.price.product;
  const productId = typeof product === 'string' ? product : product?.id;
  if (productId && productId === config.products.pro) return 'PRO';
  if (productId && productId === config.products.business) return 'BUSINESS';
  return null;
}

/** Copies a subscription's current state from Stripe onto the account it belongs to. */
async function syncSubscription(
  db: Db,
  config: BillingConfig,
  log: FastifyBaseLogger,
  subscriptionId: string,
  userIdHint: string | null | undefined,
) {
  const stripe = config.stripe!;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const userIdFromStripe = userIdHint || subscription.metadata.userId;

  const user = await db.user.findFirst({
    where: {
      OR: [
        { stripeCustomerId: customerId },
        ...(userIdFromStripe ? [{ id: userIdFromStripe }] : []),
      ],
    },
    select: { id: true, stripeSubscriptionId: true, subscriptionStatus: true },
  });
  if (!user) {
    log.warn({ subscriptionId, customerId }, 'Stripe subscription for an unknown account; ignored');
    return;
  }

  // An old subscription ending must not undo a newer one that is still running.
  const replaced =
    user.stripeSubscriptionId !== null &&
    user.stripeSubscriptionId !== subscription.id &&
    LIVE.has(user.subscriptionStatus ?? '');
  if (replaced && !LIVE.has(subscription.status)) return;

  const plan = planOf(subscription, config);
  if (!plan) log.warn({ subscriptionId }, 'Stripe subscription for an unknown product');
  const periodEnd = subscription.items.data[0]?.current_period_end;

  await db.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      plan: plan && ENTITLED.has(subscription.status) ? plan : 'FREE',
      cancelAtPeriodEnd: subscription.cancel_at_period_end || subscription.cancel_at !== null,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    },
  });
}

const SUBSCRIPTION_EVENTS = new Set<string>([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
]);

/** Verifies an event from Stripe and brings the account's plan up to date. */
export async function handleWebhook(
  db: Db,
  config: BillingConfig,
  log: FastifyBaseLogger,
  rawBody: string,
  signature: string | undefined,
) {
  const { stripe, webhookSecret } = config;
  if (!stripe || !webhookSecret) throw notConfigured();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature ?? '', webhookSecret);
  } catch {
    throw new AppError(400, BILLING_ERROR_CODES.INVALID_SIGNATURE, 'Invalid webhook signature.');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.mode === 'subscription' && session.subscription) {
      const id =
        typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
      await syncSubscription(db, config, log, id, session.client_reference_id);
    }
  } else if (SUBSCRIPTION_EVENTS.has(event.type)) {
    const subscription = event.data.object as Stripe.Subscription;
    await syncSubscription(db, config, log, subscription.id, subscription.metadata.userId);
  }
}
