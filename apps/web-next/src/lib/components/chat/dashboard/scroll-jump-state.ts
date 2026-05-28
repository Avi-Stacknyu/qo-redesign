export type ScrollMetrics = {
	scrollTop: number;
	clientHeight: number;
	scrollHeight: number;
	threshold?: number;
};

export type ScrollJumpState = {
	canScrollUp: boolean;
	canScrollDown: boolean;
};

export function getScrollJumpState({
	scrollTop,
	clientHeight,
	scrollHeight,
	threshold = 8
}: ScrollMetrics): ScrollJumpState {
	const maxScrollTop = Math.max(scrollHeight - clientHeight, 0);

	return {
		canScrollUp: scrollTop > threshold,
		canScrollDown: maxScrollTop - scrollTop > threshold
	};
}