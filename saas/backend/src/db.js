import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config } from './config.js'

function ensureDir(filePath) {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
}

export function openDb() {
  ensureDir(config.dbPath)
  const db = new DatabaseSync(config.dbPath)
  db.exec('PRAGMA journal_mode=WAL;')
  db.exec('PRAGMA foreign_keys=ON;')
  return db
}

