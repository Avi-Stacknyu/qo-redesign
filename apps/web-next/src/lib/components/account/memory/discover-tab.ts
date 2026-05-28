import type { ProfileSection } from '$lib/data/profile-types';

export type SectionAccent = 'violet' | 'slate' | 'emerald';

export type SectionProgress = {
	sectionId: string;
	label: string;
	progress: number;
	accent: SectionAccent;
};

export type DiscoveryChat = {
	sendMessage: (message: { text: string }) => Promise<void>;
};

export function buildOnboardingSections(sections: ProfileSection[]): SectionProgress[] {
	return [...sections]
		.sort((a, b) => a.order - b.order)
		.map((section) => ({
			sectionId: section.sectionId,
			label: section.label,
			progress: section.completionPct,
			accent:
				section.completionPct === 100
					? 'emerald'
					: section.completionPct >= 40
						? 'violet'
						: 'slate'
		}));
}

export function buildDiscoveryPrompt(section: ProfileSection): string {
	const emptyFields = section.fields.filter((field) => field.isSchema && !field.value.trim());
	if (emptyFields.length === 0) {
		return `Let's review my ${section.label.toLowerCase()} information - is everything still accurate?`;
	}

	const knownFields = section.fields.filter((field) => field.isSchema && field.value.trim());
	const knownFieldsText = knownFields
		.slice(0, 3)
		.map((field) => field.label.toLowerCase())
		.join(', ');
	const knownFieldsPrefix = knownFieldsText ? `You already know my ${knownFieldsText}. ` : '';

	return `Help me fill in my ${section.label.toLowerCase()} section. ${knownFieldsPrefix}I have ${emptyFields.length} fields left.`;
}

export async function sendDiscoveryPrompt({
	text,
	currentChat,
	ensureChat
}: {
	text: string;
	currentChat: DiscoveryChat | null;
	ensureChat: () => Promise<DiscoveryChat>;
}) {
	const trimmedText = text.trim();
	if (!trimmedText) return;

	const chat = currentChat ?? (await ensureChat());
	await chat.sendMessage({ text: trimmedText });
}