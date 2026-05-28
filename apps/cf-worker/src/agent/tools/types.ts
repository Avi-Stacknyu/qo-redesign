import type { Database } from '@repo/db/types';
import type { Env } from '../../types';
import type { FlowCostTracker } from '../../types/flow';
import type { RAGService } from '../../services/rag-service';

export interface ToolContext {
	db: Database;
	env: Env;
	userId: string;
	sessionId: string;
	chatId?: string;
	agentId?: string;
	costTracker: FlowCostTracker;
	timezone?: string;
	webSearchEnabled?: boolean;
	// RAG service for proper hybrid search (vector + FTS + reranking + graph)
	ragService?: RAGService;
	// Tier-gated tool IDs — when non-empty, only these tools are allowed
	allowedToolIds?: Set<string>;
}
