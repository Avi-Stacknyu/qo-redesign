import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			platformProxy: {
				persist: true
			}
		}),
		alias: {
			$ui: 'src/lib/components/shadcn',
			'$ui/*': 'src/lib/components/shadcn/*'
		},
		experimental: {
			remoteFunctions: true
		}
	},
	compilerOptions: {
		experimental: {
			async: true
		}
	},
	vitePlugin: {
		inspector: true
	}
};

export default config;
