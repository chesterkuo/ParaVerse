CREATE TABLE report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID REFERENCES simulations(id) ON DELETE CASCADE,
  section_order INTEGER,
  title VARCHAR(200),
  content TEXT,
  tool_calls JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_reports_simulation ON report_sections(simulation_id);
