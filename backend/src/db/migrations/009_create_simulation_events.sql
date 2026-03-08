CREATE TABLE simulation_events (
  id BIGSERIAL,
  simulation_id UUID NOT NULL,
  branch_id UUID,
  agent_id UUID,
  event_type VARCHAR(50) NOT NULL,
  platform VARCHAR(30),
  content TEXT,
  embedding vector(1536),
  sim_timestamp INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY HASH (simulation_id);

CREATE TABLE simulation_events_p0 PARTITION OF simulation_events FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE simulation_events_p1 PARTITION OF simulation_events FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE simulation_events_p2 PARTITION OF simulation_events FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE simulation_events_p3 PARTITION OF simulation_events FOR VALUES WITH (MODULUS 4, REMAINDER 3);

CREATE INDEX idx_events_simulation ON simulation_events(simulation_id);
CREATE INDEX idx_events_type ON simulation_events(event_type);
