CREATE TABLE simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  engine VARCHAR(20) NOT NULL CHECK (engine IN ('oasis','concordia')),
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','configuring','running','completed','failed')),
  config JSONB NOT NULL,
  checkpoint_path TEXT,
  grounded_vars JSONB DEFAULT '{}',
  stats JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_simulations_project ON simulations(project_id);
