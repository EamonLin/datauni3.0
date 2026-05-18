import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { openDb } from './db.js'
import { migrate } from './migrate.js'
import { seed } from './seed.js'
import { registerApi } from './api.js'

async function main() {
  const db = openDb()
  migrate(db)
  await seed(db)

  const app = express()
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '200mb' }))
  app.use(express.text({ limit: '200mb' }))

  registerApi(app, { db })

  app.listen(config.port, () => {
    process.stdout.write(`backend listening on http://localhost:${config.port}\n`)
  })
}

void main()

