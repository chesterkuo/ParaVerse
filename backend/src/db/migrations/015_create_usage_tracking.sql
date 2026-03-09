CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  simulation_id UUID REFERENCES simulations(id) ON DELETE SET NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_usage_user_type ON usage_records (user_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_usage_consumed ON usage_records (consumed_at);

CREATE OR REPLACE VIEW monthly_usage AS
SELECT
  user_id,
  resource_type,
  date_trunc('month', consumed_at) AS month,
  count(*) AS usage_count
FROM usage_records
GROUP BY user_id, resource_type, date_trunc('month', consumed_at);
