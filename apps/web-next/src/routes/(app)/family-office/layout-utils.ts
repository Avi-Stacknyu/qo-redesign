/** BFS hierarchical tree layout for family office flow graph */

interface Layoutable {
	id: string;
	parent_id?: string;
}

const NODE_WIDTH = 270;
const GAP_X = 40;
const GAP_Y = 100;
const NODE_HEIGHT = 160;

export function layoutHierarchical<T extends Layoutable>(
	list: T[]
): Map<string, { x: number; y: number }> {
	const positions = new Map<string, { x: number; y: number }>();
	const childMap = new Map<string, T[]>();

	for (const m of list) {
		if (m.parent_id) {
			const siblings = childMap.get(m.parent_id) ?? [];
			siblings.push(m);
			childMap.set(m.parent_id, siblings);
		}
	}

	const roots = list.filter((m) => !m.parent_id);
	let currentY = 40;
	let level: T[] = roots.length ? roots : list.slice(0, 1);

	while (level.length > 0) {
		const totalW = level.length * NODE_WIDTH + (level.length - 1) * GAP_X;
		let x = Math.max(40, (900 - totalW) / 2);

		for (const node of level) {
			positions.set(node.id, { x, y: currentY });
			x += NODE_WIDTH + GAP_X;
		}

		const next: T[] = [];
		for (const node of level) {
			next.push(...(childMap.get(node.id) ?? []));
		}
		level = next;
		currentY += GAP_Y + NODE_HEIGHT;
	}

	for (const m of list) {
		if (!positions.has(m.id)) {
			positions.set(m.id, { x: 40 + positions.size * 150, y: currentY });
		}
	}

	return positions;
}
