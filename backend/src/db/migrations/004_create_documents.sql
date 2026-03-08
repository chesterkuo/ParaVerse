CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  filename VARCHAR(500),
  content TEXT NOT NULL,
  chunk_index INTEGER DEFAULT 0,
  embedding vector(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_doc_emb ON documents USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
