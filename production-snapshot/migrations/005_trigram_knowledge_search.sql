-- Enable pg_trgm extension for fast full-text substring and trigram search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram GIN indexes for Knowledge Hub search queries
CREATE INDEX IF NOT EXISTS knowledge_docs_filename_trgm_idx
  ON knowledge_documents USING gin (filename gin_trgm_ops);

CREATE INDEX IF NOT EXISTS knowledge_docs_extracted_text_trgm_idx
  ON knowledge_documents USING gin (extracted_text gin_trgm_ops);
