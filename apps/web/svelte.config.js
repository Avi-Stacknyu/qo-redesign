import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			platformProxy: {
				persist: true
			},
			routes: {
				include: ['/*'],
				exclude: ['<all>']
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
	}
};

export default config;
