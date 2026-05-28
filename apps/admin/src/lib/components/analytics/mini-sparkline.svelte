<script lang="ts">
	interface DataPoint {
		value: number;
	}

	interface Props {
		data: DataPoint[];
		width?: number;
		height?: number;
		color?: string;
		fillOpacity?: number;
		class?: string;
	}

	let {
		data,
		width = 120,
		height = 32,
		color = 'var(--chart-1)',
		fillOpacity = 0.15,
		class: className = ''
	}: Props = $props();

	const padding = 2;

	const pathD = $derived.by(() => {
		if (data.length < 2) return '';
		const values = data.map((d) => d.value);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min || 1;

		const innerW = width - padding * 2;
		const innerH = height - padding * 2;
		const step = innerW / (values.length - 1);

		const points = values.map((v, i) => ({
			x: padding + i * step,
			y: padding + innerH - ((v - min) / range) * innerH
		}));

		const line = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

		return line;
	});

	const fillD = $derived.by(() => {
		if (data.length < 2) return '';
		const values = data.map((d) => d.value);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min || 1;

		const innerW = width - padding * 2;
		const innerH = height - padding * 2;
		const step = innerW / (values.length - 1);

		const points = values.map((v, i) => ({
			x: padding + i * step,
			y: padding + innerH - ((v - min) / range) * innerH
		}));

		const line = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
		const lastX = points[points.length - 1].x;
		const firstX = points[0].x;
		const bottom = height - padding;

		return `${line} L ${lastX} ${bottom} L ${firstX} ${bottom} Z`;
	});
</script>

<svg
	{width}
	{height}
	viewBox="0 0 {width} {height}"
	class="shrink-0 {className}"
	role="img"
	aria-label="Sparkline chart"
>
	{#if data.length >= 2}
		<path d={fillD} fill={color} opacity={fillOpacity} />
		<path
			d={pathD}
			fill="none"
			stroke={color}
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{:else}
		<line
			x1={padding}
			y1={height / 2}
			x2={width - padding}
			y2={height / 2}
			stroke={color}
			stroke-width="1"
			stroke-dasharray="2 2"
		/>
	{/if}
</svg>
