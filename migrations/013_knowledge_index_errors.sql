ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS index_error text;
ALTER TABLE knowledge_imports ADD COLUMN IF NOT EXISTS source_archive_id uuid;
