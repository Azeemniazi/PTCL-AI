CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY, tenant_id text NOT NULL, object_id text NOT NULL,
  email text NOT NULL, display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('member','admin')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, object_id)
);
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), engine_id text,
  encrypted_url text, title text NOT NULL DEFAULT 'Microsoft Teams meeting', bot_name text NOT NULL,
  status text NOT NULL, failure_code text, failure_message text, recording_object_key text,
  consented_at timestamptz NOT NULL, started_at timestamptz, ended_at timestamptz,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meetings_owner_idx ON meetings(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS meetings_status_idx ON meetings(status);
CREATE INDEX IF NOT EXISTS meetings_expiry_idx ON meetings(expires_at);
CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY, meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  external_id text, display_name text NOT NULL, joined_at timestamptz NOT NULL, left_at timestamptz
);
CREATE TABLE IF NOT EXISTS transcript_segments (
  id uuid PRIMARY KEY, meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  speaker_name text, start_ms integer NOT NULL, end_ms integer NOT NULL,
  text text NOT NULL, confidence real, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transcript_meeting_time_idx ON transcript_segments(meeting_id, start_ms);
CREATE UNIQUE INDEX IF NOT EXISTS transcript_segments_dedupe_idx ON transcript_segments(meeting_id,start_ms,end_ms,text);
CREATE TABLE IF NOT EXISTS snapshots (
  id uuid PRIMARY KEY, meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  object_key text NOT NULL, captured_at_ms integer NOT NULL, perceptual_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS meeting_summaries (
  id uuid PRIMARY KEY, meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  version integer NOT NULL, content jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, version)
);
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY, actor_id uuid, meeting_id uuid, event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
