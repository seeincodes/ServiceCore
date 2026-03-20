import db from '../../shared/database/connection';
import logger from '../../shared/utils/logger';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PRICE_PER_EMPLOYEE = 500; // $5.00 in cents
const FREE_TIER_LIMIT = 5;

let stripe: any = null;

function getStripe() {
  if (!stripe && STRIPE_SECRET_KEY) {
    // Dynamic import to avoid crash when stripe isn't configured
    const Stripe = require('stripe');
    stripe = new Stripe(STRIPE_SECRET_KEY);
  }
  return stripe;
}

/**
 * Create a Stripe customer for a new org.
 */
export async function createCustomer(
  orgId: string,
  email: string,
  name: string,
): Promise<string | null> {
  const client = getStripe();
  if (!client) {
    logger.warn('Stripe not configured, skipping customer creation', { orgId });
    return null;
  }

  try {
    const customer = await client.customers.create({
      email,
      name,
      metadata: { orgId },
    });

    await db('orgs').where({ id: orgId }).update({ stripe_customer_id: customer.id });

    logger.info('Stripe customer created', { orgId, customerId: customer.id });
    return customer.id;
  } catch (err) {
    logger.error('Stripe customer creation failed', { orgId, error: (err as Error).message });
    throw err;
  }
}

/**
 * Calculate billing for an org based on active employee count.
 * Freemium: first 5 employees free, then $5/employee/month.
 */
export async function calculateBilling(orgId: string): Promise<{
  activeEmployees: number;
  billableEmployees: number;
  monthlyAmount: number;
  isFreeTier: boolean;
}> {
  const activeCount = await db('users')
    .where({ org_id: orgId, role: 'employee', is_active: true })
    .count('id as count')
    .first();

  const employees = Number(activeCount?.count || 0);
  const billable = Math.max(0, employees - FREE_TIER_LIMIT);
  const amount = billable * PRICE_PER_EMPLOYEE;

  return {
    activeEmployees: employees,
    billableEmployees: billable,
    monthlyAmount: amount, // in cents
    isFreeTier: billable === 0,
  };
}

/**
 * Create or update a Stripe subscription for an org.
 */
export async function syncSubscription(orgId: string): Promise<void> {
  const client = getStripe();
  if (!client) return;

  const org = await db('orgs').where({ id: orgId }).first();
  if (!org?.stripe_customer_id) return;

  const billing = await calculateBilling(orgId);

  if (billing.isFreeTier) {
    logger.info('Org on free tier, no subscription needed', {
      orgId,
      employees: billing.activeEmployees,
    });
    return;
  }

  logger.info('Stripe subscription sync', {
    orgId,
    employees: billing.activeEmployees,
    billable: billing.billableEmployees,
    monthlyAmount: `$${(billing.monthlyAmount / 100).toFixed(2)}`,
  });

  // TODO: Create/update actual Stripe subscription when price IDs are configured
  // await client.subscriptions.create({
  //   customer: org.stripe_customer_id,
  //   items: [{ price: STRIPE_PRICE_ID, quantity: billing.billableEmployees }],
  // });
}
