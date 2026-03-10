CREATE TABLE IF NOT EXISTS lti_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer VARCHAR(500) NOT NULL UNIQUE,
  client_id VARCHAR(200) NOT NULL,
  auth_endpoint VARCHAR(500) NOT NULL,
  token_endpoint VARCHAR(500) NOT NULL,
  jwks_uri VARCHAR(500) NOT NULL,
  deployment_id VARCHAR(200),
  institution_name VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lti_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lti_platform_id UUID REFERENCES lti_platforms(id),
  lti_user_id VARCHAR(200) NOT NULL,
  paraverse_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lti_platform_id, lti_user_id)
);
