export type LandingTeaser = {
	prompt: string;
	interactive: boolean;
	muted: boolean;
};

export function buildLandingTeasers(prompts: string[]): LandingTeaser[] {
	return prompts.slice(0, 2).map((prompt, index, source) => ({
		prompt,
		interactive: true,
		muted: index === 1 && source.length > 1
	}));
}