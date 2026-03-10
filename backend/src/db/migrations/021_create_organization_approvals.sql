CREATE TABLE IF NOT EXISTS organization_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_name VARCHAR(200) NOT NULL,
  organization_type VARCHAR(50) NOT NULL CHECK (organization_type IN ('academic', 'think_tank', 'government', 'enterprise')),
  scenario_type VARCHAR(50) NOT NULL DEFAULT 'war_game',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  justification TEXT,
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_org_approvals_user ON organization_approvals(user_id);
CREATE INDEX idx_org_approvals_status ON organization_approvals(status);
