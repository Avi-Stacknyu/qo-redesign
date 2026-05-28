/**
 * Asset Service
 * Handles uploads and storage of avatars, icons, logos, and other small media assets
 * All assets are stored in R2 bucket under asset-specific paths
 */

import type { R2Bucket } from '@cloudflare/workers-types';
import { createLogger, formatError } from '../utils/logger';

const log = createLogger('AssetService');

export interface AssetUploadResult {
	success: boolean;
	assetId: string;
	path: string;
	url: string;
	error?: string;
}

export type AssetType =
	| 'agent_avatar'
	| 'profiler_avatar'
	| 'provider_logo'
	| 'tool_icon'
	| 'analytical_tool_icon'
	| 'widget_icon'
	| 'template_icon'
	| 'template_preview'
	| 'profile_icon'
	| 'bookmark_favicon'
	| 'bookmark_image';

interface AssetConfig {
	table: string;
	column: string;
	folder: string;
	maxSize: number; // bytes
	allowedMimeTypes: string[];
}

const ASSET_CONFIGS: Record<AssetType, AssetConfig> = {
	agent_avatar: {
		table: 'ai_agents',
		column: 'avatar',
		folder: 'assets/avatars/ai_agents',
		maxSize: 5 * 1024 * 1024, // 5MB
		allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
	},
	profiler_avatar: {
		table: 'profiler_agents',
		column: 'avatar',
		folder: 'assets/avatars/profiler_agents',
		maxSize: 5 * 1024 * 1024,
		allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
	},
	provider_logo: {
		table: 'ai_providers',
		column: 'logo',
		folder: 'assets/logos/ai_providers',
		maxSize: 2 * 1024 * 1024, // 2MB
		allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
	},
	tool_icon: {
		table: 'ai_tools',
		column: 'icon',
		folder: 'assets/icons/ai_tools',
		maxSize: 2 * 1024 * 1024,
		allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
	},
	analytical_tool_icon: {
		table: 'analytical_tools',
		column: 'icon',
		folder: 'assets/icons/analytical_tools',
		maxSize: 2 * 1024 * 1024,
		allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
	},
	widget_icon: {
		table: 'dashboard_widgets',
		column: 'icon',
		folder: 'assets/icons/dashboard_widgets',
		maxSize: 2 * 1024 * 1024,
		allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
	},
	template_icon: {
		table: 'dashboard_templates',
		column: 'icon',
		folder: 'assets/icons/dashboard_templates',
		maxSize: 2 * 1024 * 1024,
		allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
	},
	template_preview: {
		table: 'dashboard_templates',
		column: 'previewImage',
		folder: 'assets/previews/dashboard_templates',
		maxSize: 10 * 1024 * 1024, // 10MB for preview images
		allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
	},
	profile_icon: {
		table: 'user_profiles',
		column: 'profileIcon',
		folder: 'assets/avatars/user_profiles',
		maxSize: 5 * 1024 * 1024,
		allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
	},
	bookmark_favicon: {
		table: 'user_bookmarks',
		column: 'favicon',
		folder: 'assets/favicons/user_bookmarks',
		maxSize: 1 * 1024 * 1024, // 1MB
		allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/x-icon']
	},
	bookmark_image: {
		table: 'user_bookmarks',
		column: 'image',
		folder: 'assets/previews/user_bookmarks',
		maxSize: 5 * 1024 * 1024,
		allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
	}
};

export class AssetServiceEntrypoint {
	private bucket: R2Bucket;
	private r2Domain: string;

	constructor(bucket: R2Bucket, r2Domain: string) {
		this.bucket = bucket;
		this.r2Domain = r2Domain;
	}

	/**
	 * Upload a new asset and store path in database column
	 * Returns the stored path to use in the database
	 */
	async uploadAsset(params: {
		assetType: AssetType;
		recordId: string;
		fileBuffer: ArrayBuffer;
		fileName: string;
		mimeType: string;
	}): Promise<AssetUploadResult> {
		try {
			const config = ASSET_CONFIGS[params.assetType];
			if (!config) {
				return {
					success: false,
					assetId: params.recordId,
					path: '',
					url: '',
					error: `Unknown asset type: ${params.assetType}`
				};
			}

			// Validate file size
			if (params.fileBuffer.byteLength > config.maxSize) {
				return {
					success: false,
					assetId: params.recordId,
					path: '',
					url: '',
					error: `File too large. Max size: ${config.maxSize / 1024 / 1024}MB`
				};
			}

			// Validate MIME type
			if (!config.allowedMimeTypes.includes(params.mimeType)) {
				return {
					success: false,
					assetId: params.recordId,
					path: '',
					url: '',
					error: `Unsupported file type: ${params.mimeType}`
				};
			}

			// Generate storage path: {folder}/{recordId}/{fileName}
			const storagePath = `${config.folder}/${params.recordId}/${params.fileName}`;

			// Upload to R2
			await this.bucket.put(storagePath, params.fileBuffer, {
				httpMetadata: {
					contentType: params.mimeType,
					cacheControl: 'public, max-age=31536000' // 1 year
				}
			});

			return {
				success: true,
				assetId: params.recordId,
				path: storagePath,
				url: `https://${this.r2Domain}/${storagePath}`,
				error: undefined
			};
		} catch (error) {
			return {
				success: false,
				assetId: params.recordId,
				path: '',
				url: '',
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Get the full R2 URL for an asset stored in the database.
	 * Uses full-path storage as primary; keeps filename fallback for legacy rows.
	 */
	async getAssetUrl(params: {
		assetType: AssetType;
		recordId: string;
		storedValue: string | null;
	}): Promise<string | null> {
		if (!params.storedValue) return null;

		const config = ASSET_CONFIGS[params.assetType];
		if (!config) return null;

		if (params.storedValue.startsWith('assets/')) {
			return `https://${this.r2Domain}/${params.storedValue}`;
		}

		// Otherwise, reconstruct the path from folder/recordId/filename
		const fullPath = `${config.folder}/${params.recordId}/${params.storedValue}`;
		return `https://${this.r2Domain}/${fullPath}`;
	}

	/**
	 * Delete an asset from R2.
	 * Uses full-path storage as primary; keeps filename fallback for legacy rows.
	 */
	async deleteAsset(params: {
		assetType: AssetType;
		recordId: string;
		storedValue: string;
	}): Promise<void> {
		try {
			const config = ASSET_CONFIGS[params.assetType];
			if (!config) return;

			let pathToDelete = params.storedValue;
			if (!params.storedValue.startsWith('assets/')) {
				// Reconstruct path from parts
				pathToDelete = `${config.folder}/${params.recordId}/${params.storedValue}`;
			}

			// Delete from R2
			await this.bucket.delete(pathToDelete);
		} catch (error) {
			log.error('asset_delete_failed', {
				assetType: params.assetType,
				recordId: params.recordId,
				storedValue: params.storedValue,
				...formatError(error)
			});
			// Don't throw - allow cleanup to continue even if file deletion fails
		}
	}

	/**
	 * Get the asset configuration for a given asset type
	 * Useful for frontend to know size limits, allowed types, etc.
	 */
	getAssetConfig(assetType: AssetType): AssetConfig | null {
		return ASSET_CONFIGS[assetType] || null;
	}
}
