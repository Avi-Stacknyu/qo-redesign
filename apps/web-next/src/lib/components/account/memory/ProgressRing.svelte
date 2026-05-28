<script lang="ts">
	let {
		value = 57,
		size = 62,
		stroke = 6,
		trackColor = '#D8E5FF',
		fillColor = '#7C4DFF',
		label = `${value}%`
	}: {
		value?: number;
		size?: number;
		stroke?: number;
		trackColor?: string;
		fillColor?: string;
		label?: string;
	} = $props();

	const clampedValue = $derived(Math.max(0, Math.min(100, value)));
	const ringStyle = $derived(
		`background: conic-gradient(${fillColor} 0 ${clampedValue}%, ${trackColor} ${clampedValue}% 100%); width: ${size}px; height: ${size}px;`
	);
	const innerStyle = $derived(`width: ${size - stroke * 2}px; height: ${size - stroke * 2}px;`);
</script>

<div
	class="relative inline-flex items-center justify-center rounded-full"
	style={ringStyle}
	aria-label={`Progress ${clampedValue}%`}
>
	<div class="flex items-center justify-center rounded-full bg-white" style={innerStyle}>
		<span class="text-lg font-semibold text-[#4D5B75]">{label}</span>
	</div>
</div>