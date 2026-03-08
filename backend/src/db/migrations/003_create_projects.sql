CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  scenario_type VARCHAR(30) NOT NULL CHECK (scenario_type IN ('fin_sentiment','content_lab','crisis_pr','policy_lab','war_game','train_lab')),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_projects_owner ON projects(owner_id);
