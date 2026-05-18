DROP INDEX IF EXISTS idx_product_mappings_unified_name;
DROP INDEX IF EXISTS idx_product_mappings_original_name;

CREATE UNIQUE INDEX idx_product_mappings_original_name ON product_mappings (tenant_id, original_name);
CREATE INDEX idx_product_mappings_unified_name ON product_mappings (tenant_id, unified_name);
