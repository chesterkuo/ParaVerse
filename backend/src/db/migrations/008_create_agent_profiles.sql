CREATE TABLE agent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID REFERENCES simulations(id) ON DELETE CASCADE,
  name VARCHAR(100),
  persona TEXT NOT NULL,
  embedding vector(768),
  demographics JSONB NOT NULL,
  memory JSONB[] DEFAULT ARRAY[]::JSONB[]
);
CREATE INDEX idx_agents_simulation ON agent_profiles(simulation_id);
