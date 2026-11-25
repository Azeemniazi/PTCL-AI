-- Migration 007: Knowledge Base Chunks & Hybrid RAG Support
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS knowledge_document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  token_count INT NOT NULL DEFAULT 0,
  embedding vector(2560),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_doc_chunk UNIQUE(document_id, chunk_index)
);

-- Fast lookup of all chunks for a document
CREATE INDEX IF NOT EXISTS idx_kchunks_doc_id
  ON knowledge_document_chunks(document_id);

-- Trigram indexing on chunk text for substring keyword search
CREATE INDEX IF NOT EXISTS idx_kchunks_content_trgm
  ON knowledge_document_chunks USING gin (content gin_trgm_ops);

-- Full-text search index for term-frequency matching
CREATE INDEX IF NOT EXISTS idx_kchunks_content_fts
  ON knowledge_document_chunks USING gin (to_tsvector('english', content));
