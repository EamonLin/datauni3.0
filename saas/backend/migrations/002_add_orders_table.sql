CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_source TEXT NOT NULL,
  order_no TEXT NOT NULL,
  device_no TEXT,
  product_no TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  paid_amount REAL NOT NULL,
  payment_status TEXT NOT NULL,
  payment_channel TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);
