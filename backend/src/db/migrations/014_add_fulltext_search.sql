-- Add tsvector columns for full-text search

-- 1. documents: combine filename + content
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_documents_search ON documents USING GIN (search_vector);

CREATE OR REPLACE FUNCTION documents_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.filename, '') || ' ' || coalesce(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_documents_search_vector ON documents;
CREATE TRIGGER trg_documents_search_vector
  BEFORE INSERT OR UPDATE OF filename, content ON documents
  FOR EACH ROW EXECUTE FUNCTION documents_search_vector_update();

-- 2. simulation_events (partitioned): use content
ALTER TABLE simulation_events ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION simulation_events_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_simulation_events_search_vector ON simulation_events;
CREATE TRIGGER trg_simulation_events_search_vector
  BEFORE INSERT OR UPDATE OF content ON simulation_events
  FOR EACH ROW EXECUTE FUNCTION simulation_events_search_vector_update();

-- Create GIN indexes on each partition individually
DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sim_events_p0_search ON simulation_events_p0 USING GIN (search_vector)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sim_events_p1_search ON simulation_events_p1 USING GIN (search_vector)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sim_events_p2_search ON simulation_events_p2 USING GIN (search_vector)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sim_events_p3_search ON simulation_events_p3 USING GIN (search_vector)';
END;
$$;

-- 3. ontology_nodes: combine name + properties::text
ALTER TABLE ontology_nodes ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_ontology_nodes_search ON ontology_nodes USING GIN (search_vector);

CREATE OR REPLACE FUNCTION ontology_nodes_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', coalesce(NEW.name, '') || ' ' || coalesce(NEW.properties::text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ontology_nodes_search_vector ON ontology_nodes;
CREATE TRIGGER trg_ontology_nodes_search_vector
  BEFORE INSERT OR UPDATE OF name, properties ON ontology_nodes
  FOR EACH ROW EXECUTE FUNCTION ontology_nodes_search_vector_update();

-- 4. Backfill existing rows
UPDATE documents SET search_vector = to_tsvector('english', coalesce(filename, '') || ' ' || coalesce(content, ''))
  WHERE search_vector IS NULL;

UPDATE simulation_events SET search_vector = to_tsvector('english', coalesce(content, ''))
  WHERE search_vector IS NULL;

UPDATE ontology_nodes SET search_vector = to_tsvector('english', coalesce(name, '') || ' ' || coalesce(properties::text, ''))
  WHERE search_vector IS NULL;
