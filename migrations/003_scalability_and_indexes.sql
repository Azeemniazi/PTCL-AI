-- Foreign-key and hot-lookup indexes for scalability
CREATE INDEX IF NOT EXISTS meetings_active_status_idx
  ON meetings (status)
  WHERE status IN ('launching', 'joining', 'waiting_room', 'recording', 'processing', 'stopping');

CREATE INDEX IF NOT EXISTS meetings_engine_id_idx
  ON meetings (engine_id, created_at DESC)
  WHERE engine_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS meetings_ended_encrypted_url_idx
  ON meetings (ended_at)
  WHERE encrypted_url IS NOT NULL AND ended_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS participants_meeting_id_idx
  ON participants (meeting_id, joined_at);

CREATE INDEX IF NOT EXISTS snapshots_meeting_captured_idx
  ON snapshots (meeting_id, captured_at_ms);

CREATE INDEX IF NOT EXISTS audit_events_meeting_created_idx
  ON audit_events (meeting_id, created_at DESC)
  WHERE meeting_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_events_created_idx
  ON audit_events (created_at DESC);
