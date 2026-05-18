import { config } from './config.js'
import { hashPassword } from './security.js'

function nowIso() {
  return new Date().toISOString()
}

export async function seed(db) {
  const row = db.prepare('SELECT id FROM platform_admins WHERE account = ?').get('admin')
  if (row) return

  const hash = await hashPassword(config.seedAdminPassword)
  db.prepare('INSERT INTO platform_admins (account, password_hash, created_at) VALUES (?, ?, ?)').run(
    'admin',
    hash,
    nowIso(),
  )
}

