CREATE TABLE IF NOT EXISTS order_sources (
  source_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_name TEXT NOT NULL,
  field_mapping TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_order_sources_tenant_id ON order_sources(tenant_id);
