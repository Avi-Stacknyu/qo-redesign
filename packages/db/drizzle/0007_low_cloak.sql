CREATE TABLE "user_onboarding_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"email" text,
	"profile" text,
	"assignment" text,
	"event_type" text NOT NULL,
	"status" text,
	"question_id" text,
	"fact_key" text,
	"prompt" text,
	"answer" text,
	"answer_text" text,
	"phase" text,
	"metadata" jsonb,
	"created" timestamp with time zone,
	"updated" timestamp with time zone
);
ALTER TABLE "user_onboarding_audit_events" ADD CONSTRAINT "fk_oboa_user" FOREIGN KEY ("user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_onboarding_audit_events" ADD CONSTRAINT "fk_oboa_profile" FOREIGN KEY ("profile") REFERENCES "public"."config_onboarding_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_onboarding_audit_events" ADD CONSTRAINT "fk_oboa_assignment" FOREIGN KEY ("assignment") REFERENCES "public"."user_onboarding_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_oboa_user" ON "user_onboarding_audit_events" USING btree ("user" text_ops);--> statement-breakpoint
CREATE INDEX "idx_oboa_assignment" ON "user_onboarding_audit_events" USING btree ("assignment" text_ops);--> statement-breakpoint
CREATE INDEX "idx_oboa_profile" ON "user_onboarding_audit_events" USING btree ("profile" text_ops);--> statement-breakpoint
CREATE INDEX "idx_oboa_event_type" ON "user_onboarding_audit_events" USING btree ("event_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_oboa_created" ON "user_onboarding_audit_events" USING btree ("created");