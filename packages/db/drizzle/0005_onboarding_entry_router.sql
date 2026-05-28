-- Entry Router: profiles, campaigns, invite codes, assignments
CREATE TABLE IF NOT EXISTS config_onboarding_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  industry_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  is_active BOOLEAN DEFAULT false,
  model TEXT,
  system_prompt TEXT,
  max_ai_questions NUMERIC,
  session_timeout_ms NUMERIC,
  cache_ttl_ms NUMERIC,
  enable_trial_activation BOOLEAN DEFAULT true,
  created TIMESTAMPTZ,
  updated TIMESTAMPTZ,
  CONSTRAINT fk_onboarding_profiles_model FOREIGN KEY (model) REFERENCES ai_agent_models(id) ON DELETE SET NULL,
  CONSTRAINT fk_onboarding_profiles_system_prompt FOREIGN KEY (system_prompt) REFERENCES ai_prompts(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_profiles_key ON config_onboarding_profiles (key);
CREATE INDEX IF NOT EXISTS idx_onboarding_profiles_status ON config_onboarding_profiles USING btree (status ASC NULLS LAST);

CREATE TABLE IF NOT EXISTS config_onboarding_profile_questions (
  id TEXT PRIMARY KEY NOT NULL,
  profile TEXT NOT NULL,
  question TEXT,
  type TEXT,
  description TEXT,
  sidebar_title TEXT,
  fact_key TEXT,
  options JSONB,
  "order" NUMERIC,
  enabled BOOLEAN DEFAULT true,
  required BOOLEAN DEFAULT true,
  show_when JSONB,
  "group" TEXT,
  metadata JSONB,
  created TIMESTAMPTZ,
  updated TIMESTAMPTZ,
  CONSTRAINT fk_onboarding_profile_questions_profile FOREIGN KEY (profile) REFERENCES config_onboarding_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_onboarding_profile_questions_profile_order ON config_onboarding_profile_questions USING btree (profile ASC NULLS LAST, "order" ASC NULLS LAST);

CREATE TABLE IF NOT EXISTS config_onboarding_campaigns (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  organization_key TEXT,
  organization_name TEXT,
  source_type TEXT NOT NULL,
  default_profile TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created TIMESTAMPTZ,
  updated TIMESTAMPTZ,
  CONSTRAINT fk_onboarding_campaigns_profile FOREIGN KEY (default_profile) REFERENCES config_onboarding_profiles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_campaigns_slug ON config_onboarding_campaigns (slug);

CREATE TABLE IF NOT EXISTS config_onboarding_invite_codes (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL,
  campaign TEXT NOT NULL,
  profile_override TEXT,
  code_type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  metadata JSONB,
  created TIMESTAMPTZ,
  updated TIMESTAMPTZ,
  CONSTRAINT fk_onboarding_invite_codes_campaign FOREIGN KEY (campaign) REFERENCES config_onboarding_campaigns(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_invite_codes_code ON config_onboarding_invite_codes (code);

CREATE TABLE IF NOT EXISTS user_onboarding_assignments (
  id TEXT PRIMARY KEY NOT NULL,
  "user" TEXT NOT NULL,
  profile TEXT NOT NULL,
  campaign TEXT,
  invite_code TEXT,
  resolution_source TEXT NOT NULL,
  source_value TEXT,
  locked_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  transcript JSONB,
  created TIMESTAMPTZ,
  updated TIMESTAMPTZ,
  CONSTRAINT fk_user_onboarding_assignments_profile FOREIGN KEY (profile) REFERENCES config_onboarding_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_assignments_user ON user_onboarding_assignments USING btree ("user" ASC NULLS LAST);
