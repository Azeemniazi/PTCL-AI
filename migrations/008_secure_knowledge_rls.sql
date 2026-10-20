-- Migration 008: Secure Knowledge Hub Row Level Security (RLS) & Grant Isolation
-- Revoke direct browser/API-role access from anon and authenticated roles.
-- Server-side Express application retains access via postgres/service_role.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE knowledge_folders FROM anon;
    REVOKE ALL ON TABLE knowledge_documents FROM anon;
    REVOKE ALL ON TABLE knowledge_document_chunks FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE knowledge_folders FROM authenticated;
    REVOKE ALL ON TABLE knowledge_documents FROM authenticated;
    REVOKE ALL ON TABLE knowledge_document_chunks FROM authenticated;
  END IF;
END $$;

-- Enable Row Level Security (RLS) on all knowledge base tables
ALTER TABLE knowledge_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_document_chunks ENABLE ROW LEVEL SECURITY;
