CREATE TABLE IF NOT EXISTS workspace_notifications (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  href text NOT NULL,
  occurred_at timestamptz NOT NULL,
  read_at timestamptz,
  dismissed_at timestamptz,
  PRIMARY KEY (user_id, event_key)
);
CREATE INDEX IF NOT EXISTS workspace_notifications_feed_idx
  ON workspace_notifications(user_id, occurred_at DESC) WHERE dismissed_at IS NULL;
ALTER TABLE workspace_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON workspace_notifications FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON workspace_notifications FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON workspace_notifications FROM authenticated;
  END IF;
END $$;
