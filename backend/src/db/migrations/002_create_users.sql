CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  quota JSONB DEFAULT '{"simulations_per_month": 2, "max_agents": 50}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
