/**
 * Environment variable type augmentation for Cloudflare Workers secrets/vars.
 *
 * worker-configuration.d.ts only includes bindings from wrangler.jsonc (R2, DO, AI, etc.).
 * Secrets and vars set at deployment time must be declared here so TypeScript
 * sees the full Env shape. This file survives `wrangler types` regeneration.
 */
declare namespace Cloudflare {
	interface Env {
		// Runtime mode
		IS_DEV?: string;

		// File hosting (serves avatar files)
		FILE_HOST_URL: string;

		// R2 public domain for asset URLs
		R2_DOMAIN: string;

		// Stripe
		STRIPE_SECRET_KEY: string;
		STRIPE_WEBHOOK_SECRET: string;
		STRIPE_PORTAL_RETURN_URL: string;

		// AI provider keys
		ANTHROPIC_API_KEY: string;
		OPENAI_API_KEY: string;
		GOOGLE_AI_API_KEY: string;
		XAI_API_KEY: string;

		// Email
		AUTH_FROM_EMAIL?: string;
		AUTH_FROM_NAME?: string;

		// PostHog observability
		POSTHOG_TOKEN?: string;
		POSTHOG_HOST?: string;
	}
}
