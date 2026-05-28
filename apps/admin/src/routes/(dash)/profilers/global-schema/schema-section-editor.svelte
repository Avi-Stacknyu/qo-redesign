<script lang="ts">
	import { Button } from '$lib/components/shadcn/button';
	import Plus from '@lucide/svelte/icons/plus';
	import {
		DndContext,
		PointerSensor,
		closestCenter,
		useSensor,
		useSensors,
		type DragEndEvent
	} from '@dnd-kit-svelte/core';
	import {
		SortableContext,
		verticalListSortingStrategy,
		arrayMove
	} from '@dnd-kit-svelte/sortable';
	import SortableSection from './sortable-section.svelte';

	export interface SchemaField {
		key: string;
		label: string;
		type: 'text' | 'number' | 'date' | 'list';
		description: string;
	}

	export interface SchemaSection {
		section_id: string;
		label: string;
		icon: string;
		order: number;
		fields: SchemaField[];
	}

	let {
		sections = $bindable<SchemaSection[]>([]),
		onchange
	}: {
		sections: SchemaSection[];
		onchange?: (sections: SchemaSection[]) => void;
	} = $props();

	let expandedSections = $state<Set<string>>(new Set());

	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

	let sectionIds = $derived(sections.map((s) => s.section_id));

	function emit() {
		// Auto-assign order from position
		sections = sections.map((s, i) => ({ ...s, order: i + 1 }));
		onchange?.(sections);
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const oldIndex = sections.findIndex((s) => s.section_id === active.id);
		const newIndex = sections.findIndex((s) => s.section_id === over.id);
		if (oldIndex === -1 || newIndex === -1) return;
		sections = arrayMove(sections, oldIndex, newIndex);
		emit();
	}

	function toggleExpanded(sectionId: string) {
		const next = new Set(expandedSections);
		if (next.has(sectionId)) {
			next.delete(sectionId);
		} else {
			next.add(sectionId);
		}
		expandedSections = next;
	}

	function addSection() {
		const nextOrder = sections.length + 1;
		const newId = `section_${Date.now()}`;
		sections = [
			...sections,
			{ section_id: newId, label: '', icon: 'user', order: nextOrder, fields: [] }
		];
		expandedSections = new Set([...expandedSections, newId]);
		emit();
	}

	function removeSection(index: number) {
		const removed = sections[index];
		sections = sections.filter((_, i) => i !== index);
		if (removed) {
			const next = new Set(expandedSections);
			next.delete(removed.section_id);
			expandedSections = next;
		}
		emit();
	}

	function updateSection(index: number, key: keyof SchemaSection, value: unknown) {
		sections = sections.map((s, i) => (i === index ? { ...s, [key]: value } : s));
		emit();
	}

	function addField(sectionIndex: number) {
		const section = sections[sectionIndex];
		const updatedFields = [
			...section.fields,
			{ key: '', label: '', type: 'text' as const, description: '' }
		];
		sections = sections.map((s, i) => (i === sectionIndex ? { ...s, fields: updatedFields } : s));
		emit();
	}

	function removeField(sectionIndex: number, fieldIndex: number) {
		const section = sections[sectionIndex];
		const updatedFields = section.fields.filter((_, i) => i !== fieldIndex);
		sections = sections.map((s, i) => (i === sectionIndex ? { ...s, fields: updatedFields } : s));
		emit();
	}

	function updateField(
		sectionIndex: number,
		fieldIndex: number,
		key: keyof SchemaField,
		value: string
	) {
		const section = sections[sectionIndex];
		const updatedFields = section.fields.map((f, i) =>
			i === fieldIndex ? { ...f, [key]: value } : f
		);
		sections = sections.map((s, i) => (i === sectionIndex ? { ...s, fields: updatedFields } : s));
		emit();
	}
</script>

<div class="space-y-3">
	<DndContext {sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
		<SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
			{#each sections as section, si (section.section_id)}
				<SortableSection
					{section}
					index={si}
					expanded={expandedSections.has(section.section_id)}
					ontoggle={() => toggleExpanded(section.section_id)}
					onremove={() => removeSection(si)}
					onupdate={(key, value) => updateSection(si, key, value)}
					onaddfield={() => addField(si)}
					onremovefield={(fi) => removeField(si, fi)}
					onupdatefield={(fi, key, value) => updateField(si, fi, key, value)}
				/>
			{/each}
		</SortableContext>
	</DndContext>

	<Button variant="outline" size="sm" type="button" class="w-full gap-1.5" onclick={addSection}>
		<Plus class="size-3.5" />
		Add Section
	</Button>
</div>
