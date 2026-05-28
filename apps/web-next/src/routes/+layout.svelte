<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import { NavigationLoader } from '@wabosh/navigation-loader';

  let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<NavigationLoader animationDuration={250} color="#8b5cf6" height={4} />
{@render children()}
