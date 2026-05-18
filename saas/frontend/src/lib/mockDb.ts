import { sha256Hex } from './crypto'
import { readJson, writeJson } from './storage'

export type TenantStatus = 'enabled' | 'disabled'

export type TenantRecord = {
  tenantId: string
  name: string
  status: TenantStatus
  createdAt: string
  tenantAdmin: {
    account: string
    displayName: string
    initialPassword: string
    passwordHash: string
  }
}

type PlatformAdminRecord = {
  account: string
  passwordHash: string
}

type DbShape = {
  platformAdmin: PlatformAdminRecord
  tenants: TenantRecord[]
}

const DB_KEY = 'mvp_db_v1'

function nowIso() {
  return new Date().toISOString()
}

function randomId(prefix: string) {
  const n = Math.random().toString(16).slice(2, 10)
  return `${prefix}_${n}`
}

export async function ensureSeed() {
  const existing = readJson<DbShape | null>(DB_KEY, null)
  if (existing) {
    const migrated: DbShape = {
      ...existing,
      tenants: existing.tenants.map((t) => ({
        ...t,
        tenantAdmin: {
          ...t.tenantAdmin,
          initialPassword:
            (t.tenantAdmin as unknown as { initialPassword?: string }).initialPassword ?? '',
        },
      })),
    }
    writeJson(DB_KEY, migrated)
    return
  }

  const adminPasswordHash = await sha256Hex('admin123')

  const seed: DbShape = {
    platformAdmin: {
      account: 'admin',
      passwordHash: adminPasswordHash,
    },
    tenants: [
      {
        tenantId: 'tenant_demo',
        name: '示例租户',
        status: 'enabled',
        createdAt: nowIso(),
        tenantAdmin: {
          account: 'demo',
          displayName: '示例管理员',
          initialPassword: 'demo123',
          passwordHash: await sha256Hex('demo123'),
        },
      },
    ],
  }

  writeJson(DB_KEY, seed)
}

function readDb(): DbShape {
  return readJson<DbShape>(DB_KEY, {
    platformAdmin: { account: 'admin', passwordHash: '' },
    tenants: [],
  })
}

function writeDb(next: DbShape) {
  writeJson(DB_KEY, next)
}

export async function platformLogin(account: string, password: string) {
  await ensureSeed()
  const db = readDb()
  const hash = await sha256Hex(password)
  return account === db.platformAdmin.account && hash === db.platformAdmin.passwordHash
}

export function listTenants() {
  const db = readDb()
  return db.tenants
}

export async function createTenant(input: {
  tenantName: string
  tenantAdminAccount: string
  tenantAdminDisplayName: string
  tenantAdminPassword: string
}) {
  const db = readDb()

  const tenantId = randomId('tenant')
  const record: TenantRecord = {
    tenantId,
    name: input.tenantName,
    status: 'enabled',
    createdAt: nowIso(),
    tenantAdmin: {
      account: input.tenantAdminAccount,
      displayName: input.tenantAdminDisplayName,
      initialPassword: input.tenantAdminPassword,
      passwordHash: await sha256Hex(input.tenantAdminPassword),
    },
  }

  writeDb({ ...db, tenants: [record, ...db.tenants] })
  return record
}

export function setTenantStatus(tenantId: string, status: TenantStatus) {
  const db = readDb()
  writeDb({
    ...db,
    tenants: db.tenants.map((t) => (t.tenantId === tenantId ? { ...t, status } : t)),
  })
}

export async function resetTenantAdminPassword(tenantId: string, newPassword: string) {
  const db = readDb()
  const hash = await sha256Hex(newPassword)
  writeDb({
    ...db,
    tenants: db.tenants.map((t) =>
      t.tenantId === tenantId
        ? {
            ...t,
            tenantAdmin: {
              ...t.tenantAdmin,
              initialPassword: newPassword,
              passwordHash: hash,
            },
          }
        : t,
    ),
  })
}

export async function tenantAdminLogin(input: { account: string; password: string }) {
  await ensureSeed()
  const db = readDb()
  const hash = await sha256Hex(input.password)
  const tenant = db.tenants.find((t) => t.tenantAdmin.account === input.account)
  if (!tenant) return null
  if (tenant.status !== 'enabled') return null
  if (tenant.tenantAdmin.passwordHash !== hash) return null

  return {
    tenantId: tenant.tenantId,
    tenantName: tenant.name,
    account: tenant.tenantAdmin.account,
    displayName: tenant.tenantAdmin.displayName,
  }
}
