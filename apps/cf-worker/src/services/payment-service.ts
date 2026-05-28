/**
 * Stripe Payment Service
 *
 * Handles:
 * - Checkout sessions for subscriptions and credit top-ups
 * - Customer Portal sessions for subscription management
 * - Webhook processing for payment events
 * - Stripe customer creation/linking
 */

import Stripe from 'stripe';
import type { Env } from '../types';
import type { Database } from '@repo/db/types';
import { planPackages, planPaymentTransactions, users, coreCreditLedger } from '@repo/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { generateId } from '@repo/db/id';
import {
	CreditLedgerType,
	CreditLedgerTransactionType,
	PaymentProvider,
	PaymentStatus
} from '@repo/db/types';
import { createLogger, formatError } from '../utils/logger';
import { getUserCreditBalance } from '../utils/billing';

const log = createLogger('PaymentService');

function getStripe(env: Env): Stripe {
	return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' });
}

// ============================================================================
// Checkout Sessions
// ============================================================================

export async function createCheckoutSession(
	env: Env,
	db: Database,
	params: { userId: string; packageId: string; returnUrl: string }
): Promise<{ url: string }> {
	const { userId, packageId, returnUrl } = params;

	const pkg = await db.query.planPackages.findFirst({
		where: eq(planPackages.id, packageId)
	});
	if (!pkg) throw new Error('Package not found');
	if (!pkg.stripePriceId) {
		throw new Error('Package has no Stripe price configured');
	}

	const customerId = await ensureStripeCustomer(env, db, userId);
	const stripe = getStripe(env);

	const mode = pkg.isSubscription ? 'subscription' : 'payment';
	const sessionParams: Stripe.Checkout.SessionCreateParams = {
		customer: customerId,
		mode,
		line_items: [{ price: pkg.stripePriceId, quantity: 1 }],
		success_url: `${returnUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${returnUrl}/cancelled`,
		metadata: { userId, packageId, type: pkg.isSubscription ? 'subscription' : 'topup' }
	};

	// Propagate metadata to subscription so webhook handlers can resolve the user
	if (mode === 'subscription') {
		sessionParams.subscription_data = { metadata: { userId, packageId } };
	}

	const session = await stripe.checkout.sessions.create(sessionParams);

	if (!session.url) {
		throw new Error('Stripe returned no checkout URL');
	}
	return { url: session.url };
}

// ============================================================================
// Customer Portal
// ============================================================================

export async function createPortalSession(
	env: Env,
	db: Database,
	params: { userId: string; returnUrl: string }
): Promise<{ url: string }> {
	const customerId = await ensureStripeCustomer(env, db, params.userId);
	const stripe = getStripe(env);

	const session = await stripe.billingPortal.sessions.create({
		customer: customerId,
		return_url: params.returnUrl
	});
	return { url: session.url };
}

// ============================================================================
// Webhook Handler
// ============================================================================

export async function handleWebhook(
	env: Env,
	db: Database,
	rawBody: string,
	signature: string
): Promise<void> {
	const stripe = getStripe(env);
	const event = await stripe.webhooks.constructEventAsync(
		rawBody,
		signature,
		env.STRIPE_WEBHOOK_SECRET
	);

	switch (event.type) {
		case 'checkout.session.completed':
			await onCheckoutComplete(db, event.data.object);
			break;
		case 'invoice.paid':
			await onInvoicePaid(db, event.data.object as Stripe.Invoice);
			break;
		case 'customer.subscription.updated':
			await onSubscriptionUpdated(db, event.data.object);
			break;
		case 'customer.subscription.deleted':
			await onSubscriptionDeleted(db, event.data.object);
			break;
		default:
			log.info('webhook_event_ignored', { type: event.type });
	}
}

// ============================================================================
// Webhook Event Handlers
// ============================================================================

async function onCheckoutComplete(db: Database, session: Stripe.Checkout.Session): Promise<void> {
	const userId = session.metadata?.userId;
	const packageId = session.metadata?.packageId;
	const type = session.metadata?.type;
	if (!userId || !packageId) {
		log.warn('checkout_missing_metadata', { sessionId: session.id });
		return;
	}

	const pkg = await db.query.planPackages.findFirst({
		where: eq(planPackages.id, packageId)
	});
	if (!pkg) {
		log.warn('checkout_package_not_found', { packageId });
		return;
	}

	const now = new Date().toISOString();

	// Record payment transaction
	await db.insert(planPaymentTransactions).values({
		id: generateId(),
		user: userId,
		plan: packageId,
		provider: PaymentProvider.stripe,
		providerPaymentId:
			(session.payment_intent as string) ?? (session.subscription as string) ?? session.id,
		status: PaymentStatus.completed,
		amount: String((session.amount_total ?? 0) / 100),
		currency: session.currency ?? 'usd',
		meta: { checkout_session_id: session.id, type },
		created: now,
		updated: now
	});

	if (type === 'topup') {
		await creditTopUp(db, userId, pkg);
	} else {
		// Subscription: update user's plan and credit their account
		await db.update(users).set({ plan: packageId, updated: now }).where(eq(users.id, userId));
		if (Number(pkg.credits) > 0) {
			await creditTopUp(db, userId, pkg);
		}
	}

	log.info('checkout_processed', { userId, packageId, type });
}

async function onInvoicePaid(db: Database, invoice: Stripe.Invoice): Promise<void> {
	// Only process subscription renewals — initial payment is handled by onCheckoutComplete
	if (invoice.billing_reason !== 'subscription_cycle') return;

	const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
	if (!customerId) return;

	const userId = await resolveUserIdFromCustomer(db, customerId);
	if (!userId) {
		log.warn('invoice_user_not_found', { customerId, invoiceId: invoice.id });
		return;
	}

	const lineItem = invoice.lines?.data?.[0];
	const priceRef = lineItem?.pricing?.price_details?.price;
	const priceId = typeof priceRef === 'string' ? priceRef : priceRef?.id;
	if (!priceId) return;

	const pkg = await db.query.planPackages.findFirst({
		where: eq(planPackages.stripePriceId, priceId)
	});

	if (pkg) {
		if (Number(pkg.credits) > 0) {
			await creditTopUp(db, userId, pkg);
		}
		log.info('subscription_renewed', { userId, planId: pkg.id, credits: pkg.credits });
	} else {
		log.warn('renewal_plan_not_found', { userId, priceId });
	}
}

async function onSubscriptionUpdated(
	db: Database,
	subscription: Stripe.Subscription
): Promise<void> {
	const userId = await resolveUserIdFromSubscription(db, subscription);
	if (!userId) return;

	const priceId = subscription.items.data[0]?.price?.id;
	if (!priceId) return;

	const newPlan = await db.query.planPackages.findFirst({
		where: eq(planPackages.stripePriceId, priceId)
	});

	if (!newPlan) {
		log.warn('subscription_plan_not_found', { userId, priceId });
		return;
	}

	// Check if plan actually changed — adjust credits for the difference
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
		columns: { plan: true }
	});
	const oldPlanId = user?.plan;

	if (oldPlanId && oldPlanId !== newPlan.id) {
		const oldPlan = await db.query.planPackages.findFirst({
			where: eq(planPackages.id, oldPlanId)
		});
		if (oldPlan) {
			const creditDiff = Number(newPlan.credits) - Number(oldPlan.credits);
			if (creditDiff !== 0) {
				await adjustCredits(
					db,
					userId,
					creditDiff,
					`Plan change: ${oldPlan.title} → ${newPlan.title}`
				);
			}
		}
	}

	const now = new Date().toISOString();
	await db.update(users).set({ plan: newPlan.id, updated: now }).where(eq(users.id, userId));
	log.info('subscription_updated', { userId, planId: newPlan.id });
}

async function onSubscriptionDeleted(
	db: Database,
	subscription: Stripe.Subscription
): Promise<void> {
	const userId = await resolveUserIdFromSubscription(db, subscription);
	if (!userId) return;

	// Clawback subscription credits before clearing the plan
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
		columns: { plan: true }
	});
	const planId = user?.plan;
	if (planId) {
		const pkg = await db.query.planPackages.findFirst({
			where: eq(planPackages.id, planId)
		});
		if (pkg && Number(pkg.credits) > 0) {
			await adjustCredits(db, userId, -Number(pkg.credits), `Subscription cancelled: ${pkg.title}`);
		} else if (!pkg) {
			log.warn('clawback_plan_not_found', { userId, planId });
		}
	}

	const now = new Date().toISOString();
	await db.update(users).set({ plan: '', updated: now }).where(eq(users.id, userId));
	log.info('subscription_cancelled', { userId });
}

// ============================================================================
// Credit Top-Up
// ============================================================================

async function creditTopUp(
	db: Database,
	userId: string,
	pkg: typeof planPackages.$inferSelect
): Promise<void> {
	const currentBalance = await getUserCreditBalance(db, userId);
	const credits = Number(pkg.credits);

	// Guard against NaN/invalid credits
	if (!Number.isFinite(credits) || credits <= 0) {
		log.warn('credit_topup_invalid_credits', { userId, pkgId: pkg.id, credits });
		return;
	}

	const newBalance = currentBalance + credits;
	const now = new Date().toISOString();

	await db.insert(coreCreditLedger).values({
		id: generateId(),
		user: userId,
		type: CreditLedgerType.credit,
		transactionType: CreditLedgerTransactionType.purchase,
		creditsChanged: String(credits),
		balanceBefore: String(currentBalance),
		balanceAfter: String(newBalance),
		description: `Credit top-up: ${pkg.title} (${credits} credits)`,
		created: now,
		updated: now
	});

	log.info('credits_added', { userId, credits, newBalance });
}

// ============================================================================
// User Resolution Helpers
// ============================================================================

async function resolveUserIdFromSubscription(
	db: Database,
	subscription: Stripe.Subscription
): Promise<string | null> {
	// Try subscription metadata first (set via subscription_data in checkout)
	if (subscription.metadata?.userId) return subscription.metadata.userId;

	// Fallback: look up user by Stripe customer ID
	const customerId =
		typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
	if (!customerId) return null;
	return resolveUserIdFromCustomer(db, customerId);
}

async function resolveUserIdFromCustomer(
	db: Database,
	stripeCustomerId: string
): Promise<string | null> {
	const user = await db.query.users.findFirst({
		where: eq(users.stripeCustomerId, stripeCustomerId),
		columns: { id: true }
	});
	return user?.id ?? null;
}

// ============================================================================
// Credit Adjustment
// ============================================================================

async function adjustCredits(
	db: Database,
	userId: string,
	creditDelta: number,
	description: string
): Promise<void> {
	// Guard against NaN input
	if (!Number.isFinite(creditDelta)) {
		log.warn('adjust_credits_invalid_delta', { userId, creditDelta, description });
		return;
	}

	const currentBalance = await getUserCreditBalance(db, userId);
	const newBalance = Math.max(0, currentBalance + creditDelta);
	const actualDelta = newBalance - currentBalance;

	if (actualDelta === 0) return;

	const isCredit = actualDelta > 0;
	const now = new Date().toISOString();
	await db.insert(coreCreditLedger).values({
		id: generateId(),
		user: userId,
		type: isCredit ? CreditLedgerType.credit : CreditLedgerType.debit,
		transactionType: CreditLedgerTransactionType.adjustment,
		creditsChanged: String(Math.abs(actualDelta)),
		balanceBefore: String(currentBalance),
		balanceAfter: String(newBalance),
		description,
		created: now,
		updated: now
	});

	log.info('credits_adjusted', { userId, delta: actualDelta, newBalance });
}

// ============================================================================
// Stripe Customer Management
// ============================================================================

async function ensureStripeCustomer(env: Env, db: Database, userId: string): Promise<string> {
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
		columns: { email: true, stripeCustomerId: true }
	});
	if (!user) throw new Error('User not found');
	if (user.stripeCustomerId) return user.stripeCustomerId;

	const stripe = getStripe(env);
	const customer = await stripe.customers.create({
		email: user.email ?? undefined,
		metadata: { userId }
	});

	const now = new Date().toISOString();
	await db
		.update(users)
		.set({ stripeCustomerId: customer.id, updated: now })
		.where(eq(users.id, userId));
	return customer.id;
}

// ============================================================================
// Plan Listing
// ============================================================================

export async function getAvailablePlans(db: Database) {
	return db
		.select()
		.from(planPackages)
		.where(and(eq(planPackages.isActive, true), eq(planPackages.isArchived, false)))
		.orderBy(asc(planPackages.type), asc(planPackages.credits));
}
