import { query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import {
	userCreditBalance,
	coreCreditLedger,
	planPaymentTransactions,
	planPackages
} from '@repo/db/schema';
import { eq, and, desc, gte, inArray } from 'drizzle-orm';

function getDbAndUser() {
	const { locals } = getRequestEvent();
	if (!locals.db || !locals.user) throw error(401, 'Unauthorized');
	return { db: locals.db, userId: locals.user.id };
}

/** Credit balance with computed total */
export const getCreditBalance = query(async () => {
	const { db, userId } = getDbAndUser();

	const [record] = await db
		.select()
		.from(userCreditBalance)
		.where(eq(userCreditBalance.user, userId))
		.limit(1);

	if (!record) {
		return { balance: 0, lifetime_spent: 0, lifetime_purchased: 0, total_credits: 0 };
	}

	const balance = Number(record.balance ?? 0);
	const lifetimeSpent = Number(record.lifetimeSpent ?? 0);

	return {
		balance,
		lifetime_spent: lifetimeSpent,
		lifetime_purchased: Number(record.lifetimePurchased ?? 0),
		total_credits: balance + lifetimeSpent
	};
});

/** Credit usage aggregated by hourly slots (last 30 days) */
export const getHourlyCreditUsage = query(async () => {
	const { db, userId } = getDbAndUser();

	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const ledgerEntries = await db
		.select()
		.from(coreCreditLedger)
		.where(
			and(
				eq(coreCreditLedger.user, userId),
				eq(coreCreditLedger.type, 'debit'),
				gte(coreCreditLedger.created, thirtyDaysAgo.toISOString())
			)
		)
		.orderBy(desc(coreCreditLedger.created));

	const hourlyCredits = new Map<string, { credits: number; count: number }>();

	for (const entry of ledgerEntries) {
		const date = new Date(entry.created!);
		const hourKey = `${date.toISOString().slice(0, 10)} ${String(date.getHours()).padStart(2, '0')}:00`;

		const existing = hourlyCredits.get(hourKey) || { credits: 0, count: 0 };
		hourlyCredits.set(hourKey, {
			credits: existing.credits + Math.abs(Number(entry.creditsChanged ?? 0)),
			count: existing.count + 1
		});
	}

	const formatHour = (h: number) => {
		if (h === 0) return '12:00 AM';
		if (h === 12) return '12:00 PM';
		return h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;
	};

	return Array.from(hourlyCredits.entries())
		.map(([hourKey, data]) => {
			const [datePart, timePart] = hourKey.split(' ');
			const hour = parseInt(timePart.split(':')[0]);
			return {
				id: hourKey,
				date: datePart,
				timeRange: `${formatHour(hour)} - ${formatHour((hour + 1) % 24)}`,
				creditsUsed: data.credits,
				operationCount: data.count,
				timestamp: new Date(`${datePart}T${timePart}:00`).toISOString()
			};
		})
		.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
});

/** Payment transaction history */
export const getPaymentTransactions = query(async () => {
	const { db, userId } = getDbAndUser();

	const rows = await db
		.select({
			id: planPaymentTransactions.id,
			status: planPaymentTransactions.status,
			provider: planPaymentTransactions.provider,
			amount: planPaymentTransactions.amount,
			currency: planPaymentTransactions.currency,
			notes: planPaymentTransactions.notes,
			created: planPaymentTransactions.created,
			planId: planPaymentTransactions.plan
		})
		.from(planPaymentTransactions)
		.where(eq(planPaymentTransactions.user, userId))
		.orderBy(desc(planPaymentTransactions.created))
		.limit(50);

	// Batch-fetch referenced plans
	const planIds = [...new Set(rows.map((r) => r.planId).filter(Boolean))] as string[];
	const plans = planIds.length
		? await db
				.select({ id: planPackages.id, title: planPackages.title, credits: planPackages.credits })
				.from(planPackages)
				.where(inArray(planPackages.id, planIds))
		: [];
	const planMap = new Map(plans.map((p) => [p.id, p]));

	return rows.map((item) => {
		const plan = item.planId ? planMap.get(item.planId) : null;
		return {
			id: item.id,
			status: (item.status ?? 'pending') as 'completed' | 'pending' | 'failed' | 'refunded',
			provider: (item.provider ?? 'stripe') as 'stripe' | 'admin',
			amount: Number(item.amount ?? 0),
			currency: item.currency ?? 'USD',
			notes: item.notes ?? '',
			created: item.created,
			plan: plan ? { name: plan.title ?? '', credits: Number(plan.credits ?? 0) } : null
		};
	});
});
