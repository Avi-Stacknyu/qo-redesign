import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		linterOptions: {
			reportUnusedDisableDirectives: 'off'
		},
		ignores: ['.svelte-kit/**', 'src/lib/components/shadcn/**'],
		languageOptions: {
			parserOptions: {
				tsconfigRootDir: import.meta.dirname,
				projectService: true
			},
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		rules: {
			'no-undef': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'svelte/valid-compile': 'off',
			'svelte/require-each-key': 'off',
			'svelte/prefer-svelte-reactivity': 'off',
			'svelte/no-navigation-without-resolve': 'off',
			'svelte/no-at-html-tags': 'off',
			'svelte/prefer-writable-derived': 'off',
			'svelte/no-useless-mustaches': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				tsconfigRootDir: import.meta.dirname,
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	}
);
