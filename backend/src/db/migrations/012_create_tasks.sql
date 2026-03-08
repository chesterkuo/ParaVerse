CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('document_process','graph_build','simulation','report_generate')),
  reference_id UUID NOT NULL,
  owner_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  progress INTEGER DEFAULT 0,
  result JSONB DEFAULT '{}',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tasks_reference ON tasks(reference_id);
CREATE INDEX idx_tasks_owner ON tasks(owner_id);
