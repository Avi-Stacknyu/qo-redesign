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
      $ui: 'src/lib/components/ui',
      '$ui/*': 'src/lib/components/ui/*'
    },
    experimental: {
      remoteFunctions: true
    }
  },
  compilerOptions: {
    experimental: {
      async: true
    },
    // Force runes mode for the project, except for libraries. Can be removed in Svelte 6.
    runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
  }
};

export default config;
