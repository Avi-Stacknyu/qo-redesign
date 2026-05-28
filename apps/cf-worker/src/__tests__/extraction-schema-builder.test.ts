import { describe, it, expect } from 'vitest';
import { buildExtractionSchema, type SchemaSection } from '../services/extraction-schema-builder';

describe('buildExtractionSchema', () => {
	const sections: SchemaSection[] = [
		{
			sectionId: 'financial_overview',
			fields: [
				{ key: 'annual_income', label: 'Annual Income', type: 'string' },
				{ key: 'risk_tolerance', label: 'Risk Tolerance', type: 'string' }
			]
		},
		{
			sectionId: 'personal_info',
			fields: [
				{ key: 'full_name', label: 'Full Name', type: 'string' },
				{ key: 'age', label: 'Age', type: 'number' }
			]
		}
	];

	it('produces a Zod schema that validates correct extraction output', () => {
		const schema = buildExtractionSchema(sections);
		const valid = {
			profileUpdates: [
				{
					sectionId: 'financial_overview',
					fields: {
						annual_income: { value: '150000', confidence: 0.85, reasoning: 'User stated income' }
					}
				}
			],
			memoryObservations: [],
			schemaProposals: []
		};

		const result = schema.safeParse(valid);
		expect(result.success).toBe(true);
	});

	it('accepts discovered section IDs in profileUpdates', () => {
		const schema = buildExtractionSchema(sections);
		const valid = {
			profileUpdates: [
				{
					sectionId: 'nonexistent_section',
					sectionLabel: 'Nonexistent Section',
					fields: { foo: { value: 'bar', label: 'Foo', confidence: 0.5, reasoning: 'test' } }
				}
			],
			memoryObservations: [],
			schemaProposals: []
		};

		const result = schema.safeParse(valid);
		expect(result.success).toBe(true);
	});

	it('accepts valid memoryObservations with all node types', () => {
		const schema = buildExtractionSchema(sections);
		const valid = {
			profileUpdates: [],
			memoryObservations: [
				{
					nodeType: 'FACT',
					text: 'User prefers index funds',
					confidence: 0.9,
					visibility: { shareWithAgent: true, shareWithManager: false, shareWithAdmin: false }
				},
				{
					nodeType: 'INSIGHT',
					text: 'Client is risk averse based on multiple conversations',
					confidence: 0.7,
					groupKey: 'risk_profile',
					category: 'behavioral',
					visibility: { shareWithAgent: true, shareWithManager: true, shareWithAdmin: false }
				}
			],
			schemaProposals: []
		};

		const result = schema.safeParse(valid);
		expect(result.success).toBe(true);
	});

	it('handles empty sections array and still accepts discovered profile updates', () => {
		const schema = buildExtractionSchema([]);
		const valid = {
			profileUpdates: [
				{
					sectionId: 'financial_overview',
					sectionLabel: 'Financial Overview',
					fields: {
						net_worth_range: {
							value: '$1M-$2M',
							label: 'Net Worth Range',
							confidence: 0.8,
							reasoning: 'User stated this range'
						}
					}
				}
			],
			memoryObservations: [],
			schemaProposals: []
		};

		const result = schema.safeParse(valid);
		expect(result.success).toBe(true);
	});

	it('rejects confidence outside 0-1 range', () => {
		const schema = buildExtractionSchema(sections);
		const invalid = {
			profileUpdates: [
				{
					sectionId: 'financial_overview',
					fields: { annual_income: { value: '150k', confidence: 1.5, reasoning: 'test' } }
				}
			],
			memoryObservations: [],
			schemaProposals: []
		};

		const result = schema.safeParse(invalid);
		expect(result.success).toBe(false);
	});
});
