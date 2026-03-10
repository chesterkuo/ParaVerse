ALTER TABLE simulations ADD COLUMN IF NOT EXISTS nested_config JSONB;
COMMENT ON COLUMN simulations.nested_config IS 'WarGame nested world config: { countries: [{ id, language, agent_count, trust_index_init }] }';
