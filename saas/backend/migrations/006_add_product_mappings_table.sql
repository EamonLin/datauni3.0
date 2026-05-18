CREATE TABLE product_mappings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  unified_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_product_mappings_unified_name ON product_mappings (tenant_id, unified_name);
CREATE INDEX idx_product_mappings_original_name ON product_mappings (tenant_id, original_name);
