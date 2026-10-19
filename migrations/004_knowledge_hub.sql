CREATE TABLE IF NOT EXISTS knowledge_folders (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES knowledge_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_shared boolean NOT NULL DEFAULT true,
  color text DEFAULT '#005437',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_folders_user_idx ON knowledge_folders(user_id);
CREATE INDEX IF NOT EXISTS knowledge_folders_parent_idx ON knowledge_folders(parent_id);
CREATE INDEX IF NOT EXISTS knowledge_folders_shared_idx ON knowledge_folders(is_shared, created_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES knowledge_folders(id) ON DELETE SET NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  is_shared boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'ready',
  extracted_text text,
  token_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_docs_user_idx ON knowledge_documents(user_id);
CREATE INDEX IF NOT EXISTS knowledge_docs_folder_idx ON knowledge_documents(folder_id);
CREATE INDEX IF NOT EXISTS knowledge_docs_shared_idx ON knowledge_documents(is_shared, created_at DESC);
