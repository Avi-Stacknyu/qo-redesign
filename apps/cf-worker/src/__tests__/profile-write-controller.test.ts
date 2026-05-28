import { describe, it, expect } from 'vitest';
import {
	evaluateWrite,
	type ExistingFieldMeta,
	type IncomingFieldUpdate
} from '../services/profile-write-controller';

describe('ProfileWriteController', () => {
	describe('evaluateWrite', () => {
		it('accepts first write to empty field', () => {
			const incoming: IncomingFieldUpdate = {
				fieldKey: 'annual_income',
				sectionId: 'financial',
				value: '150000',
				confidence: 0.8,
				source: 'chat',
				extractionLogId: 'log_1'
			};

			const decision = evaluateWrite(incoming, null);
			expect(decision.action).toBe('write');
		});

		it('rejects chat overwriting onboarding with different value', () => {
			const existing: ExistingFieldMeta = {
				value: '200000',
				confidence: 0.95,
				source: 'onboarding',
				extractionLogId: 'log_0',
				updatedAt: '2026-05-01T00:00:00Z'
			};
			const incoming: IncomingFieldUpdate = {
				fieldKey: 'annual_income',
				sectionId: 'financial',
				value: '150000',
				confidence: 0.8,
				source: 'chat',
				extractionLogId: 'log_1'
			};

			const decision = evaluateWrite(incoming, existing);
			expect(decision.action).toBe('skip');
			expect(decision.reason).toContain('lower source');
		});

		it('allows same-source overwrite with higher confidence', () => {
			const existing: ExistingFieldMeta = {
				value: '150000',
				confidence: 0.6,
				source: 'chat',
				extractionLogId: 'log_0',
				updatedAt: '2026-05-01T00:00:00Z'
			};
			const incoming: IncomingFieldUpdate = {
				fieldKey: 'annual_income',
				sectionId: 'financial',
				value: '160000',
				confidence: 0.85,
				source: 'chat',
				extractionLogId: 'log_1'
			};

			const decision = evaluateWrite(incoming, existing);
			expect(decision.action).toBe('write');
		});

		it('updates timestamp when lower source agrees on value', () => {
			const existing: ExistingFieldMeta = {
				value: '150000',
				confidence: 0.95,
				source: 'onboarding',
				extractionLogId: 'log_0',
				updatedAt: '2026-05-01T00:00:00Z'
			};
			const incoming: IncomingFieldUpdate = {
				fieldKey: 'annual_income',
				sectionId: 'financial',
				value: '150000',
				confidence: 0.8,
				source: 'chat',
				extractionLogId: 'log_1'
			};

			const decision = evaluateWrite(incoming, existing);
			expect(decision.action).toBe('update_timestamp');
		});

		it('rejects confidence below 0.3 as noise', () => {
			const incoming: IncomingFieldUpdate = {
				fieldKey: 'annual_income',
				sectionId: 'financial',
				value: 'maybe 100k',
				confidence: 0.2,
				source: 'chat',
				extractionLogId: 'log_1'
			};

			const decision = evaluateWrite(incoming, null);
			expect(decision.action).toBe('skip');
			expect(decision.reason).toContain('below threshold');
		});

		it('allows user_edit to overwrite anything', () => {
			const existing: ExistingFieldMeta = {
				value: '150000',
				confidence: 0.95,
				source: 'onboarding',
				extractionLogId: 'log_0',
				updatedAt: '2026-05-01T00:00:00Z'
			};
			const incoming: IncomingFieldUpdate = {
				fieldKey: 'annual_income',
				sectionId: 'financial',
				value: '200000',
				confidence: 1.0,
				source: 'user_edit',
				extractionLogId: 'log_1'
			};

			const decision = evaluateWrite(incoming, existing);
			expect(decision.action).toBe('write');
		});
	});
});
