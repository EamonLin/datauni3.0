import 'dotenv/config'
import { fileURLToPath } from 'node:url'

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? fileURLToPath(new URL('../data/app.db', import.meta.url)),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'admin123',
}
