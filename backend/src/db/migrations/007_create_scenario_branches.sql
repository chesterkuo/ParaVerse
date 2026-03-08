CREATE TABLE scenario_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID REFERENCES simulations(id) ON DELETE CASCADE,
  branch_label VARCHAR(100) NOT NULL,
  description TEXT,
  override_vars JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_branches_simulation ON scenario_branches(simulation_id);
