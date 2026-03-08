CREATE TABLE ontology_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('person','org','event','concept','location')),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  embedding vector(1536),
  properties JSONB DEFAULT '{}'
);
CREATE INDEX idx_ontology_nodes_project ON ontology_nodes(project_id);

CREATE TABLE ontology_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id UUID REFERENCES ontology_nodes(id) ON DELETE CASCADE,
  target_node_id UUID REFERENCES ontology_nodes(id) ON DELETE CASCADE,
  relation_type VARCHAR(100) NOT NULL,
  weight FLOAT DEFAULT 1.0,
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX idx_edges_source ON ontology_edges(source_node_id);
CREATE INDEX idx_edges_target ON ontology_edges(target_node_id);
