CREATE UNIQUE INDEX idx_documents_project_file_chunk ON documents(project_id, filename, chunk_index);
CREATE UNIQUE INDEX idx_ontology_nodes_project_name ON ontology_nodes(project_id, name);
