ALTER TABLE metal_rates
  ALTER COLUMN rate_per_gram TYPE NUMERIC(14,4)
  USING rate_per_gram::NUMERIC(14,4);

CREATE TABLE IF NOT EXISTS metal_rate_history (
    id BIGSERIAL PRIMARY KEY,
    metal_type VARCHAR(20) NOT NULL
        CHECK (metal_type IN ('GOLD', 'SILVER', 'PLATINUM')),
    purity VARCHAR(10) NOT NULL,
    rate_per_gram NUMERIC(14,4) NOT NULL CHECK (rate_per_gram > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    source VARCHAR(50) NOT NULL,
    provider_spot_price NUMERIC(16,4),
    provider_timestamp TIMESTAMPTZ,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metal_rate_history_lookup
ON metal_rate_history(metal_type, purity, recorded_at DESC);
