export type QuickActionItem = {
	label: string;
	icon: string;
	route?: string;
};

export type QuickActionsConfig = {
	actions?: QuickActionItem[];
};

export type ProfileSummaryConfig = {
	compact?: boolean;
};

export type NewsConfig = {
	source?: string;
	limit?: number;
};
