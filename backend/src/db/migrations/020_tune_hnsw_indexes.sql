-- Tune HNSW parameters for 1M+ vector scale
-- m=24 (vs 16): more connections → better recall, slightly more memory
-- ef_construction=128 (vs 64): more candidates during build → better graph quality

-- Rebuild document embeddings index (originally created in 004)
DROP INDEX IF EXISTS idx_doc_emb;
CREATE INDEX idx_doc_emb ON documents USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 128);

-- Create agent profile embeddings index (no prior HNSW index existed)
CREATE INDEX IF NOT EXISTS idx_agent_emb ON agent_profiles USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 128);

-- Create simulation events embeddings index (no prior HNSW index existed)
CREATE INDEX IF NOT EXISTS idx_event_emb ON simulation_events USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 128);

-- Create ontology node embeddings index (no prior HNSW index existed)
CREATE INDEX IF NOT EXISTS idx_onto_emb ON ontology_nodes USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 128);

COMMENT ON INDEX idx_doc_emb IS 'HNSW m=24, ef_construction=128, tuned for 1M+ vectors';
COMMENT ON INDEX idx_agent_emb IS 'HNSW m=24, ef_construction=128, tuned for 1M+ vectors';
COMMENT ON INDEX idx_onto_emb IS 'HNSW m=24, ef_construction=128, tuned for 1M+ vectors';
