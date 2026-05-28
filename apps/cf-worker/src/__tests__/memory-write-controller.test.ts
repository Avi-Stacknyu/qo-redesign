import { describe, it, expect } from 'vitest';
import {
	generateDeterministicNodeId,
	buildGraphNode,
	shouldSkipDuplicate
} from '../services/memory-write-controller';

describe('MemoryWriteController', () => {
	describe('generateDeterministicNodeId', () => {
		it('produces same ID for same inputs', async () => {
			const id1 = await generateDeterministicNodeId('user_1', 'FACT', 'User prefers index funds');
			const id2 = await generateDeterministicNodeId('user_1', 'FACT', 'User prefers index funds');
			expect(id1).toBe(id2);
		});

		it('produces different IDs for different content', async () => {
			const id1 = await generateDeterministicNodeId('user_1', 'FACT', 'User prefers index funds');
			const id2 = await generateDeterministicNodeId('user_1', 'FACT', 'User prefers ETFs');
			expect(id1).not.toBe(id2);
		});

		it('produces different IDs for different users', async () => {
			const id1 = await generateDeterministicNodeId('user_1', 'FACT', 'Same text');
			const id2 = await generateDeterministicNodeId('user_2', 'FACT', 'Same text');
			expect(id1).not.toBe(id2);
		});

		it('produces 15-character ID', async () => {
			const id = await generateDeterministicNodeId('user_1', 'ENTITY', 'Test');
			expect(id).toHaveLength(15);
		});
	});

	describe('buildGraphNode', () => {
		it('creates a valid graph node from memory observation', () => {
			const node = buildGraphNode(
				'user_1',
				{
					nodeType: 'FACT',
					text: 'User prefers index funds',
					confidence: 0.9,
					title: 'Investment Preference',
					category: 'investment',
					groupKey: 'investment_style',
					data: {},
					visibility: { shareWithAgent: true, shareWithManager: false, shareWithAdmin: false }
				},
				'log_1'
			);

			expect(node.type).toBe('FACT');
			expect(node.data.text).toBe('User prefers index funds');
			expect(node.data.title).toBe('Investment Preference');
			expect(node.data.category).toBe('investment');
			expect(node.data.groupKey).toBe('investment_style');
			expect(node.data.source).toBe('extraction::log_1');
			expect(node.data.share_with_manager).toBe(false);
			expect(node.data.hidden_from_agent).toBe(false);
			expect(node.confidence).toBe(0.9);
		});

		it('omits optional fields when not provided', () => {
			const node = buildGraphNode(
				'user_1',
				{
					nodeType: 'FACT',
					text: 'Simple fact',
					confidence: 0.7,
					data: {},
					visibility: { shareWithAgent: true, shareWithManager: false, shareWithAdmin: false }
				},
				'log_2'
			);

			expect(node.data.title).toBeUndefined();
			expect(node.data.category).toBeUndefined();
			expect(node.data.groupKey).toBeUndefined();
		});
	});

	describe('shouldSkipDuplicate', () => {
		it('skips when existing node has higher confidence', () => {
			const existing = { confidence: 0.95, data: { text: 'Same text' } };
			expect(shouldSkipDuplicate(existing, 0.8)).toBe(true);
		});

		it('does not skip when incoming has higher confidence', () => {
			const existing = { confidence: 0.6, data: { text: 'Same text' } };
			expect(shouldSkipDuplicate(existing, 0.9)).toBe(false);
		});

		it('does not skip when existing is null (new node)', () => {
			expect(shouldSkipDuplicate(null, 0.5)).toBe(false);
		});
	});
});
