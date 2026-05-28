import { beforeEach, describe, expect, it, vi } from 'vitest';

const schema = vi.hoisted(() => ({
	configOnboardingCampaigns: {
		id: 'campaign_id',
		defaultProfile: 'campaign_default_profile'
	},
	configOnboardingInviteCodes: {
		campaign: 'invite_campaign',
		profileOverride: 'invite_profile_override'
	},
	configOnboardingProfiles: {
		id: 'profile_id',
		status: 'profile_status',
		updated: 'profile_updated',
		key: 'profile_key'
	},
	configOnboardingProfileQuestions: {
		profile: 'question_profile'
	},
	configTagCatalog: {},
	configTagNamespaces: {},
	aiAgentModels: {},
	aiPrompts: {},
	userOnboardingAssignments: {
		profile: 'assignment_profile'
	}
}));

const appServer = vi.hoisted(() => {
	const refresh = vi.fn();
	return {
		refresh,
		getRequestEvent: vi.fn(),
		query: vi.fn((handlerOrSchema: unknown, maybeHandler?: unknown) => {
			const handler = typeof handlerOrSchema === 'function' ? handlerOrSchema : maybeHandler;
			const remote = vi.fn(() => ({
				refresh,
				run: (...args: unknown[]) => (handler as (...args: unknown[]) => unknown)(...args)
			}));
			(remote as typeof remote & { __: { type: string } }).__ = { type: 'query' };
			return remote;
		}),
		command: vi.fn((handlerOrSchema: unknown, maybeHandler?: unknown) => {
			const handler = typeof handlerOrSchema === 'function' ? handlerOrSchema : maybeHandler;
			const remote = handler as ((...args: unknown[]) => unknown) & { __?: { type: string } };
			remote.__ = { type: 'command' };
			return remote;
		})
	};
});

vi.mock('$app/server', () => ({
	query: appServer.query,
	command: appServer.command,
	getRequestEvent: appServer.getRequestEvent
}));

vi.mock('@repo/db/schema', () => schema);

vi.mock('@repo/db/id', () => ({
	generateId: vi.fn(() => 'generated-id')
}));

vi.mock('drizzle-orm', () => ({
	and: vi.fn((...conditions: unknown[]) => ({ type: 'and', conditions })),
	asc: vi.fn((value: unknown) => ({ type: 'asc', value })),
	desc: vi.fn((value: unknown) => ({ type: 'desc', value })),
	eq: vi.fn((left: unknown, right: unknown) => ({ type: 'eq', left, right })),
	inArray: vi.fn((left: unknown, right: unknown) => ({ type: 'inArray', left, right })),
	isNull: vi.fn((value: unknown) => ({ type: 'isNull', value })),
	or: vi.fn((...conditions: unknown[]) => ({ type: 'or', conditions }))
}));

vi.mock('./compiler', () => ({
	buildStrictOnboardingMarkdownExport: vi.fn(),
	buildCompilerPrompt: vi.fn(),
	compileStrictOnboardingMarkdown: vi.fn(),
	validateCompilerOutput: vi.fn()
}));

import { archiveProfile, deleteProfile } from './profiles.remote';

describe('deleteProfile', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('refreshes both the profiles list and the current profile after archiving', async () => {
		const where = vi.fn(async () => undefined);
		const set = vi.fn(() => ({ where }));
		const db = {
			select: vi.fn(() => ({
				from: vi.fn((table: unknown) => ({
					where: vi.fn(async () => {
						if (table === schema.configOnboardingProfiles) {
							return [{ id: 'profile-1', status: 'active' }];
						}
						return [];
					})
				}))
			})),
			update: vi.fn(() => ({ set }))
		};

		appServer.getRequestEvent.mockReturnValue({ locals: { db } });

		const result = await archiveProfile({ id: 'profile-1' });

		expect(result).toEqual({ success: true });
		expect(db.update).toHaveBeenCalledWith(schema.configOnboardingProfiles);
		expect(appServer.refresh).toHaveBeenCalledTimes(2);
	});

	it('deletes linked onboarding assignments before deleting the profile', async () => {
		let assignmentsDeleted = false;

		const db = {
			select: vi.fn(() => ({
				from: vi.fn((table: unknown) => ({
					where: vi.fn(async () => {
						if (table === schema.configOnboardingProfiles) {
							return [{ id: 'profile-1', status: 'draft' }];
						}
						if (table === schema.configOnboardingCampaigns) {
							return [];
						}
						return [];
					})
				}))
			})),
			delete: vi.fn((table: unknown) => ({
				where: vi.fn(async () => {
					if (table === schema.userOnboardingAssignments) {
						assignmentsDeleted = true;
						return;
					}

					if (table === schema.configOnboardingProfiles && !assignmentsDeleted) {
						throw new Error(
							'update or delete on table "config_onboarding_profiles" violates foreign key constraint "fk_user_onboarding_assignments_profile" on table "user_onboarding_assignments"'
						);
					}
				})
			}))
		};

		appServer.getRequestEvent.mockReturnValue({ locals: { db } });

		const result = await deleteProfile({ id: 'profile-1' });

		expect(result).toEqual({ success: true });
		expect(db.delete).toHaveBeenCalledWith(schema.userOnboardingAssignments);
		expect(appServer.refresh).toHaveBeenCalledOnce();
	});
});
