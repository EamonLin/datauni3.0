import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function nowIso() {
  return new Date().toISOString()
}

export function migrate(db) {
  const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url))
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const appliedRows = db.prepare('SELECT id FROM schema_migrations').all()
  const applied = new Set(appliedRows.map((r) => r.id))

  for (const file of files) {
    if (applied.has(file)) continue
    const full = path.join(migrationsDir, file)
    const sql = fs.readFileSync(full, 'utf8')
    db.exec(sql)
    db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(
      file,
      nowIso(),
    )
  }
}
