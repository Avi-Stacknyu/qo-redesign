<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/shadcn/badge';
	import { Button } from '$lib/components/shadcn/button';
	import * as Card from '$lib/components/shadcn/card';
	import * as Dialog from '$lib/components/shadcn/dialog';
	import { Input } from '$lib/components/shadcn/input';
	import * as Tabs from '$lib/components/shadcn/tabs';
	import * as Table from '$lib/components/shadcn/table';
	import { Textarea } from '$lib/components/shadcn/textarea';
	import {
		ArrowLeft,
		Copy,
		Download,
		KeyRound,
		Link as LinkIcon,
		Pencil,
		Plus,
		Save,
		Trash2
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import {
		getProfileById,
		getProfileMarkdownExport,
		publishProfile,
		archiveProfile,
		revertToDraft,
		deleteProfile,
		updateProfileMetadata,
		saveProfilePromptTemplate,
		saveProfileQuestion,
		deleteProfileQuestion,
		saveProfileCampaign,
		saveProfileInviteCode
	} from '../profiles.remote';

	type ProfileDetailData = Awaited<ReturnType<ReturnType<typeof getProfileById>['run']>>;
	type LoadedProfileData = Extract<ProfileDetailData, { profile: unknown }>;
	type Question = LoadedProfileData['questions'][number];
	type Campaign = LoadedProfileData['campaigns'][number];
	type InviteCode = Campaign['inviteCodes'][number];

	type MetadataForm = {
		key: string;
		name: string;
		description: string;
		industryKey: string;
		model: string;
		systemPrompt: string;
		maxAiQuestions: number;
		sessionTimeoutMs: number | null;
		cacheTtlMs: number | null;
		enableTrialActivation: boolean;
		defaultTags: string[];
		visibility: 'public' | 'invite_only' | 'hidden';
		aiFallbackQuestionsText: string;
	};

	type BranchOperator =
		| 'equals'
		| 'not_equals'
		| 'includes'
		| 'includes_any'
		| 'exists'
		| 'not_exists';

	type QuestionForm = {
		id: string;
		question: string;
		type: string;
		description: string;
		sidebarTitle: string;
		factKey: string;
		order: number;
		enabled: boolean;
		required: boolean;
		group: string;
		optionsText: string;
		showWhenText: string;
		metadataText: string;
	};

	type CampaignForm = {
		id: string;
		slug: string;
		displayName: string;
		description: string;
		organizationKey: string;
		organizationName: string;
		sourceType: string;
		isActive: boolean;
	};

	type InviteForm = {
		id: string;
		campaignId: string;
		code: string;
		codeType: string;
		isActive: boolean;
		maxUses: string;
		expiresAt: string;
	};

	function collectSuggestedTags(rows: Array<{ options?: unknown }>): string[] {
		const tags: string[] = [];
		for (const row of rows) {
			const options = Array.isArray(row.options) ? row.options : [];
			for (const option of options) {
				if (!option || typeof option !== 'object') continue;
				const grantsTags = (option as { grantsTags?: unknown }).grantsTags;
				if (!Array.isArray(grantsTags)) continue;
				for (const tag of grantsTags) {
					const normalized = typeof tag === 'string' ? tag.trim() : '';
					if (normalized && !tags.includes(normalized)) tags.push(normalized);
				}
			}
		}
		return tags;
	}

	function normalizeTagList(value: unknown): string[] {
		if (!Array.isArray(value)) return [];
		return [
			...new Set(
				value
					.filter((tag): tag is string => typeof tag === 'string')
					.map((tag) => tag.trim())
					.filter(Boolean)
			)
		];
	}

	function normalizeVisibility(value: unknown): 'public' | 'invite_only' | 'hidden' {
		return value === 'invite_only' || value === 'hidden' ? value : 'public';
	}

	function slugify(value: string): string {
		return value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 80);
	}

	function toNumber(value: unknown, fallback = 0): number {
		const number = Number(value);
		return Number.isFinite(number) ? number : fallback;
	}

	function optionalNumber(value: number | null | undefined): number | null {
		return typeof value === 'number' && Number.isFinite(value) ? value : null;
	}

	function optionalIntFromText(value: string): number | null {
		const trimmed = value.trim();
		if (!trimmed) return null;
		const number = Number(trimmed);
		return Number.isInteger(number) && number > 0 ? number : null;
	}

	function formatJson(value: unknown, fallback: unknown): string {
		return JSON.stringify(value ?? fallback, null, 2);
	}

	function formatShowWhen(value: unknown): string {
		if (!value || typeof value !== 'object') return 'Always';
		const rule = value as {
			all?: Array<{ factKey?: string; questionId?: string; operator?: string; value?: unknown }>;
			any?: Array<{ factKey?: string; questionId?: string; operator?: string; value?: unknown }>;
			factKey?: string;
			questionId?: string;
			operator?: string;
			value?: unknown;
		};
		const condition = rule.all?.[0] ?? rule.any?.[0] ?? rule;
		const source = condition.factKey ?? condition.questionId ?? 'answer';
		const operator = condition.operator ?? 'equals';
		const valueLabel = Array.isArray(condition.value)
			? condition.value.join(', ')
			: condition.value === undefined
				? ''
				: String(condition.value);
		return [source, operator.replace(/_/g, ' '), valueLabel].filter(Boolean).join(' ');
	}

	function emptyQuestionForm(nextOrder = 0): QuestionForm {
		return {
			id: '',
			question: '',
			type: 'single',
			description: '',
			sidebarTitle: '',
			factKey: '',
			order: nextOrder,
			enabled: true,
			required: true,
			group: '',
			optionsText: '[]',
			showWhenText: 'null',
			metadataText: 'null'
		};
	}

	function toQuestionForm(question: Question): QuestionForm {
		return {
			id: question.id,
			question: question.question ?? '',
			type: question.type ?? 'single',
			description: question.description ?? '',
			sidebarTitle: question.sidebarTitle ?? '',
			factKey: question.factKey ?? '',
			order: toNumber(question.order, 0),
			enabled: question.enabled ?? true,
			required: question.required ?? true,
			group: question.group ?? '',
			optionsText: formatJson(question.options, []),
			showWhenText: formatJson(question.showWhen, null),
			metadataText: formatJson(question.metadata, null)
		};
	}

	function toDateTimeLocal(value: string | null | undefined): string {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value.slice(0, 16);
		const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
		return local.toISOString().slice(0, 16);
	}

	const profileId = $derived(page.params.id ?? '');
	const profileQuery = $derived(profileId ? getProfileById({ id: profileId }) : null);
	let data = $derived<ProfileDetailData | { error: string } | null>(
		profileId ? (profileQuery?.current ?? null) : { error: 'Profile not found' }
	);
	let loading = $derived(profileId ? Boolean(profileQuery?.loading) : false);
	let profile = $derived(data && 'profile' in data ? data.profile : null);
	let questions = $derived((data && 'questions' in data ? data.questions : []) ?? []);
	let campaigns = $derived((data && 'campaigns' in data ? data.campaigns : []) ?? []);
	let modelOptions = $derived((data && 'modelOptions' in data ? data.modelOptions : []) ?? []);
	let promptOptions = $derived((data && 'promptOptions' in data ? data.promptOptions : []) ?? []);
	let tagOptions = $derived((data && 'tagOptions' in data ? data.tagOptions : []) ?? []);
	let selectedPrompt = $derived(data && 'selectedPrompt' in data ? data.selectedPrompt : null);
	let conditionalTags = $derived(collectSuggestedTags(questions));

	let acting = $state(false);
	let saving = $state<string | null>(null);
	let webBaseUrl = $state('');
	let questionDialogOpen = $state(false);
	let questionForm = $state<QuestionForm>(emptyQuestionForm());
	let metadataForm = $state<MetadataForm>({
		key: '',
		name: '',
		description: '',
		industryKey: '',
		model: '',
		systemPrompt: '',
		maxAiQuestions: 0,
		sessionTimeoutMs: null,
		cacheTtlMs: null,
		enableTrialActivation: true,
		defaultTags: [],
		visibility: 'public',
		aiFallbackQuestionsText: '[]'
	});
	let branchForm = $state<{ factKey: string; operator: BranchOperator; value: string }>({
		factKey: '',
		operator: 'equals',
		value: ''
	});

	type DisclosureItem = {
		id: string;
		question: string;
		title?: string;
		body?: string;
		type: 'acknowledgement' | 'accept_deny';
		required: boolean;
		acceptLabel?: string;
		rejectLabel?: string;
		rejectMessage?: string;
	};
	let disclosuresEnabled = $state(false);
	let disclosureItems = $state<DisclosureItem[]>([]);
	let disclosureItemForm = $state<DisclosureItem>({
		id: '',
		question: '',
		title: '',
		body: '',
		type: 'acknowledgement',
		required: true,
		acceptLabel: '',
		rejectLabel: '',
		rejectMessage: ''
	});
	let promptForm = $state({ displayName: '', promptTemplate: '' });
	let campaignForm = $state<CampaignForm>({
		id: '',
		slug: '',
		displayName: '',
		description: '',
		organizationKey: '',
		organizationName: '',
		sourceType: 'manual',
		isActive: true
	});
	let inviteForm = $state<InviteForm>({
		id: '',
		campaignId: '',
		code: '',
		codeType: 'single_use',
		isActive: true,
		maxUses: '',
		expiresAt: ''
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		const url = new URL(window.location.href);
		if (url.hostname.startsWith('admin.')) url.hostname = url.hostname.replace(/^admin\./, '');
		webBaseUrl = url.origin;
	});

	$effect(() => {
		if (!profile) return;
		metadataForm = {
			key: profile.key ?? '',
			name: profile.name ?? '',
			description: profile.description ?? '',
			industryKey: profile.industryKey ?? '',
			model: profile.model ?? '',
			systemPrompt: profile.systemPrompt ?? '',
			maxAiQuestions: toNumber(profile.maxAiQuestions, 0),
			sessionTimeoutMs:
				profile.sessionTimeoutMs === null || profile.sessionTimeoutMs === undefined
					? null
					: toNumber(profile.sessionTimeoutMs, 0),
			cacheTtlMs:
				profile.cacheTtlMs === null || profile.cacheTtlMs === undefined
					? null
					: toNumber(profile.cacheTtlMs, 0),
			enableTrialActivation: profile.enableTrialActivation ?? true,
			defaultTags: normalizeTagList(profile.defaultTags),
			visibility: normalizeVisibility(profile.visibility),
			aiFallbackQuestionsText: formatJson(profile.aiFallbackQuestions, [])
		};
		const disc = profile.disclosures as { enabled?: boolean; items?: DisclosureItem[] } | null;
		disclosuresEnabled = disc?.enabled ?? false;
		disclosureItems = disc?.items ?? [];
	});

	$effect(() => {
		if (!profile) return;
		promptForm = {
			displayName: selectedPrompt?.displayName ?? `${profile.name ?? 'Profile'} onboarding prompt`,
			promptTemplate: selectedPrompt?.promptTemplate ?? ''
		};
	});

	$effect(() => {
		if (!profile) return;
		campaignForm = {
			id: '',
			slug: slugify(`${profile.key || profile.name || profile.id}-invite`),
			displayName: `${profile.name ?? 'Profile'} onboarding`,
			description: profile.description ?? '',
			organizationKey: profile.industryKey ?? '',
			organizationName: '',
			sourceType: 'invite_link',
			isActive: true
		};
	});

	$effect(() => {
		if (!campaigns.length || inviteForm.campaignId) return;
		inviteForm.campaignId = campaigns[0].id;
	});

	function statusVariant(status: string | null): 'default' | 'secondary' | 'outline' {
		switch (status) {
			case 'active':
				return 'default';
			case 'archived':
				return 'outline';
			default:
				return 'secondary';
		}
	}

	async function handlePublish() {
		if (!profile) return;
		acting = true;
		try {
			const result = await publishProfile({ id: profile.id });
			if (result?.success) {
				toast.success('Profile published');
			} else {
				toast.error(result?.error ?? 'Failed to publish');
			}
		} finally {
			acting = false;
		}
	}

	async function handleArchive() {
		if (!profile) return;
		acting = true;
		try {
			const result = await archiveProfile({ id: profile.id });
			if (result?.success) {
				toast.success('Profile archived');
			} else {
				toast.error(result?.error ?? 'Failed to archive');
			}
		} finally {
			acting = false;
		}
	}

	async function handleRevertToDraft() {
		if (!profile) return;
		acting = true;
		try {
			const result = await revertToDraft({ id: profile.id });
			if (result?.success) {
				toast.success('Profile reverted to draft');
			} else {
				toast.error(result?.error ?? 'Failed to revert');
			}
		} finally {
			acting = false;
		}
	}

	async function handleDelete() {
		if (!profile) return;
		if (!confirm('Delete this profile? This cannot be undone.')) return;
		acting = true;
		try {
			const result = await deleteProfile({ id: profile.id });
			if (result?.success) {
				toast.success('Profile deleted');
				goto(resolve('/settings/onboarding/profiles'));
			} else {
				toast.error(result?.error ?? 'Failed to delete');
			}
		} finally {
			acting = false;
		}
	}

	async function handleExportMarkdown() {
		if (!profile) return;
		acting = true;
		try {
			const result = await getProfileMarkdownExport({ id: profile.id }).run();
			if (result && 'error' in result && result.error) {
				toast.error(result.error);
				return;
			}

			const markdown = result?.markdown;
			if (!markdown) {
				toast.error('Unable to export markdown');
				return;
			}

			const blob = new Blob([markdown], { type: 'text/markdown' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = result.fileName ?? `${profile.key || profile.id}.md`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
			toast.success('Profiler markdown exported');
		} catch {
			toast.error('Unable to export markdown');
		} finally {
			acting = false;
		}
	}

	async function refreshProfile() {
		await profileQuery?.refresh();
	}

	async function saveDisclosures() {
		if (!profile) return;
		saving = 'disclosures';
		try {
			const result = await updateProfileMetadata({
				id: profile.id,
				disclosures: { enabled: disclosuresEnabled, items: disclosureItems }
			});
			if (result?.success) {
				toast.success('Disclosures saved');
				await refreshProfile();
			} else {
				toast.error(result?.error ?? 'Failed to save disclosures');
			}
		} finally {
			saving = null;
		}
	}

	function addDisclosureItem() {
		if (!disclosureItemForm.question.trim()) {
			toast.error('Question text is required');
			return;
		}
		disclosureItems = [
			...disclosureItems,
			{
				id: disclosureItemForm.id || crypto.randomUUID(),
				question: disclosureItemForm.question.trim(),
				...(disclosureItemForm.title?.trim()
					? { title: disclosureItemForm.title.trim() }
					: {}),
				...(disclosureItemForm.body?.trim() ? { body: disclosureItemForm.body.trim() } : {}),
				type: disclosureItemForm.type,
				required: disclosureItemForm.required,
				...(disclosureItemForm.acceptLabel?.trim()
					? { acceptLabel: disclosureItemForm.acceptLabel.trim() }
					: {}),
				...(disclosureItemForm.rejectLabel?.trim()
					? { rejectLabel: disclosureItemForm.rejectLabel.trim() }
					: {}),
				...(disclosureItemForm.rejectMessage?.trim()
					? { rejectMessage: disclosureItemForm.rejectMessage.trim() }
					: {})
			}
		];
		disclosureItemForm = {
			id: '',
			question: '',
			title: '',
			body: '',
			type: 'acknowledgement',
			required: true,
			acceptLabel: '',
			rejectLabel: '',
			rejectMessage: ''
		};
	}

	function removeDisclosureItem(id: string) {
		disclosureItems = disclosureItems.filter((item) => item.id !== id);
	}

	async function saveMetadata() {
		if (!profile) return;
		let aiFallbackQuestions: Array<{
			id: string;
			question: string;
			type: 'single_select' | 'multi_select' | 'text' | 'number' | 'boolean';
			factKey: string;
			factLabel: string;
			sidebarTitle: string;
			description?: string;
			options?: Array<{ label: string; value: string; grantsTags?: string[] }>;
			required: boolean;
			group?: string;
		}>;
		try {
			const parsed = JSON.parse(metadataForm.aiFallbackQuestionsText || '[]');
			if (!Array.isArray(parsed)) throw new Error('AI fallback questions must be a JSON array');
			aiFallbackQuestions = parsed;
		} catch (error) {
			toast.error((error as Error).message);
			return;
		}

		saving = 'metadata';
		try {
			const result = await updateProfileMetadata({
				id: profile.id,
				key: metadataForm.key,
				name: metadataForm.name,
				description: metadataForm.description,
				industryKey: metadataForm.industryKey,
				model: metadataForm.model || null,
				systemPrompt: metadataForm.systemPrompt || null,
				maxAiQuestions: metadataForm.maxAiQuestions,
				sessionTimeoutMs: optionalNumber(metadataForm.sessionTimeoutMs),
				cacheTtlMs: optionalNumber(metadataForm.cacheTtlMs),
				enableTrialActivation: metadataForm.enableTrialActivation,
				defaultTags: metadataForm.defaultTags,
				visibility: metadataForm.visibility,
				aiFallbackQuestions
			});
			if (result?.success) {
				toast.success('Profile saved');
				await refreshProfile();
			} else {
				toast.error(result?.error ?? 'Failed to save profile');
			}
		} finally {
			saving = null;
		}
	}

	async function savePromptTemplate() {
		if (!profile) return;
		saving = 'prompt';
		try {
			const result = await saveProfilePromptTemplate({
				profileId: profile.id,
				displayName: promptForm.displayName,
				promptTemplate: promptForm.promptTemplate
			});
			if (result?.success) {
				toast.success('Prompt saved');
				await refreshProfile();
			} else {
				toast.error(result?.error ?? 'Failed to save prompt');
			}
		} finally {
			saving = null;
		}
	}

	function startNewQuestion() {
		questionForm = emptyQuestionForm(questions.length + 1);
		branchForm = { factKey: '', operator: 'equals', value: '' };
		questionDialogOpen = true;
	}

	function editQuestion(question: Question) {
		questionForm = toQuestionForm(question);
		syncBranchBuilder(questionForm.showWhenText);
		questionDialogOpen = true;
	}

	function syncBranchBuilder(showWhenText: string) {
		try {
			const rule = JSON.parse(showWhenText) as {
				all?: Array<{
					factKey?: string;
					questionId?: string;
					operator?: BranchOperator;
					value?: unknown;
				}>;
				any?: Array<{
					factKey?: string;
					questionId?: string;
					operator?: BranchOperator;
					value?: unknown;
				}>;
				factKey?: string;
				questionId?: string;
				operator?: BranchOperator;
				value?: unknown;
			} | null;
			const condition = rule?.all?.[0] ?? rule?.any?.[0] ?? rule;
			if (!condition || typeof condition !== 'object') {
				branchForm = { factKey: '', operator: 'equals', value: '' };
				return;
			}
			branchForm = {
				factKey: condition.factKey ?? condition.questionId ?? '',
				operator: condition.operator ?? 'equals',
				value: Array.isArray(condition.value)
					? condition.value.join(', ')
					: condition.value === undefined
						? ''
						: String(condition.value)
			};
		} catch {
			branchForm = { factKey: '', operator: 'equals', value: '' };
		}
	}

	function applyBranchRule() {
		if (!branchForm.factKey) return;
		const needsValue = branchForm.operator !== 'exists' && branchForm.operator !== 'not_exists';
		const value =
			branchForm.operator === 'includes_any'
				? branchForm.value
						.split(',')
						.map((part) => part.trim())
						.filter(Boolean)
				: branchForm.value.trim();
		questionForm.showWhenText = JSON.stringify(
			{
				all: [
					{
						factKey: branchForm.factKey,
						operator: branchForm.operator,
						...(needsValue ? { value } : {})
					}
				]
			},
			null,
			2
		);
	}

	function clearBranchRule() {
		branchForm = { factKey: '', operator: 'equals', value: '' };
		questionForm.showWhenText = 'null';
	}

	function toggleDefaultTag(tag: string) {
		metadataForm.defaultTags = metadataForm.defaultTags.includes(tag)
			? metadataForm.defaultTags.filter((item) => item !== tag)
			: [...metadataForm.defaultTags, tag];
	}

	async function saveQuestion() {
		if (!profile) return;
		saving = 'question';
		try {
			const result = await saveProfileQuestion({
				...questionForm,
				id: questionForm.id || undefined,
				profileId: profile.id
			});
			if (result?.success) {
				toast.success(questionForm.id ? 'Question saved' : 'Question created');
				questionDialogOpen = false;
				await refreshProfile();
			} else {
				toast.error(result?.error ?? 'Failed to save question');
			}
		} finally {
			saving = null;
		}
	}

	async function removeQuestion(question: Question) {
		if (!profile || !confirm('Delete this question?')) return;
		saving = `question-${question.id}`;
		try {
			const result = await deleteProfileQuestion({ id: question.id, profileId: profile.id });
			if (result?.success) {
				toast.success('Question deleted');
				await refreshProfile();
			} else {
				toast.error(result?.error ?? 'Failed to delete question');
			}
		} finally {
			saving = null;
		}
	}

	function editCampaign(campaign: Campaign) {
		campaignForm = {
			id: campaign.id,
			slug: campaign.slug ?? '',
			displayName: campaign.displayName ?? '',
			description: campaign.description ?? '',
			organizationKey: campaign.organizationKey ?? '',
			organizationName: campaign.organizationName ?? '',
			sourceType: campaign.sourceType ?? 'invite_link',
			isActive: campaign.isActive ?? true
		};
	}

	async function saveCampaign() {
		if (!profile) return;
		saving = 'campaign';
		try {
			const result = await saveProfileCampaign({
				...campaignForm,
				id: campaignForm.id || undefined,
				profileId: profile.id
			});
			if (result?.success) {
				toast.success(campaignForm.id ? 'Campaign saved' : 'Campaign created');
				await refreshProfile();
			} else {
				toast.error(result?.error ?? 'Failed to save campaign');
			}
		} finally {
			saving = null;
		}
	}

	function generateInviteCode() {
		const prefix = slugify(profile?.key || profile?.name || 'onboarding')
			.replace(/-/g, '_')
			.toUpperCase();
		const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
		inviteForm.code = `${prefix}-${suffix}`;
	}

	function editInviteCode(invite: InviteCode) {
		inviteForm = {
			id: invite.id,
			campaignId: invite.campaign,
			code: invite.code ?? '',
			codeType: invite.codeType ?? 'single_use',
			isActive: invite.isActive ?? true,
			maxUses: invite.maxUses ? String(invite.maxUses) : '',
			expiresAt: toDateTimeLocal(invite.expiresAt)
		};
	}

	async function saveInviteCode() {
		if (!profile) return;
		saving = 'invite';
		try {
			const result = await saveProfileInviteCode({
				id: inviteForm.id || undefined,
				profileId: profile.id,
				campaignId: inviteForm.campaignId,
				code: inviteForm.code,
				codeType: inviteForm.codeType,
				isActive: inviteForm.isActive,
				maxUses: optionalIntFromText(inviteForm.maxUses),
				expiresAt: inviteForm.expiresAt ? new Date(inviteForm.expiresAt).toISOString() : null
			});
			if (result?.success) {
				toast.success(inviteForm.id ? 'Invite code saved' : 'Invite code created');
				inviteForm = {
					id: '',
					campaignId: inviteForm.campaignId,
					code: '',
					codeType: 'single_use',
					isActive: true,
					maxUses: '',
					expiresAt: ''
				};
				await refreshProfile();
			} else {
				toast.error(result?.error ?? 'Failed to save invite code');
			}
		} finally {
			saving = null;
		}
	}

	function campaignLink(slug: string) {
		const base = webBaseUrl || '';
		return `${base}/onboarding?campaign=${encodeURIComponent(slug)}`;
	}

	function inviteLink(code: string) {
		const base = webBaseUrl || '';
		return `${base}/onboarding?invite=${encodeURIComponent(code)}`;
	}

	async function copyText(value: string) {
		try {
			await navigator.clipboard.writeText(value);
			toast.success('Copied');
		} catch {
			toast.error('Unable to copy');
		}
	}
</script>

<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
	<div class="space-y-6 px-4 lg:px-6">
		<!-- Header -->
		<div class="flex items-center gap-4">
			<Button variant="ghost" size="icon" href="/settings/onboarding/profiles">
				<ArrowLeft class="h-4 w-4" />
			</Button>
			<div class="flex-1">
				{#if profile}
					<div class="flex items-center gap-2">
						<h2 class="text-2xl font-bold tracking-tight">{profile.name ?? 'Untitled'}</h2>
						<Badge variant={statusVariant(profile.status)}>{profile.status ?? 'draft'}</Badge>
					</div>
					{#if profile.description}
						<p class="text-sm text-muted-foreground">{profile.description}</p>
					{/if}
				{:else if loading}
					<h2 class="text-2xl font-bold tracking-tight">Loading profile...</h2>
				{:else}
					<h2 class="text-2xl font-bold tracking-tight text-destructive">Profile not found</h2>
				{/if}
			</div>
			{#if profile}
				<div class="flex items-center gap-2">
					<Button variant="outline" onclick={handleExportMarkdown} disabled={acting}>
						<Download class="mr-2 h-4 w-4" />
						Export Markdown
					</Button>
					{#if profile.status === 'draft'}
						<Button onclick={handlePublish} disabled={acting}>Publish</Button>
						<Button variant="destructive" onclick={handleDelete} disabled={acting}>Delete</Button>
					{:else if profile.status === 'active'}
						<Button variant="outline" onclick={handleArchive} disabled={acting}>Archive</Button>
						<Button variant="ghost" onclick={handleRevertToDraft} disabled={acting}>Revert to Draft</Button>
					{:else if profile.status === 'archived'}
						<Button onclick={handlePublish} disabled={acting}>Publish</Button>
						<Button variant="ghost" onclick={handleRevertToDraft} disabled={acting}>Revert to Draft</Button>
						<Button variant="destructive" onclick={handleDelete} disabled={acting}>Delete</Button>
					{/if}
				</div>
			{/if}
		</div>

		{#if profile}
			<Tabs.Root value="summary" class="space-y-6">
				<Tabs.List>
					<Tabs.Trigger value="summary">Summary</Tabs.Trigger>
					<Tabs.Trigger value="disclosures">Disclosures</Tabs.Trigger>
					<Tabs.Trigger value="questions">Questions ({questions.length})</Tabs.Trigger>
					<Tabs.Trigger value="prompt">AI Prompt</Tabs.Trigger>
					<Tabs.Trigger value="access">Access Links</Tabs.Trigger>
					<Tabs.Trigger value="tags">Tags</Tabs.Trigger>
				</Tabs.List>

				<Tabs.Content value="summary" class="space-y-4">
					<Card.Root>
						<Card.Header>
							<Card.Title>Profile Configuration</Card.Title>
							<Card.Description>
								Edit the profile identity, runtime model, AI question count, and onboarding
								behavior.
							</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="grid gap-4 sm:grid-cols-2">
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="profile-name"
										>Name</label
									>
									<Input id="profile-name" bind:value={metadataForm.name} />
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="profile-key"
										>Key</label
									>
									<Input id="profile-key" bind:value={metadataForm.key} />
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="profile-industry"
										>Industry Key</label
									>
									<Input id="profile-industry" bind:value={metadataForm.industryKey} />
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="profile-visibility"
										>Visibility</label
									>
									<select
										id="profile-visibility"
										bind:value={metadataForm.visibility}
										class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
									>
										<option value="public">Public</option>
										<option value="invite_only">Invite only</option>
										<option value="hidden">Hidden</option>
									</select>
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="max-ai"
										>Max AI Questions</label
									>
									<Input
										id="max-ai"
										type="number"
										min="0"
										max="20"
										bind:value={metadataForm.maxAiQuestions}
									/>
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="session-timeout"
										>Session Timeout Ms</label
									>
									<Input
										id="session-timeout"
										type="number"
										min="0"
										bind:value={metadataForm.sessionTimeoutMs}
									/>
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="cache-ttl"
										>Cache TTL Ms</label
									>
									<Input
										id="cache-ttl"
										type="number"
										min="0"
										bind:value={metadataForm.cacheTtlMs}
									/>
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="profile-model"
										>Runtime AI model</label
									>
									<select
										id="profile-model"
										bind:value={metadataForm.model}
										class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
									>
										<option value="">Use runtime default</option>
										{#each modelOptions as model (model.id)}
											<option value={model.id}
												>{model.displayName ?? model.modelId ?? model.id}</option
											>
										{/each}
									</select>
								</div>
								<label class="flex items-center gap-2 pt-6 text-sm">
									<input type="checkbox" bind:checked={metadataForm.enableTrialActivation} />
									Enable trial activation when onboarding completes
								</label>
							</div>
							<div>
								<label class="text-xs font-medium text-muted-foreground" for="profile-description"
									>Description</label
								>
								<Textarea id="profile-description" rows={3} bind:value={metadataForm.description} />
							</div>
							<div class="flex justify-end">
								<Button onclick={saveMetadata} disabled={saving === 'metadata'}>
									<Save class="mr-2 h-4 w-4" />
									Save configuration
								</Button>
							</div>
						</Card.Content>
					</Card.Root>
				</Tabs.Content>

				<Tabs.Content value="disclosures" class="space-y-4">
					<Card.Root>
						<Card.Header>
							<Card.Title>Disclosure Configuration</Card.Title>
							<Card.Description>
								Disclosures are shown before the Q&amp;A step and can include short acknowledgements
								or long-form consent text.
							</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="flex items-center gap-3">
								<label class="text-sm font-medium" for="disclosures-enabled">Enable Disclosures</label>
								<input
									id="disclosures-enabled"
									type="checkbox"
									bind:checked={disclosuresEnabled}
									class="h-4 w-4 rounded border-input"
								/>
							</div>

							{#if disclosuresEnabled}
								{#if disclosureItems.length > 0}
									<Table.Root>
										<Table.Header>
											<Table.Row>
												<Table.Head>Disclosure</Table.Head>
												<Table.Head class="w-32">Type</Table.Head>
												<Table.Head class="w-24">Required</Table.Head>
												<Table.Head class="w-16"></Table.Head>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{#each disclosureItems as item (item.id)}
												<Table.Row>
													<Table.Cell class="space-y-1 text-sm">
														<p class="font-medium text-foreground">{item.title || item.question}</p>
														{#if item.title}
															<p class="text-xs text-muted-foreground">{item.question}</p>
														{/if}
														{#if item.body}
															<p class="line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
														{/if}
													</Table.Cell>
													<Table.Cell>
														<Badge variant="outline">{item.type === 'accept_deny' ? 'Accept/Deny' : 'Acknowledge'}</Badge>
													</Table.Cell>
													<Table.Cell>
														{#if item.required}
															<Badge variant="default">Required</Badge>
														{:else}
															<Badge variant="secondary">Optional</Badge>
														{/if}
													</Table.Cell>
													<Table.Cell>
														<Button
															variant="ghost"
															size="icon"
															class="h-7 w-7"
															onclick={() => removeDisclosureItem(item.id)}
														>
															<Trash2 class="h-3.5 w-3.5 text-destructive" />
														</Button>
													</Table.Cell>
												</Table.Row>
											{/each}
										</Table.Body>
									</Table.Root>
								{/if}

								<div class="rounded-md border p-4 space-y-3">
									<p class="text-xs font-medium text-muted-foreground">Add disclosure item</p>
									<div class="grid gap-3 sm:grid-cols-2">
										<div class="sm:col-span-2">
											<Input
															placeholder="Agreement or acknowledgement statement"
												bind:value={disclosureItemForm.question}
											/>
										</div>
													<div class="sm:col-span-2">
														<Input
															placeholder="Optional title for long-form disclosures"
															bind:value={disclosureItemForm.title}
														/>
													</div>
													<div class="sm:col-span-2">
														<Textarea
															rows={3}
															placeholder="Optional long-form disclosure body"
															bind:value={disclosureItemForm.body}
														/>
													</div>
										<div>
											<select
												class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
												bind:value={disclosureItemForm.type}
											>
												<option value="acknowledgement">Acknowledgement</option>
												<option value="accept_deny">Accept / Deny</option>
											</select>
										</div>
										<div class="flex items-center gap-2">
											<input
												type="checkbox"
												bind:checked={disclosureItemForm.required}
												class="h-4 w-4 rounded border-input"
											/>
											<span class="text-sm">Required</span>
										</div>
													<div>
														<Input placeholder="Accept label (optional)" bind:value={disclosureItemForm.acceptLabel} />
													</div>
													<div>
														<Input placeholder="Reject label (optional)" bind:value={disclosureItemForm.rejectLabel} />
													</div>
													<div class="sm:col-span-2">
														<Textarea
															rows={2}
															placeholder="Reject message shown when a required disclosure is declined"
															bind:value={disclosureItemForm.rejectMessage}
														/>
													</div>
									</div>
									<Button size="sm" variant="outline" onclick={addDisclosureItem}>
										<Plus class="mr-1 h-3 w-3" />
										Add Item
									</Button>
								</div>
							{/if}
						</Card.Content>
						<Card.Footer class="flex justify-end">
							<Button onclick={saveDisclosures} disabled={saving === 'disclosures'}>
								<Save class="mr-2 h-4 w-4" />
								{saving === 'disclosures' ? 'Saving...' : 'Save Disclosures'}
							</Button>
						</Card.Footer>
					</Card.Root>
				</Tabs.Content>

				<Tabs.Content value="questions" class="space-y-4">
					<div class="flex justify-end">
						<Button onclick={startNewQuestion}>
							<Plus class="mr-2 h-4 w-4" />
							New question
						</Button>
					</div>
					{#if questions.length === 0}
						<Card.Root>
							<Card.Content class="py-8 text-center">
								<p class="text-sm text-muted-foreground">No questions in this profile.</p>
							</Card.Content>
						</Card.Root>
					{:else}
						<Table.Root>
							<Table.Header>
								<Table.Row>
									<Table.Head class="w-12">#</Table.Head>
									<Table.Head>Question</Table.Head>
									<Table.Head>Type</Table.Head>
									<Table.Head>Fact Key</Table.Head>
									<Table.Head>Branch</Table.Head>
									<Table.Head>Required</Table.Head>
									<Table.Head>Enabled</Table.Head>
									<Table.Head class="w-28 text-right">Actions</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each questions as q, i (q.id)}
									<Table.Row>
										<Table.Cell class="text-muted-foreground">{i + 1}</Table.Cell>
										<Table.Cell class="font-medium">{q.question ?? '—'}</Table.Cell>
										<Table.Cell>
											<Badge variant="outline">{q.type ?? 'text'}</Badge>
										</Table.Cell>
										<Table.Cell class="font-mono text-xs">{q.factKey ?? '—'}</Table.Cell>
										<Table.Cell class="max-w-48 text-xs text-muted-foreground">
											{formatShowWhen(q.showWhen)}
										</Table.Cell>
										<Table.Cell>{q.required ? 'Yes' : 'No'}</Table.Cell>
										<Table.Cell>{q.enabled ? 'Yes' : 'No'}</Table.Cell>
										<Table.Cell class="text-right">
											<div class="flex justify-end gap-1">
												<Button
													variant="ghost"
													size="icon"
													onclick={() => editQuestion(q)}
													title="Edit question"
												>
													<Pencil class="h-4 w-4" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													onclick={() => removeQuestion(q)}
													title="Delete question"
													disabled={saving === `question-${q.id}`}
												>
													<Trash2 class="h-4 w-4" />
												</Button>
											</div>
										</Table.Cell>
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					{/if}
				</Tabs.Content>

				<Tabs.Content value="prompt" class="space-y-4">
					<Card.Root>
						<Card.Header>
							<Card.Title>AI Prompt</Card.Title>
							<Card.Description>
								Choose an existing prompt or save a profile-specific prompt template.
							</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="grid gap-4 sm:grid-cols-[1fr_auto]">
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="prompt-select"
										>Selected Prompt</label
									>
									<select
										id="prompt-select"
										bind:value={metadataForm.systemPrompt}
										class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
									>
										<option value="">Use built-in fallback prompt</option>
										{#each promptOptions as prompt (prompt.id)}
											<option value={prompt.id}
												>{prompt.displayName ?? prompt.promptKey ?? prompt.id}</option
											>
										{/each}
									</select>
								</div>
								<Button
									class="self-end"
									variant="outline"
									onclick={saveMetadata}
									disabled={saving === 'metadata'}
								>
									<Save class="mr-2 h-4 w-4" />
									Save selection
								</Button>
							</div>
							<div>
								<label class="text-xs font-medium text-muted-foreground" for="prompt-name"
									>Prompt Name</label
								>
								<Input id="prompt-name" bind:value={promptForm.displayName} />
							</div>
							<div>
								<label class="text-xs font-medium text-muted-foreground" for="prompt-template"
									>Prompt Template</label
								>
								<Textarea
									id="prompt-template"
									bind:value={promptForm.promptTemplate}
									rows={18}
									class="font-mono text-sm"
								/>
							</div>
							<div class="flex justify-end">
								<Button
									onclick={savePromptTemplate}
									disabled={saving === 'prompt' || !promptForm.promptTemplate.trim()}
								>
									<Save class="mr-2 h-4 w-4" />
									Save profile prompt
								</Button>
							</div>
						</Card.Content>
					</Card.Root>

					<Card.Root>
						<Card.Header>
							<Card.Title>AI Fallback Questions</Card.Title>
							<Card.Description>
								Questions used when live AI question generation fails for this profile.
							</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-4">
							<Textarea
								id="ai-fallback-questions"
								bind:value={metadataForm.aiFallbackQuestionsText}
								rows={12}
								class="font-mono text-sm"
							/>
							<div class="flex justify-end">
								<Button onclick={saveMetadata} disabled={saving === 'metadata'}>
									<Save class="mr-2 h-4 w-4" />
									Save fallback questions
								</Button>
							</div>
						</Card.Content>
					</Card.Root>
				</Tabs.Content>

				<Tabs.Content value="access" class="space-y-4">
					<Card.Root>
						<Card.Header>
							<Card.Title>Campaign Link</Card.Title>
							<Card.Description>
								Create a campaign that locks users into this onboarding profile from a shareable
								link.
							</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="grid gap-4 sm:grid-cols-2">
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="campaign-slug"
										>Slug</label
									>
									<Input id="campaign-slug" bind:value={campaignForm.slug} />
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="campaign-name"
										>Display Name</label
									>
									<Input id="campaign-name" bind:value={campaignForm.displayName} />
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="org-key"
										>Organization Key</label
									>
									<Input id="org-key" bind:value={campaignForm.organizationKey} />
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="org-name"
										>Organization Name</label
									>
									<Input id="org-name" bind:value={campaignForm.organizationName} />
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="source-type"
										>Source Type</label
									>
									<Input id="source-type" bind:value={campaignForm.sourceType} />
								</div>
								<label class="flex items-center gap-2 pt-6 text-sm">
									<input type="checkbox" bind:checked={campaignForm.isActive} />
									Active campaign
								</label>
							</div>
							<div>
								<label class="text-xs font-medium text-muted-foreground" for="campaign-description"
									>Description</label
								>
								<Textarea
									id="campaign-description"
									rows={3}
									bind:value={campaignForm.description}
								/>
							</div>
							<div class="flex justify-end">
								<Button onclick={saveCampaign} disabled={saving === 'campaign'}>
									<LinkIcon class="mr-2 h-4 w-4" />
									{campaignForm.id ? 'Save campaign' : 'Create campaign'}
								</Button>
							</div>

							{#if campaigns.length > 0}
								<div class="space-y-2">
									{#each campaigns as campaign (campaign.id)}
										<div class="rounded-lg border p-3">
											<div class="flex items-center justify-between gap-3">
												<div>
													<p class="text-sm font-medium">{campaign.displayName}</p>
													<p class="font-mono text-xs text-muted-foreground">
														{campaignLink(campaign.slug)}
													</p>
												</div>
												<div class="flex gap-1">
													<Button
														variant="ghost"
														size="icon"
														onclick={() => copyText(campaignLink(campaign.slug))}
														title="Copy campaign link"
													>
														<Copy class="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														onclick={() => editCampaign(campaign)}
														title="Edit campaign"
													>
														<Pencil class="h-4 w-4" />
													</Button>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</Card.Content>
					</Card.Root>

					<Card.Root>
						<Card.Header>
							<Card.Title>Invite Codes</Card.Title>
							<Card.Description>
								Create codes and copy links that send users directly into this profile after login.
							</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-4">
							<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="invite-campaign"
										>Campaign</label
									>
									<select
										id="invite-campaign"
										bind:value={inviteForm.campaignId}
										class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
									>
										<option value="">Choose campaign</option>
										{#each campaigns as campaign (campaign.id)}
											<option value={campaign.id}>{campaign.displayName}</option>
										{/each}
									</select>
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="invite-code"
										>Code</label
									>
									<div class="flex gap-2">
										<Input id="invite-code" bind:value={inviteForm.code} />
										<Button type="button" variant="outline" onclick={generateInviteCode}
											>Generate</Button
										>
									</div>
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="code-type"
										>Code Type</label
									>
									<select
										id="code-type"
										bind:value={inviteForm.codeType}
										class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
									>
										<option value="single_use">Single use</option>
										<option value="multi_use">Multi use</option>
										<option value="campaign">Campaign</option>
									</select>
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="max-uses"
										>Max Uses</label
									>
									<Input
										id="max-uses"
										type="number"
										min="1"
										bind:value={inviteForm.maxUses}
										placeholder="Unlimited"
									/>
								</div>
								<div>
									<label class="text-xs font-medium text-muted-foreground" for="expires-at"
										>Expires At</label
									>
									<Input id="expires-at" type="datetime-local" bind:value={inviteForm.expiresAt} />
								</div>
								<label class="flex items-center gap-2 pt-6 text-sm">
									<input type="checkbox" bind:checked={inviteForm.isActive} />
									Active code
								</label>
							</div>
							<div class="flex justify-end">
								<Button
									onclick={saveInviteCode}
									disabled={saving === 'invite' ||
										!inviteForm.campaignId ||
										!inviteForm.code.trim()}
								>
									<KeyRound class="mr-2 h-4 w-4" />
									{inviteForm.id ? 'Save invite code' : 'Create invite code'}
								</Button>
							</div>

							{#each campaigns as campaign (campaign.id)}
								{#if campaign.inviteCodes.length > 0}
									<div class="space-y-2">
										<p class="text-sm font-medium">{campaign.displayName}</p>
										{#each campaign.inviteCodes as invite (invite.id)}
											<div class="flex items-center justify-between gap-3 rounded-lg border p-3">
												<div>
													<div class="flex items-center gap-2">
														<span class="font-mono text-sm font-medium">{invite.code}</span>
														<Badge variant={invite.isActive ? 'default' : 'outline'}
															>{invite.isActive ? 'active' : 'inactive'}</Badge
														>
													</div>
													<p class="font-mono text-xs text-muted-foreground">
														{inviteLink(invite.code)}
													</p>
													<p class="text-xs text-muted-foreground">
														Used {invite.usedCount ?? 0}{invite.maxUses
															? ` / ${invite.maxUses}`
															: ''}
													</p>
												</div>
												<div class="flex gap-1">
													<Button
														variant="ghost"
														size="icon"
														onclick={() => copyText(inviteLink(invite.code))}
														title="Copy invite link"
													>
														<Copy class="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="icon"
														onclick={() => editInviteCode(invite)}
														title="Edit invite code"
													>
														<Pencil class="h-4 w-4" />
													</Button>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							{/each}
						</Card.Content>
					</Card.Root>
				</Tabs.Content>

				<Tabs.Content value="tags" class="space-y-4">
					<Card.Root>
						<Card.Header>
							<Card.Title>Default Tags</Card.Title>
							<Card.Description>Tags assigned whenever this profile is completed.</Card.Description>
						</Card.Header>
						<Card.Content class="space-y-4">
							{#if metadataForm.defaultTags.length > 0}
								<div class="flex flex-wrap gap-2">
									{#each metadataForm.defaultTags as tag (tag)}
										<Badge variant="secondary">{tag}</Badge>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-muted-foreground">No default tags.</p>
							{/if}

							{#if tagOptions.length > 0}
								<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{#each tagOptions as option (option.value)}
										<label class="flex items-center gap-2 rounded-md border p-2 text-sm">
											<input
												type="checkbox"
												checked={metadataForm.defaultTags.includes(option.value)}
												onchange={() => toggleDefaultTag(option.value)}
											/>
											<span>{option.label}</span>
										</label>
									{/each}
								</div>
							{/if}

							<div class="flex justify-end">
								<Button onclick={saveMetadata} disabled={saving === 'metadata'}>
									<Save class="mr-2 h-4 w-4" />
									Save default tags
								</Button>
							</div>
						</Card.Content>
					</Card.Root>

					<Card.Root>
						<Card.Header>
							<Card.Title>Conditional Tags</Card.Title>
							<Card.Description>Question option tags assigned only when selected.</Card.Description>
						</Card.Header>
						<Card.Content>
							{#if conditionalTags.length > 0}
								<div class="flex flex-wrap gap-2">
									{#each conditionalTags as tag (tag)}
										<Badge variant="outline">{tag}</Badge>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-muted-foreground">No conditional tags.</p>
							{/if}
						</Card.Content>
					</Card.Root>
				</Tabs.Content>
			</Tabs.Root>
		{/if}
	</div>
</div>

<Dialog.Root bind:open={questionDialogOpen}>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
		<Dialog.Header>
			<Dialog.Title>{questionForm.id ? 'Edit question' : 'Create question'}</Dialog.Title>
			<Dialog.Description>
				Configure the question text, answer type, profiler fact mapping, visibility, and JSON
				options.
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="sm:col-span-2">
					<label class="text-xs font-medium text-muted-foreground" for="question-text"
						>Question</label
					>
					<Textarea id="question-text" rows={3} bind:value={questionForm.question} />
				</div>
				<div>
					<label class="text-xs font-medium text-muted-foreground" for="question-type">Type</label>
					<select
						id="question-type"
						bind:value={questionForm.type}
						class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
					>
						<option value="single">Single choice</option>
						<option value="multiple">Multiple choice</option>
						<option value="checkbox">Checkbox</option>
						<option value="text">Text</option>
						<option value="number">Number</option>
					</select>
				</div>
				<div>
					<label class="text-xs font-medium text-muted-foreground" for="fact-key">Fact Key</label>
					<Input id="fact-key" bind:value={questionForm.factKey} />
				</div>
				<div>
					<label class="text-xs font-medium text-muted-foreground" for="question-order">Order</label
					>
					<Input id="question-order" type="number" min="0" bind:value={questionForm.order} />
				</div>
				<div>
					<label class="text-xs font-medium text-muted-foreground" for="question-group">Group</label
					>
					<Input id="question-group" bind:value={questionForm.group} />
				</div>
				<div>
					<label class="text-xs font-medium text-muted-foreground" for="sidebar-title"
						>Sidebar Title</label
					>
					<Input id="sidebar-title" bind:value={questionForm.sidebarTitle} />
				</div>
				<div class="flex items-center gap-6 pt-6">
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" bind:checked={questionForm.enabled} />
						Enabled
					</label>
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" bind:checked={questionForm.required} />
						Required
					</label>
				</div>
				<div class="sm:col-span-2">
					<label class="text-xs font-medium text-muted-foreground" for="question-description"
						>Description</label
					>
					<Textarea id="question-description" rows={2} bind:value={questionForm.description} />
				</div>
				<div class="sm:col-span-2">
					<label class="text-xs font-medium text-muted-foreground" for="options-json"
						>Options JSON</label
					>
					<Textarea
						id="options-json"
						rows={8}
						class="font-mono text-sm"
						bind:value={questionForm.optionsText}
					/>
				</div>
				<div class="rounded-md border p-3 sm:col-span-2">
					<div class="mb-3 flex items-center justify-between gap-3">
						<p class="text-sm font-medium">Branch condition</p>
						<Button type="button" variant="ghost" size="sm" onclick={clearBranchRule}>Clear</Button>
					</div>
					<div class="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
						<select
							bind:value={branchForm.factKey}
							class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
						>
							<option value="">Source fact</option>
							{#each questions.filter((q) => q.id !== questionForm.id) as question (question.id)}
								<option value={question.factKey ?? question.id}
									>{question.sidebarTitle ?? question.question ?? question.factKey}</option
								>
							{/each}
						</select>
						<select
							bind:value={branchForm.operator}
							class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
						>
							<option value="equals">Equals</option>
							<option value="not_equals">Not equals</option>
							<option value="includes">Includes</option>
							<option value="includes_any">Includes any</option>
							<option value="exists">Exists</option>
							<option value="not_exists">Not exists</option>
						</select>
						<Input
							bind:value={branchForm.value}
							placeholder="Value"
							disabled={branchForm.operator === 'exists' || branchForm.operator === 'not_exists'}
						/>
						<Button type="button" variant="outline" onclick={applyBranchRule}>Apply</Button>
					</div>
					<div class="mt-3">
						<label class="text-xs font-medium text-muted-foreground" for="show-when-json"
							>Show When JSON</label
						>
						<Textarea
							id="show-when-json"
							rows={5}
							class="mt-1 font-mono text-sm"
							bind:value={questionForm.showWhenText}
						/>
					</div>
				</div>
				<div>
					<label class="text-xs font-medium text-muted-foreground" for="metadata-json"
						>Metadata JSON</label
					>
					<Textarea
						id="metadata-json"
						rows={6}
						class="font-mono text-sm"
						bind:value={questionForm.metadataText}
					/>
				</div>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (questionDialogOpen = false)}>Cancel</Button>
			<Button
				onclick={saveQuestion}
				disabled={saving === 'question' || !questionForm.question.trim()}
			>
				<Save class="mr-2 h-4 w-4" />
				Save question
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
