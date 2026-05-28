import { describe, expect, it } from 'vitest';

import { getScrollJumpState } from './scroll-jump-state';

describe('getScrollJumpState', () => {
	it('shows only the down button when the list is at the top and overflowing', () => {
		expect(
			getScrollJumpState({
				scrollTop: 0,
				clientHeight: 160,
				scrollHeight: 420
			})
		).toEqual({ canScrollUp: false, canScrollDown: true });
	});

	it('shows both buttons when the list is scrolled through the middle', () => {
		expect(
			getScrollJumpState({
				scrollTop: 120,
				clientHeight: 160,
				scrollHeight: 420
			})
		).toEqual({ canScrollUp: true, canScrollDown: true });
	});

	it('shows only the up button near the bottom edge', () => {
		expect(
			getScrollJumpState({
				scrollTop: 258,
				clientHeight: 160,
				scrollHeight: 420
			})
		).toEqual({ canScrollUp: true, canScrollDown: false });
	});

	it('shows neither button when the list does not overflow', () => {
		expect(
			getScrollJumpState({
				scrollTop: 0,
				clientHeight: 160,
				scrollHeight: 160
			})
		).toEqual({ canScrollUp: false, canScrollDown: false });
	});
});