CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_document_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"file_key" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"text_content" text NOT NULL,
	"context" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"target" text NOT NULL,
	"relationship" text NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_graph_edges_src_tgt_rel" UNIQUE("user_id","source","target","relationship")
);
--> statement-breakpoint
CREATE TABLE "graph_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" real DEFAULT 1,
	"decay_score" real DEFAULT 1,
	"search_text" text GENERATED ALWAYS AS (coalesce(data->>'text', data->>'summary', data->>'name', '')) STORED,
	"search_ctx" text GENERATED ALWAYS AS (coalesce(data->>'context', data->>'category', '')) STORED,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_agents" DROP CONSTRAINT "fk_ai_agents_current_flow_ai_agent_flows";
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "fk_accounts_user_id_users" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_document_chunks" ADD CONSTRAINT "fk_graph_chunks_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "fk_graph_edges_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "fk_graph_edges_source" FOREIGN KEY ("source") REFERENCES "public"."graph_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "fk_graph_edges_target" FOREIGN KEY ("target") REFERENCES "public"."graph_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_nodes" ADD CONSTRAINT "fk_graph_nodes_user_id" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions_user_id_users" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_user_id" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_graph_chunks_user_file" ON "graph_document_chunks" USING btree ("user_id","file_key");--> statement-breakpoint
CREATE INDEX "idx_graph_chunks_search" ON "graph_document_chunks" USING gin (to_tsvector('english', "text_content" || ' ' || coalesce("context", '')));--> statement-breakpoint
CREATE INDEX "idx_graph_edges_user_source" ON "graph_edges" USING btree ("user_id","source");--> statement-breakpoint
CREATE INDEX "idx_graph_edges_user_target" ON "graph_edges" USING btree ("user_id","target");--> statement-breakpoint
CREATE INDEX "idx_graph_edges_relationship" ON "graph_edges" USING btree ("relationship");--> statement-breakpoint
CREATE INDEX "idx_graph_nodes_user_id" ON "graph_nodes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_graph_nodes_user_type" ON "graph_nodes" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "idx_graph_nodes_type" ON "graph_nodes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_graph_nodes_updated" ON "graph_nodes" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_graph_nodes_search" ON "graph_nodes" USING gin (to_tsvector('english', coalesce("search_text", '') || ' ' || coalesce("search_ctx", '')));--> statement-breakpoint
CREATE INDEX "idx_graph_nodes_data" ON "graph_nodes" USING gin ("data");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sessions_token" ON "sessions" USING btree ("token");