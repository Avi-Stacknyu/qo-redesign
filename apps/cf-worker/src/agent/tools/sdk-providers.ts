/**
 * SDK Provider imports - this is the ONLY hardcoding needed
 * When adding a new provider: pnpm add @ai-sdk/<provider>, add import, add to SDK_PROVIDERS
 */

import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { xai } from '@ai-sdk/xai';
import { createLogger, formatError } from '../../utils/logger';

// ============================================================================
// SDK Providers Map (Minimal Hardcoding)
// ============================================================================

/**
 * Map of provider_key to SDK provider instance.
 * This is the ONLY hardcoded part - everything else is dynamic.
 *
 * To add a new provider:
 * 1. pnpm add @ai-sdk/<provider>
 * 2. Add import above
 * 3. Add entry here
 * 4. Add provider record in database
 */
const SDK_PROVIDERS: Record<string, any> = {
	google,
	anthropic,
	openai,
	xai
};

/**
 * Get an SDK tool dynamically by provider and tool name.
 *
 * This is fully dynamic - any tool exposed on provider.tools can be accessed
 * without adding any code. Just add the tool record to the database with:
 * - provider_key: "google", "anthropic", "openai", "xai"
 * - sdk_tool_name: The exact name on provider.tools (e.g., "googleSearch", "webSearch_20250305")
 * - execution_config: Config to pass to the tool factory
 */
export function getSdkTool(
	providerKey: string,
	sdkToolName: string,
	config?: Record<string, unknown>
): any | null {
	// 1. Get provider SDK instance
	const log = createLogger('Tools');
	const provider = SDK_PROVIDERS[providerKey];
	if (!provider) {
		log.warn('sdk_provider_not_found', { providerKey, available: Object.keys(SDK_PROVIDERS) });
		return null;
	}

	// 2. Check if provider has tools
	if (!provider.tools) {
		log.warn('sdk_provider_no_tools', { providerKey });
		return null;
	}

	// 3. Dynamic tool factory lookup
	const toolFactory = provider.tools[sdkToolName];
	if (typeof toolFactory !== 'function') {
		log.warn('sdk_tool_not_found', {
			sdkToolName,
			providerKey,
			available: Object.keys(provider.tools)
		});
		return null;
	}

	// 4. Create tool instance with optional config
	try {
		const hasConfig = config && Object.keys(config).length > 0;
		log.debug('sdk_tool_creating', { providerKey, sdkToolName, hasConfig });
		const tool = hasConfig ? toolFactory(config) : toolFactory();
		log.debug('sdk_tool_created', { providerKey, sdkToolName, type: typeof tool });
		return tool;
	} catch (error) {
		log.error('sdk_tool_create_failed', { providerKey, sdkToolName, ...formatError(error) });
		return null;
	}
}
