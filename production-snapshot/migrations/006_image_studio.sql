-- PostgreSQL schema for Image Studio assets and asynchronous job queue
CREATE TABLE IF NOT EXISTS generated_assets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url text NOT NULL,
  filename text NOT NULL UNIQUE,
  prompt text NOT NULL,
  negative_prompt text,
  style text NOT NULL,
  aspect_ratio text NOT NULL,
  seed bigint NOT NULL,
  steps integer NOT NULL DEFAULT 4,
  cfg_scale real NOT NULL DEFAULT 1.0,
  width integer NOT NULL,
  height integer NOT NULL,
  duration_ms integer NOT NULL DEFAULT 0,
  operation text NOT NULL DEFAULT 'generate',
  source_asset_id text,
  source_name text,
  strength real,
  render_kind text NOT NULL DEFAULT 'generated',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_assets_user_idx ON generated_assets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS generated_assets_created_idx ON generated_assets(created_at DESC);

CREATE TABLE IF NOT EXISTS image_jobs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  negative_prompt text,
  style text NOT NULL,
  aspect_ratio text NOT NULL,
  seed bigint NOT NULL,
  steps integer NOT NULL DEFAULT 4,
  cfg_scale real NOT NULL DEFAULT 1.0,
  width integer NOT NULL,
  height integer NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  operation text NOT NULL DEFAULT 'generate',
  source_asset_id text,
  source_name text,
  reference_filename text,
  strength real,
  progress integer NOT NULL DEFAULT 0,
  stage_text text NOT NULL DEFAULT '',
  error text,
  asset jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  estimated_duration_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS image_jobs_user_status_idx ON image_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS image_jobs_active_idx ON image_jobs(status, created_at ASC) WHERE status IN ('queued', 'processing');
