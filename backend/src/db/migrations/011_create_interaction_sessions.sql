CREATE TABLE interaction_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID REFERENCES simulations(id) ON DELETE CASCADE,
  actor_type VARCHAR(20) CHECK (actor_type IN ('agent','report_agent','human')),
  actor_id UUID,
  messages JSONB[] DEFAULT ARRAY[]::JSONB[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_interactions_simulation ON interaction_sessions(simulation_id);
