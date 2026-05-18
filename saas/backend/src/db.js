import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { config } from './config.js'

function ensureDir(filePath) {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
}

export function openDb() {
  ensureDir(config.dbPath)
  const db = new Database(config.dbPath)
  db.pragma('journal_mode=WAL;')
  db.pragma('foreign_keys=ON;')
  return db
}

