import { command, form, getRequestEvent, query } from '$app/server';
import { asTagCatalogWithNamespace } from '$lib/utils/tag-helpers';
import {
	users,
	accounts,
	userCostStats,
	userCustomization,
	chats,
	userUploads,
	coreTokenLedger,
	coreCreditLedger,
	chatMessages,
	chatMessagesDebug,
	chatMessagesAttachments,
	viewUserDailyUsage,
	viewUserModelUsage,
	viewUserProviderUsage,
	viewChatCosts,
	userCreditBalance,
	planPackages,
	coreRolePermissions,
	aiAgents,
	configTagCatalog,
	configTagNamespaces,
	userProfileSummaries,
	userOnboardingAssignments,
	userOnboardingAuditEvents,
	configOnboardingProfiles
} from '@repo/db/schema';
import { generateId } from '@repo/db/id';
import { MemoryGraphService } from '@repo/db/graph';
import type { ProfileSchemaSection } from '@repo/db/graph/types';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { z } from 'zod';

// Helper to get Durable Object stub
// function getOnboardingSession() {
// 	const { platform, locals } = getRequestEvent();

// 	if (!locals.user) throw error(401, 'Unauthorized');
// 	if (!platform?.env?.ONBOARDING_SESSION) throw error(500, 'Durable Objects not available');

// 	const id = platform.env.ONBOARDING_SESSION.idFromName(locals.user.id);
// 	return platform.env.ONBOARDING_SESSION.get(id);
// }

function getUserIdFromParams() {
	const { params } = getRequestEvent();
	const userId = params.id;
	if (!userId) throw error(400, 'Missing user id');
	return userId;
}

export const getUserDetails = query(async () => {
	const { locals } = getRequestEvent();
	const userId = getUserIdFromParams();
	const db = locals.db;

	const [user] = await db.select().from(users).where(eq(users.id, userId));
	if (!user) throw error(404, 'User not found');

	const [plan, role] = await Promise.all([
		(async () => {
			if (!user.plan) return null;
			const [record] = await db
				.select()
				.from(planPackages)
				.where(eq(planPackages.id, user.plan))
				.limit(1);
			return record ?? null;
		})(),
		(async () => {
			if (!user.role) return null;
			const [record] = await db
				.select()
				.from(coreRolePermissions)
				.where(eq(coreRolePermissions.id, user.role))
				.limit(1);
			return record ?? null;
		})()
	]);

	return {
		...user,
		avatarUrl: user.avatar || null,
		plan,
		role,
		expand: {
			plan: plan ?? undefined,
			role: role ?? undefined
		}
	};
});

export const getUserCostStats = query(async () => {
	const { locals } = getRequestEvent();
	const userId = getUserIdFromParams();
	const db = locals.db;

	const [statsRecord] = await db
		.select()
		.from(userCostStats)
		.where(eq(userCostStats.user, userId))
		.limit(1);

	return {
		current_balance: Number(statsRecord?.currentBalance ?? 0),
		lifetime_purchased: Number(statsRecord?.lifetimePurchased ?? 0),
		lifetime_spent: Number(statsRecord?.lifetimeSpent ?? 0),
		lifetime_cost_usd: Number(statsRecord?.lifetimeCostUsd ?? 0),
		total_tokens: Number(statsRecord?.totalTokens ?? 0)
	};
});

export const getUserCustomizations = query(async () => {
	const { locals } = getRequestEvent();
	const userId = getUserIdFromParams();
	const db = locals.db;

	return await db
		.select()
		.from(userCustomization)
		.where(eq(userCustomization.user, userId))
		.orderBy(desc(userCustomization.updated));
});

export const getUserTags = query(async () => {
	const { locals } = getRequestEvent();
	const userId = getUserIdFromParams();
	const db = locals.db;

	const [record] = await db
		.select()
		.from(userCustomization)
		.where(and(eq(userCustomization.user, userId), eq(userCustomization.key, 'tags')))
		.limit(1);

	if (!record) return { tags: [] as string[], recordId: null };
	const value = record.value as { tags?: string[] } | null;
	return { tags: value?.tags ?? [], recordId: record.id };
});

export const getTagCatalogForUser = query(async () => {
	const { locals } = getRequestEvent();
	const db = locals.db;

	const rows = await db
		.select()
		.from(configTagCatalog)
		.leftJoin(configTagNamespaces, eq(configTagCatalog.namespace, configTagNamespaces.id))
		.orderBy(configTagCatalog.namespace, configTagCatalog.tag);

	return asTagCatalogWithNamespace(
		rows.map((r) => ({
			...r.config_tag_catalog,
			expand: { namespace: r.config_tag_namespaces ?? undefined }
		}))
	);
});

const updateUserTagsSchema = z.object({
	userId: z.string(),
	tags: z.array(z.string().regex(/^[a-z0-9_-]+:[a-z0-9_-]+$/i, 'Tag must be namespace:value')),
	recordId: z.string().nullable()
});

export const updateUserTagsAction = command(updateUserTagsSchema, async (data) => {
	const { locals } = getRequestEvent();
	const db = locals.db;
	const now = new Date().toISOString();

	if (data.recordId) {
		await db
			.update(userCustomization)
			.set({ value: { tags: data.tags }, updated: now })
			.where(eq(userCustomization.id, data.recordId));
	} else {
		await db.insert(userCustomization).values({
			id: generateId(),
			user: data.userId,
			key: 'tags',
			value: { tags: data.tags },
			created: now,
			updated: now
		});
	}
	return { success: true };
});

export const getUserMemory = query(async () => {
	const { locals } = getRequestEvent();
	const userId = getUserIdFromParams();

	if (!locals.db) {
		return {
			nodes: [],
			edges: [],
			stats: {
				nodeCount: 0,
				edgeCount: 0,
				nodesByType: {},
				edgesByRelationship: {}
			}
		};
	}

	try {
		const graph = new MemoryGraphService(locals.db, userId);
		const graphData = await graph.getFullGraphForManager({ limit: 500 });
		return graphData;
	} catch (err) {
		console.error('Failed to fetch graph memory:', err);
		return {
			nodes: [],
			edges: [],
			stats: {
				nodeCount: 0,
				edgeCount: 0,
				nodesByType: {},
				edgesByRelationship: {}
			}
		};
	}
});

export const getChatMessages = query(z.string(), async (chatId) => {
	const { locals } = getRequestEvent();
	if (!chatId) return [];
	const db = locals.db;

	const messages = await db
		.select()
		.from(chatMessages)
		.where(eq(chatMessages.chat, chatId))
		.orderBy(chatMessages.created);

	if (messages.length === 0) return [];

	const msgIds = messages.map((m) => m.id);
	const attachmentLinks = await db
		.select()
		.from(chatMessagesAttachments)
		.innerJoin(userUploads, eq(chatMessagesAttachments.targetId, userUploads.id))
		.where(inArray(chatMessagesAttachments.sourceId, msgIds));

	const attachMap = new Map<string, (typeof userUploads.$inferSelect)[]>();
	for (const row of attachmentLinks) {
		const arr = attachMap.get(row['chat_messages__attachments'].sourceId) ?? [];
		arr.push(row.user_uploads);
		attachMap.set(row['chat_messages__attachments'].sourceId, arr);
	}

	return messages.map((m) => ({
		...m,
		expand: { attachments: attachMap.get(m.id) ?? [] }
	}));
});

/**
 * Debug message with full AI input/output for user details page
 */
export interface ChatDebugMessage {
	id: string;
	chatId: string;
	userId?: string;
	agentId?: string;
	role: 'user' | 'assistant' | 'system';
	userMessage?: string;
	systemPrompt?: string;
	fullMessagesJson?: Array<{ role: string; content: string }>;
	assistantResponse?: string;
	modelId?: string;
	provider?: string;
	inputTokens?: number;
	outputTokens?: number;
	costUsd?: number;
	latencyMs?: number;
	contextData?: Record<string, unknown>;
	created: string;
}

/**
 * Get debug messages for a chat (full AI input/output)
 */
export const getChatDebugMessages = query(
	z.string(),
	async (chatId): Promise<ChatDebugMessage[]> => {
		const { locals } = getRequestEvent();
		if (!chatId) return [];

		try {
			const logs = await locals.db
				.select()
				.from(chatMessagesDebug)
				.where(eq(chatMessagesDebug.chat, chatId))
				.orderBy(chatMessagesDebug.created);

			return logs.map((log) => ({
				id: log.id,
				chatId: log.chat ?? '',
				userId: log.user ?? undefined,
				agentId: log.agent ?? undefined,
				role: log.role as 'user' | 'assistant' | 'system',
				userMessage: log.userMessage ?? undefined,
				systemPrompt: log.systemPrompt ?? undefined,
				fullMessagesJson: log.fullMessagesJson as
					| Array<{ role: string; content: string }>
					| undefined,
				assistantResponse: log.assistantResponse ?? undefined,
				modelId: log.modelId ?? undefined,
				provider: log.provider ?? undefined,
				inputTokens: log.inputTokens ? Number(log.inputTokens) : undefined,
				outputTokens: log.outputTokens ? Number(log.outputTokens) : undefined,
				costUsd: log.costUsd ? Number(log.costUsd) : undefined,
				latencyMs: log.latencyMs ? Number(log.latencyMs) : undefined,
				contextData: log.contextData as Record<string, unknown> | undefined,
				created: log.created ?? ''
			}));
		} catch {
			return [];
		}
	}
);

// ============================================================================
// Per-User Analytics (Phase 3)
// ============================================================================

const analyticsRangeSchema = z.object({
	range: z.enum(['7d', '30d', '90d', 'all'])
});

function safeNum(v: unknown): number {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}

function round6(n: number) {
	return Math.round(n * 1_000_000) / 1_000_000;
}

/**
 * Per-user analytics: daily spend time-series, model/provider/category breakdowns
 */
export const getUserAnalytics = query(analyticsRangeSchema, async ({ range }) => {
	const { locals } = getRequestEvent();
	const userId = getUserIdFromParams();
	const db = locals.db;

	const userFilter = eq(viewUserDailyUsage.user, userId);

	let dayFilter = userFilter;
	if (range !== 'all') {
		const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
		const start = new Date();
		start.setUTCHours(0, 0, 0, 0);
		start.setUTCDate(start.getUTCDate() - (days - 1));
		const startDay = start.toISOString().slice(0, 10);
		dayFilter = and(userFilter, sql`${viewUserDailyUsage.day} >= ${startDay}`)!;
	}

	const [dailyUsage, modelUsage, providerUsage] = await Promise.all([
		db.select().from(viewUserDailyUsage).where(dayFilter).orderBy(viewUserDailyUsage.day),
		db
			.select()
			.from(viewUserModelUsage)
			.where(eq(viewUserModelUsage.user, userId))
			.orderBy(desc(viewUserModelUsage.totalCost)),
		db
			.select()
			.from(viewUserProviderUsage)
			.where(eq(viewUserProviderUsage.user, userId))
			.orderBy(desc(viewUserProviderUsage.totalCost))
	]);

	// Category breakdown from token ledger via SQL GROUP BY
	const tokenLedgerConditions = [eq(coreTokenLedger.user, userId)];
	if (range !== 'all') {
		const cutoff = new Date(
			Date.now() - (range === '7d' ? 7 : range === '30d' ? 30 : 90) * 86400000
		).toISOString();
		tokenLedgerConditions.push(sql`${coreTokenLedger.created} >= ${cutoff}`);
	}

	const categoryRows = await db
		.select({
			category: coreTokenLedger.category,
			cost: sql<string>`sum(${coreTokenLedger.costUsd})`,
			tokens: sql<string>`sum(${coreTokenLedger.tokens})`,
			count: sql<number>`count(*)::int`
		})
		.from(coreTokenLedger)
		.where(and(...tokenLedgerConditions))
		.groupBy(coreTokenLedger.category);

	const timeSeries = dailyUsage.map((r) => ({
		day: r.day ?? '',
		costUsd: round6(safeNum(r.totalCost)),
		tokens: Math.round(safeNum(r.totalTokens)),
		requestCount: safeNum(r.requestCount)
	}));

	const modelBreakdown = modelUsage.map((r) => ({
		model: r.model,
		provider: r.provider || 'unknown',
		costUsd: round6(safeNum(r.totalCost)),
		tokens: Math.round(safeNum(r.totalTokens)),
		requestCount: safeNum(r.requestCount)
	}));

	const providerBreakdown = providerUsage.map((r) => ({
		provider: r.provider || 'unknown',
		costUsd: round6(safeNum(r.totalCost)),
		tokens: Math.round(safeNum(r.totalTokens)),
		requestCount: safeNum(r.requestCount)
	}));

	const categoryBreakdown = categoryRows
		.map((r) => ({
			category: r.category || 'unknown',
			costUsd: round6(safeNum(r.cost)),
			tokens: Math.round(safeNum(r.tokens)),
			requestCount: r.count
		}))
		.sort((a, b) => b.tokens - a.tokens);

	const totalCost = timeSeries.reduce((s, d) => s + d.costUsd, 0);
	const totalTokens = timeSeries.reduce((s, d) => s + d.tokens, 0);

	return {
		range,
		summary: {
			totalCostUsd: round6(totalCost),
			totalTokens,
			totalRequests: timeSeries.reduce((s, d) => s + d.requestCount, 0),
			topModel: modelBreakdown[0]?.model ?? null,
			topProvider: providerBreakdown[0]?.provider ?? null
		},
		timeSeries,
		modelBreakdown,
		providerBreakdown,
		categoryBreakdown
	};
});

/**
 * Per-user chat stats — per-chat cost summaries from view_chat_costs
 */
export const getUserChatStats = query(async () => {
	const { locals } = getRequestEvent();
	const userId = getUserIdFromParams();
	const db = locals.db;

	const chatCosts = await db
		.select()
		.from(viewChatCosts)
		.where(eq(viewChatCosts.user, userId))
		.orderBy(desc(viewChatCosts.totalCostUsd));

	return chatCosts.map((r) => ({
		chatId: r.chat,
		totalCostUsd: round6(safeNum(r.totalCostUsd)),
		totalInputTokens: Math.round(safeNum(r.totalInputTokens)),
		totalOutputTokens: Math.round(safeNum(r.totalOutputTokens)),
		totalMessages: safeNum(r.totalMessages),
		avgLatencyMs: Math.round(safeNum(r.avgLatencyMs)),
		modelsUsed: r.modelsUsed ?? '',
		firstMessageAt: r.firstMessageAt ?? '',
		lastMessageAt: r.lastMessageAt ?? ''
	}));
});

/**
 * Per-chat analytics — per-turn cost/token/latency arrays for charts
 */
export const getChatAnalytics = query(z.string(), async (chatId) => {
	const { locals } = getRequestEvent();
	if (!chatId) return null;
	const db = locals.db;

	try {
		const [[chatRecord], debugLogs] = await Promise.all([
			db.select().from(chats).where(eq(chats.id, chatId)),
			db
				.select()
				.from(chatMessagesDebug)
				.where(and(eq(chatMessagesDebug.chat, chatId), eq(chatMessagesDebug.role, 'assistant')))
				.orderBy(chatMessagesDebug.sequenceNumber)
		]);

		let agentName: string | null = null;
		if (chatRecord?.agent) {
			const [agent] = await db
				.select({ name: aiAgents.name })
				.from(aiAgents)
				.where(eq(aiAgents.id, chatRecord.agent));
			agentName = agent?.name ?? null;
		}

		const turns = debugLogs.map((log) => {
			const contextData = log.contextData as Record<string, unknown> | null;
			return {
				sequenceNumber: safeNum(log.sequenceNumber),
				modelId: log.modelId || 'unknown',
				provider: log.provider || 'unknown',
				inputTokens: safeNum(log.inputTokens),
				outputTokens: safeNum(log.outputTokens),
				costUsd: round6(safeNum(log.costUsd)),
				latencyMs: safeNum(log.latencyMs),
				contextData: {
					factsCount: safeNum(contextData?.factsCount),
					attachedFilesCount: safeNum(contextData?.attachedFilesCount),
					docsCount: safeNum(contextData?.docsCount),
					knowledgeCount: safeNum(contextData?.knowledgeCount)
				},
				created: log.created ?? ''
			};
		});

		const totalCost = turns.reduce((s, t) => s + t.costUsd, 0);
		const totalInputTokens = turns.reduce((s, t) => s + t.inputTokens, 0);
		const totalOutputTokens = turns.reduce((s, t) => s + t.outputTokens, 0);
		const avgLatency =
			turns.length > 0 ? Math.round(turns.reduce((s, t) => s + t.latencyMs, 0) / turns.length) : 0;

		const modelsUsed = [...new Set(turns.map((t) => t.modelId))];
		const providersUsed = [...new Set(turns.map((t) => t.provider))];
		const firstMessageAt = turns[0]?.created ?? null;
		const lastMessageAt = turns[turns.length - 1]?.created ?? null;

		let durationMs = 0;
		if (firstMessageAt && lastMessageAt) {
			durationMs = new Date(lastMessageAt).getTime() - new Date(firstMessageAt).getTime();
		}

		// Extract agent info
		return {
			chatId,
			chat: {
				title: chatRecord?.title || null,
				source: chatRecord?.source || null,
				agentId: chatRecord?.agent || null,
				agentName
			},
			summary: {
				totalCostUsd: round6(totalCost),
				totalInputTokens,
				totalOutputTokens,
				totalTokens: totalInputTokens + totalOutputTokens,
				messageCount: turns.length,
				avgLatencyMs: avgLatency,
				durationMs,
				modelsUsed,
				providersUsed
			},
			turns
		};
	} catch {
		return null;
	}
});

export const banUser = form(
	z.object({
		userId: z.string().min(1),
		banned: z.union([z.literal('true'), z.literal('false')]).transform((value) => value === 'true')
	}),
	async ({ userId, banned }) => {
		const { locals } = getRequestEvent();
		const accountStatus = banned ? 'banned' : 'active';
		const now = new Date().toISOString();

		const [record] = await locals.db
			.update(users)
			.set({ accountStatus, updated: now })
			.where(eq(users.id, userId))
			.returning();
		return { success: true, record };
	}
);

export const adminSetPassword = command(
	z.object({
		userId: z.string().min(1),
		password: z.string().min(8, 'Password must be at least 8 characters')
	}),
	async ({ userId, password }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;

		// Hash with PBKDF2-SHA256 (same as auth.ts)
		const salt = crypto.getRandomValues(new Uint8Array(16));
		const key = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(password),
			'PBKDF2',
			false,
			['deriveBits']
		);
		const derived = await crypto.subtle.deriveBits(
			{ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
			key,
			256
		);
		const saltHex = [...salt].map((b) => b.toString(16).padStart(2, '0')).join('');
		const hashHex = [...new Uint8Array(derived)]
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
		const hashedPassword = `pbkdf2:100000:${saltHex}:${hashHex}`;

		// Find or create credential account for this user
		const [existing] = await db
			.select()
			.from(accounts)
			.where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential')));

		const now = new Date().toISOString();

		if (existing) {
			await db
				.update(accounts)
				.set({ password: hashedPassword, updatedAt: now })
				.where(eq(accounts.id, existing.id));
		} else {
			await db.insert(accounts).values({
				id: generateId(),
				userId,
				accountId: userId,
				providerId: 'credential',
				password: hashedPassword,
				createdAt: now,
				updatedAt: now
			});
		}

		return { success: true };
	}
);

export const updateUserCredits = form(
	z.object({
		userId: z.string().min(1),
		type: z.enum(['credit', 'debit']),
		amount: z.union([z.string(), z.number()]).transform((value, ctx) => {
			const num = typeof value === 'number' ? value : Number(value);
			if (!Number.isFinite(num) || num <= 0) {
				ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Amount must be a positive number' });
				return z.NEVER;
			}
			return num;
		}),
		description: z.string().optional()
	}),
	async ({ userId, type, amount, description }) => {
		const { locals } = getRequestEvent();
		const db = locals.db;

		// Get current balance from the view
		const [balanceRecord] = await db
			.select()
			.from(userCreditBalance)
			.where(eq(userCreditBalance.user, userId))
			.limit(1);
		const currentBalance = Number(balanceRecord?.balance) || 0;

		// Calculate new balance
		const balanceChange = type === 'credit' ? amount : -amount;
		const newBalance = currentBalance + balanceChange;
		const now = new Date().toISOString();

		await db.insert(coreCreditLedger).values({
			id: generateId(),
			user: userId,
			type,
			transactionType: 'adjustment',
			creditsChanged: String(amount),
			balanceBefore: String(currentBalance),
			balanceAfter: String(newBalance),
			description,
			notes: description,
			created: now,
			updated: now
		});

		return { success: true };
	}
);

// Toggle a node's hidden_from_agent status
export const toggleNodeHidden = command(
	z.object({
		nodeId: z.string().min(1),
		hidden: z.boolean()
	}),
	async ({ nodeId, hidden }) => {
		const { locals } = getRequestEvent();
		const userId = getUserIdFromParams();

		if (!locals.db) throw error(503, 'Database unavailable');

		const graph = new MemoryGraphService(locals.db, userId);
		const currentNode = await graph.getNode(nodeId);
		if (!currentNode) throw error(404, 'Node not found');

		await graph.upsertNode({
			...currentNode,
			data: { ...currentNode.data, hidden_from_agent: hidden },
			updatedAt: new Date().toISOString()
		});

		return { success: true, hidden };
	}
);

// Delete a memory node
export const deleteMemoryNode = command(
	z.object({
		nodeId: z.string().min(1)
	}),
	async ({ nodeId }) => {
		const { locals } = getRequestEvent();
		const userId = getUserIdFromParams();

		if (!locals.db) throw error(503, 'Database unavailable');

		const graph = new MemoryGraphService(locals.db, userId);
		await graph.deleteNode(nodeId);

		return { success: true };
	}
);

// ============================================================================
// User Profile Summary
// ============================================================================

/**
 * Get user profile summary - read from DB cache
 */
export const getUserProfileSummary = query(async () => {
	const { locals } = getRequestEvent();
	const userId = getUserIdFromParams();

	if (!locals.db) throw error(503, 'Database unavailable');

	const [row] = await locals.db
		.select()
		.from(userProfileSummaries)
		.where(eq(userProfileSummaries.user, userId))
		.orderBy(desc(userProfileSummaries.generatedAt))
		.limit(1);

	if (row?.summaryText) {
		return {
			summary: row.summaryText,
			generatedAt: row.generatedAt ?? new Date().toISOString(),
			fromCache: true,
			regenerating: false
		};
	}
	return {
		summary: 'No profile summary generated yet.',
		generatedAt: new Date().toISOString(),
		fromCache: false,
		regenerating: false
	};
});

/**
 * Force regenerate user profile summary — triggers via cf-worker
 */
export const refreshUserProfileSummary = command(async () => {
	const { platform } = getRequestEvent();
	const userId = getUserIdFromParams();

	try {
		if (platform?.env?.CF_WORKER) {
			await platform.env.CF_WORKER.regenerateProfileSummary({ userId });
		}
		return { success: true };
	} catch (err) {
		console.error('Failed to refresh profile summary:', err);
		throw error(500, 'Failed to refresh profile summary');
	}
});

// ============================================================================
// User Profile Markdown (Structured Profile.md)
// ============================================================================

/**
 * Get compiled Profile.md — the structured profile from profiler data.
 * Unlike getUserProfileSummary (LLM narrative), this is the raw structured markdown.
 */
export const getUserProfileMarkdown = query(async () => {
	const { platform, locals } = getRequestEvent();
	const userId = getUserIdFromParams();

	if (!locals.db) throw error(503, 'Database unavailable');

	try {
		const graph = new MemoryGraphService(locals.db, userId);

		// Load merged schema from all active profiler agents
		let schema: ProfileSchemaSection[] | undefined;
		try {
			if (platform?.env?.CF_WORKER) {
				const result = await platform.env.CF_WORKER.getProfilerSchemas({ userId });
				if (result.sections.length > 0) schema = result.sections;
			}
		} catch {
			// Schema is optional — compile without it
		}

		const markdown = await graph.compileProfileMarkdown(schema);
		return { markdown };
	} catch (err) {
		console.error('Failed to compile profile markdown:', err);
		throw error(500, 'Failed to compile profile markdown');
	}
});

export const getUserOnboardingAudit = query(async () => {
	const { locals } = getRequestEvent();
	const userId = getUserIdFromParams();
	const db = locals.db;

	const [assignments, auditEvents] = await Promise.all([
		db
			.select({
				id: userOnboardingAssignments.id,
				profile: userOnboardingAssignments.profile,
				campaign: userOnboardingAssignments.campaign,
				inviteCode: userOnboardingAssignments.inviteCode,
				resolutionSource: userOnboardingAssignments.resolutionSource,
				lockedAt: userOnboardingAssignments.lockedAt,
				startedAt: userOnboardingAssignments.startedAt,
				completedAt: userOnboardingAssignments.completedAt,
				created: userOnboardingAssignments.created,
				profileName: configOnboardingProfiles.name
			})
			.from(userOnboardingAssignments)
			.leftJoin(
				configOnboardingProfiles,
				eq(userOnboardingAssignments.profile, configOnboardingProfiles.id)
			)
			.where(eq(userOnboardingAssignments.user, userId))
			.orderBy(desc(userOnboardingAssignments.created)),
		db
			.select()
			.from(userOnboardingAuditEvents)
			.where(eq(userOnboardingAuditEvents.user, userId))
			.orderBy(desc(userOnboardingAuditEvents.created))
	]);

	return { assignments, auditEvents };
});
