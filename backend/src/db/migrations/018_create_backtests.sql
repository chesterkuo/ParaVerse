CREATE TABLE IF NOT EXISTS backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  simulation_id UUID REFERENCES simulations(id),
  owner_id UUID REFERENCES users(id),
  name VARCHAR(200) NOT NULL,
  historical_context JSONB NOT NULL,
  predicted_distribution JSONB,
  accuracy_score FLOAT,
  status VARCHAR(30) DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_backtests_project ON backtests(project_id);
CREATE INDEX idx_backtests_owner ON backtests(owner_id);
