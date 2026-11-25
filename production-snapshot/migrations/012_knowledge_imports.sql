CREATE TABLE IF NOT EXISTS knowledge_imports (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination_id uuid REFERENCES knowledge_folders(id) ON DELETE SET NULL,
  had_destination boolean NOT NULL,
  is_shared boolean NOT NULL,
  manifest_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

CREATE TABLE IF NOT EXISTS knowledge_import_items (
  id uuid PRIMARY KEY,
  import_id uuid NOT NULL REFERENCES knowledge_imports(id) ON DELETE CASCADE,
  path text NOT NULL,
  source_path text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  mime_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','failed','uploaded','skipped')),
  document_id uuid REFERENCES knowledge_documents(id) ON DELETE SET NULL,
  stored_name text,
  error text,
  UNIQUE(import_id,path)
);

CREATE INDEX IF NOT EXISTS knowledge_imports_user_created_idx ON knowledge_imports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_import_items_document_idx ON knowledge_import_items(document_id) WHERE document_id IS NOT NULL;
ALTER TABLE knowledge_import_items ADD COLUMN IF NOT EXISTS indexing_supported boolean NOT NULL DEFAULT true;
ALTER TABLE knowledge_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_import_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON knowledge_imports, knowledge_import_items FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON knowledge_imports, knowledge_import_items FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON knowledge_imports, knowledge_import_items FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    REVOKE ALL ON knowledge_imports, knowledge_import_items FROM service_role;
  END IF;
END $$;
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS content_sha256 text;
