import { z } from 'zod'
import { nanoid } from 'nanoid'
import { signToken, verifyPassword, hashPassword, verifyToken } from './security.js'

function nowIso() {
  return new Date().toISOString()
}

function excelColToIndex(col) {
  let result = 0
  for (const char of col.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - 'A'.charCodeAt(0) + 1)
  }
  return result - 1
}

export function registerApi(app, { db }) {
  app.get('/api/health', (req, res) => {
    res.json({ ok: true })
  })

  app.post('/api/login', async (req, res) => {
    const schema = z.object({
      account: z.string().min(1),
      password: z.string().min(1),
    })

    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '参数错误' })

    const { account, password } = parsed.data

    if (account === 'admin') {
      const admin = db
        .prepare('SELECT account, password_hash FROM platform_admins WHERE account = ?')
        .get(account)
      if (!admin) return res.status(401).json({ message: '账号或密码错误' })
      const ok = await verifyPassword(password, admin.password_hash)
      if (!ok) return res.status(401).json({ message: '账号或密码错误' })

      const token = signToken({ typ: 'platform', account })
      return res.json({
        type: 'platform',
        token,
        account,
      })
    }

    const tenantAdmin = db
      .prepare(
        `
        SELECT ta.account, ta.display_name, ta.password_hash, ta.tenant_id, t.name as tenant_name, t.status as tenant_status
        FROM tenant_admins ta
        JOIN tenants t ON t.tenant_id = ta.tenant_id
        WHERE ta.account = ?
        `,
      )
      .get(account)

    if (!tenantAdmin) return res.status(401).json({ message: '账号或密码错误，或租户已停用' })
    if (tenantAdmin.tenant_status !== 'enabled') {
      return res.status(401).json({ message: '账号或密码错误，或租户已停用' })
    }
    const ok = await verifyPassword(password, tenantAdmin.password_hash)
    if (!ok) return res.status(401).json({ message: '账号或密码错误，或租户已停用' })

    const token = signToken({
      typ: 'tenant',
      tenantId: tenantAdmin.tenant_id,
      account: tenantAdmin.account,
    })

    return res.json({
      type: 'tenant',
      token,
      tenantId: tenantAdmin.tenant_id,
      tenantName: tenantAdmin.tenant_name,
      account: tenantAdmin.account,
      displayName: tenantAdmin.display_name,
    })
  })

  function auth(req, res, next) {
    const header = String(req.headers.authorization ?? '')
    const m = header.match(/^Bearer\s+(.+)$/i)
    if (!m) return res.status(401).json({ message: '未登录' })
    try {
      req.user = verifyToken(m[1])
      return next()
    } catch {
      return res.status(401).json({ message: '登录已失效' })
    }
  }

  function requirePlatform(req, res, next) {
    if (req.user?.typ !== 'platform') return res.status(403).json({ message: '无权限' })
    return next()
  }

  function requireTenant(req, res, next) {
    if (req.user?.typ !== 'tenant') return res.status(403).json({ message: '无权限' })
    return next()
  }

  app.get('/api/platform/tenants', auth, requirePlatform, (req, res) => {
    const rows = db
      .prepare(
        `
        SELECT t.tenant_id, t.name, t.status, t.created_at,
               ta.account as tenant_admin_account, ta.display_name as tenant_admin_display_name
        FROM tenants t
        JOIN tenant_admins ta ON ta.tenant_id = t.tenant_id
        ORDER BY t.created_at DESC
        `,
      )
      .all()

    res.json(
      rows.map((r) => ({
        tenantId: r.tenant_id,
        name: r.name,
        status: r.status,
        createdAt: r.created_at,
        tenantAdmin: {
          account: r.tenant_admin_account,
          displayName: r.tenant_admin_display_name,
        },
      })),
    )
  })

  app.post('/api/platform/tenants', auth, requirePlatform, async (req, res) => {
    const schema = z.object({
      tenantName: z.string().min(1),
      tenantAdminAccount: z.string().min(1),
      tenantAdminDisplayName: z.string().min(1),
      tenantAdminPassword: z.string().min(1),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '参数错误' })

    const { tenantName, tenantAdminAccount, tenantAdminDisplayName, tenantAdminPassword } =
      parsed.data

    const tenantId = nanoid(10)
    const tenantAdminId = nanoid(10)
    const createdAt = nowIso()
    const updatedAt = createdAt

    try {
      db.exec('BEGIN')
      db.prepare('INSERT INTO tenants (tenant_id, name, status, created_at) VALUES (?, ?, ?, ?)').run(
        tenantId,
        tenantName,
        'enabled',
        createdAt,
      )

      const passwordHash = await hashPassword(tenantAdminPassword)
      db.prepare(
        `
        INSERT INTO tenant_admins (tenant_admin_id, tenant_id, account, display_name, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(tenantAdminId, tenantId, tenantAdminAccount, tenantAdminDisplayName, passwordHash, createdAt, updatedAt)

      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      const msg = String(e?.message ?? '')
      if (msg.includes('UNIQUE')) return res.status(409).json({ message: '账号已存在' })
      return res.status(500).json({ message: '创建失败' })
    }

    return res.json({
      tenantId,
      name: tenantName,
      status: 'enabled',
      createdAt,
      tenantAdmin: {
        account: tenantAdminAccount,
        displayName: tenantAdminDisplayName,
      },
      initialPassword: tenantAdminPassword,
    })
  })

  app.patch('/api/platform/tenants/:tenantId/status', auth, requirePlatform, (req, res) => {
    const schema = z.object({ status: z.enum(['enabled', 'disabled']) })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '参数错误' })
    const { tenantId } = req.params
    const { status } = parsed.data

    const result = db.prepare('UPDATE tenants SET status = ? WHERE tenant_id = ?').run(status, tenantId)
    if (result.changes === 0) return res.status(404).json({ message: '租户不存在' })
    return res.json({ ok: true })
  })

  app.post('/api/platform/tenants/:tenantId/reset-password', auth, requirePlatform, async (req, res) => {
    const schema = z.object({ newPassword: z.string().min(1).optional() })
    const parsed = schema.safeParse(req.body ?? {})
    if (!parsed.success) return res.status(400).json({ message: '参数错误' })

    const { tenantId } = req.params
    const newPassword = parsed.data.newPassword ?? nanoid(12)
    const hash = await hashPassword(newPassword)
    const updatedAt = nowIso()

    const result = db
      .prepare('UPDATE tenant_admins SET password_hash = ?, updated_at = ? WHERE tenant_id = ?')
      .run(hash, updatedAt, tenantId)

    if (result.changes === 0) return res.status(404).json({ message: '租户不存在' })
    return res.json({ newPassword })
  })

  app.get('/api/tenant/me', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId
    const account = req.user.account

    const row = db
      .prepare(
        `
        SELECT ta.account, ta.display_name, t.tenant_id, t.name as tenant_name, t.status as tenant_status
        FROM tenant_admins ta
        JOIN tenants t ON t.tenant_id = ta.tenant_id
        WHERE ta.account = ?
        `,
      )
      .get(account)

    if (!row) return res.status(401).json({ message: '登录已失效' })
    if (row.tenant_status !== 'enabled') return res.status(403).json({ message: '租户已停用' })
    if (row.tenant_id !== tenantId) return res.status(403).json({ message: '无权限' })

    return res.json({
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      account: row.account,
      displayName: row.display_name,
    })
  })

  app.get('/api/tenant/orders', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId
    const { page = 1, pageSize = 20, orderSource, orderNo, paymentStatus } = req.query

    let whereConditions = ['tenant_id = ?']
    let params = [tenantId]

    if (orderSource) {
      whereConditions.push('order_source LIKE ?')
      params.push(`%${orderSource}%`)
    }
    if (orderNo) {
      whereConditions.push('order_no LIKE ?')
      params.push(`%${orderNo}%`)
    }
    if (paymentStatus) {
      whereConditions.push('payment_status = ?')
      params.push(paymentStatus)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    const offset = (Number(page) - 1) * Number(pageSize)
    const limit = Number(pageSize)

    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM orders ${whereClause}`)
      .get(...params)

    const rows = db
      .prepare(
        `
        SELECT order_id, order_source, order_no, device_no, product_no, product_name, 
               product_unified_name, quantity, paid_amount, payment_status, payment_channel, paid_at, 
               created_at, refund_quantity, refund_amount
        FROM orders ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        `,
      )
      .all(...params, limit, offset)

    const data = rows.map((r) => ({
      orderId: r.order_id,
      orderSource: r.order_source,
      orderNo: r.order_no,
      deviceNo: r.device_no,
      productNo: r.product_no,
      productName: r.product_name,
      productUnifiedName: r.product_unified_name,
      quantity: r.quantity,
      paidAmount: r.paid_amount,
      paymentStatus: r.payment_status,
      paymentChannel: r.payment_channel,
      paidAt: r.paid_at,
      createdAt: r.created_at,
      refundQuantity: r.refund_quantity || 0,
      refundAmount: r.refund_amount || 0,
    }))

    res.json({
      data,
      total: countRow.total,
      success: true,
    })
  })

  app.post('/api/tenant/orders/sync-product-name', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId

    const mappings = db
      .prepare('SELECT original_name, unified_name FROM product_mappings WHERE tenant_id = ?')
      .all(tenantId)

    if (mappings.length === 0) {
      return res.json({ success: true, updatedCount: 0, message: '没有商品映射数据' })
    }

    const normalizeName = (name) => {
      return String(name || '').replace(/[\s\n\r\t]+/g, '').trim().toLowerCase()
    }

    const mappingMap = new Map()
    for (const m of mappings) {
      mappingMap.set(normalizeName(m.original_name), m.unified_name)
    }

    const orders = db
      .prepare('SELECT order_id, product_name FROM orders WHERE tenant_id = ? AND product_unified_name IS NULL')
      .all(tenantId)

    let updatedCount = 0

    db.exec('BEGIN')
    try {
      for (const order of orders) {
        const productName = normalizeName(order.product_name)
        const unifiedName = mappingMap.get(productName)
        if (unifiedName) {
          db.prepare('UPDATE orders SET product_unified_name = ? WHERE order_id = ?')
            .run(unifiedName, order.order_id)
          updatedCount++
        }
      }
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      return res.status(500).json({ message: String(e?.message ?? '同步失败') })
    }

    res.json({
      success: true,
      updatedCount,
      totalMappings: mappings.length,
      totalOrders: orders.length,
      message: updatedCount > 0
        ? `成功同步 ${updatedCount} 条订单的商品统一名称`
        : '没有需要同步的订单',
    })
  })

  app.get('/api/tenant/orders/export', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId

    const rows = db.prepare(`
      SELECT order_source, order_no, device_no, product_no, product_name, 
             product_unified_name, quantity, paid_amount, payment_status, 
             payment_channel, paid_at, created_at, refund_quantity, refund_amount
      FROM orders 
      WHERE tenant_id = ?
      ORDER BY created_at DESC
    `).all(tenantId)

    const headers = [
      '订单来源', '订单编号', '设备编号', '商品编号', '商品名称', 
      '商品统一名称', '商品数量', '实收金额', '收款状态', 
      '收款渠道', '支付时间', '创建时间', '退货数量', '退款金额'
    ]

    const rowsData = rows.map((r) => [
      r.order_source,
      r.order_no,
      r.device_no || '',
      r.product_no || '',
      r.product_name,
      r.product_unified_name || '',
      r.quantity,
      r.paid_amount,
      r.payment_status === 'paid' ? '已支付' : r.payment_status === 'refunded' ? '已退款' : '未支付',
      r.payment_channel || '',
      r.paid_at || '',
      r.created_at,
      r.refund_quantity || 0,
      r.refund_amount || 0,
    ])

    const csvContent = [headers.join(','), ...rowsData.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="orders_${Date.now()}.csv"`)
    res.send(csvContent)
  })

  const ORDER_FIELDS = [
    'orderNo',
    'deviceNo',
    'productNo',
    'productName',
    'quantity',
    'paidAmount',
    'paymentStatus',
    'paymentChannel',
    'paidAt',
    'refundQuantity',
    'refundAmount',
  ]

  app.get('/api/tenant/order-sources', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId
    const rows = db
      .prepare(
        'SELECT source_id, source_name, field_mapping, strip_quotes, refund_quantity_condition, created_at, updated_at FROM order_sources WHERE tenant_id = ? ORDER BY created_at DESC'
      )
      .all(tenantId)

    res.json(
      rows.map((r) => ({
        sourceId: r.source_id,
        sourceName: r.source_name,
        fieldMapping: JSON.parse(r.field_mapping),
        stripQuotes: JSON.parse(r.strip_quotes || '{}'),
        refundQuantityCondition: JSON.parse(r.refund_quantity_condition || '{}'),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    )
  })

  app.post('/api/tenant/order-sources', auth, requireTenant, (req, res) => {
    const schema = z.object({
      sourceName: z.string().min(1),
      fieldMapping: z.record(z.string()),
      stripQuotes: z.record(z.boolean()).optional(),
      refundQuantityCondition: z.object({
        enabled: z.boolean(),
        conditionColumn: z.string(),
        operator: z.string(),
        compareValue: z.string(),
        resultType: z.string(),
        resultValue: z.string(),
      }).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '参数错误' })

    const tenantId = req.user.tenantId
    const { sourceName, fieldMapping, stripQuotes, refundQuantityCondition } = parsed.data

    const invalidFields = Object.keys(fieldMapping).filter(
      (key) => !ORDER_FIELDS.includes(key),
    )
    if (invalidFields.length > 0) {
      return res.status(400).json({ message: `无效的字段: ${invalidFields.join(', ')}` })
    }

    const sourceId = nanoid(10)
    const now = new Date().toISOString()

    try {
      db.prepare(
        'INSERT INTO order_sources (source_id, tenant_id, source_name, field_mapping, strip_quotes, refund_quantity_condition, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(sourceId, tenantId, sourceName, JSON.stringify(fieldMapping), JSON.stringify(stripQuotes || {}), JSON.stringify(refundQuantityCondition || {}), now, now)
    } catch (e) {
      const msg = String(e?.message ?? '')
      if (msg.includes('UNIQUE')) return res.status(409).json({ message: '来源名称已存在' })
      return res.status(500).json({ message: '创建失败' })
    }

    res.json({
      sourceId,
      sourceName,
      fieldMapping,
      stripQuotes: stripQuotes || {},
      refundQuantityCondition: refundQuantityCondition || {},
      createdAt: now,
      updatedAt: now,
    })
  })

  app.put('/api/tenant/order-sources/:sourceId', auth, requireTenant, (req, res) => {
    const schema = z.object({
      sourceName: z.string().min(1),
      fieldMapping: z.record(z.string()),
      stripQuotes: z.record(z.boolean()).optional(),
      refundQuantityCondition: z.object({
        enabled: z.boolean(),
        conditionColumn: z.string(),
        operator: z.string(),
        compareValue: z.string(),
        resultType: z.string(),
        resultValue: z.string(),
      }).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '参数错误' })

    const tenantId = req.user.tenantId
    const { sourceId } = req.params
    const { sourceName, fieldMapping, stripQuotes, refundQuantityCondition } = parsed.data

    const invalidFields = Object.keys(fieldMapping).filter(
      (key) => !ORDER_FIELDS.includes(key),
    )
    if (invalidFields.length > 0) {
      return res.status(400).json({ message: `无效的字段: ${invalidFields.join(', ')}` })
    }

    const now = new Date().toISOString()

    const result = db
      .prepare(
        'UPDATE order_sources SET source_name = ?, field_mapping = ?, strip_quotes = ?, refund_quantity_condition = ?, updated_at = ? WHERE source_id = ? AND tenant_id = ?',
      )
      .run(sourceName, JSON.stringify(fieldMapping), JSON.stringify(stripQuotes || {}), JSON.stringify(refundQuantityCondition || {}), now, sourceId, tenantId)

    if (result.changes === 0) return res.status(404).json({ message: '来源不存在' })

    res.json({ 
      sourceId, 
      sourceName, 
      fieldMapping, 
      stripQuotes: stripQuotes || {}, 
      refundQuantityCondition: refundQuantityCondition || {},
      updatedAt: now 
    })
  })

  app.delete('/api/tenant/order-sources/:sourceId', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId
    const { sourceId } = req.params

    const result = db
      .prepare('DELETE FROM order_sources WHERE source_id = ? AND tenant_id = ?')
      .run(sourceId, tenantId)

    if (result.changes === 0) return res.status(404).json({ message: '来源不存在' })

    res.json({ ok: true })
  })

  app.get('/api/tenant/order-sources/:sourceId/export', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId
    const { sourceId } = req.params

    const source = db
      .prepare(
        'SELECT source_name, field_mapping, strip_quotes, refund_quantity_condition FROM order_sources WHERE source_id = ? AND tenant_id = ?'
      )
      .get(sourceId, tenantId)

    if (!source) return res.status(404).json({ message: '来源不存在' })

    const exportData = {
      sourceName: source.source_name,
      fieldMapping: JSON.parse(source.field_mapping),
      stripQuotes: JSON.parse(source.strip_quotes || '{}'),
      refundQuantityCondition: JSON.parse(source.refund_quantity_condition || '{}'),
    }

    const content = JSON.stringify(exportData, null, 2)
    const timestamp = Date.now()

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(`${source.source_name}_${timestamp}.json`)}; filename="source_config_${timestamp}.json"`
    )
    res.send(content)
  })

  app.post('/api/tenant/order-sources/import', auth, requireTenant, (req, res) => {
    const schema = z.object({
      sourceName: z.string().min(1),
      fieldMapping: z.record(z.string()),
      stripQuotes: z.record(z.boolean()).optional(),
      refundQuantityCondition: z.object({
        enabled: z.boolean(),
        conditionColumn: z.string(),
        operator: z.string(),
        compareValue: z.string(),
        resultType: z.string(),
        resultValue: z.string(),
      }).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '配置文件格式错误' })

    const tenantId = req.user.tenantId
    const { sourceName, fieldMapping, stripQuotes, refundQuantityCondition } = parsed.data

    const invalidFields = Object.keys(fieldMapping).filter(
      (key) => !ORDER_FIELDS.includes(key),
    )
    if (invalidFields.length > 0) {
      return res.status(400).json({ message: `无效的字段: ${invalidFields.join(', ')}` })
    }

    const sourceId = nanoid(10)
    const now = new Date().toISOString()

    try {
      db.prepare(
        'INSERT INTO order_sources (source_id, tenant_id, source_name, field_mapping, strip_quotes, refund_quantity_condition, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(sourceId, tenantId, sourceName, JSON.stringify(fieldMapping), JSON.stringify(stripQuotes || {}), JSON.stringify(refundQuantityCondition || {}), now, now)
    } catch (e) {
      const msg = String(e?.message ?? '')
      if (msg.includes('UNIQUE')) return res.status(409).json({ message: '来源名称已存在' })
      return res.status(500).json({ message: '导入失败' })
    }

    res.json({
      success: true,
      sourceId,
      sourceName,
      message: '导入成功',
    })
  })

  app.post('/api/tenant/orders/parse', auth, requireTenant, (req, res) => {
    const schema = z.object({
      sourceId: z.string().min(1),
      csvData: z.string(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '参数错误' })

    const tenantId = req.user.tenantId
    const { sourceId, csvData } = parsed.data

    const source = db
      .prepare('SELECT * FROM order_sources WHERE source_id = ? AND tenant_id = ?')
      .get(sourceId, tenantId)

    if (!source) return res.status(404).json({ message: '来源不存在' })

    const fieldMapping = JSON.parse(source.field_mapping)

    const lines = csvData.trim().split('\n')
    if (lines.length < 2) {
      return res.status(400).json({ message: 'CSV数据至少需要包含表头和一行数据' })
    }

    const stripQuotes = JSON.parse(source.strip_quotes || '{}')

    const previewData = []
    const maxRows = Math.min(lines.length - 1, 5)

    for (let i = 1; i <= maxRows; i++) {
      const values = parseCSVLine(lines[i])
      const row = {}
      for (const [targetField, excelCol] of Object.entries(fieldMapping)) {
        let value = ''
        if (excelCol === '__DEFAULT__') {
          value = targetField === 'quantity' ? '1' : ''
        } else {
          const columnIndex = excelColToIndex(excelCol)
          value = columnIndex >= 0 && columnIndex < values.length ? values[columnIndex] || '' : ''
        }
        if (stripQuotes[targetField]) {
          value = String(value).replace(/^['`"]|['`"]$/g, '')
        }
        row[targetField] = value
      }
      previewData.push(row)
    }

    res.json({
      success: true,
      previewData,
      totalRows: lines.length - 1,
    })
  })

  app.post('/api/tenant/orders/import', auth, requireTenant, async (req, res) => {
    const schema = z.object({
      sourceId: z.string().min(1),
      csvData: z.string(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '参数错误' })

    const tenantId = req.user.tenantId
    const { sourceId, csvData } = parsed.data

    const source = db
      .prepare('SELECT * FROM order_sources WHERE source_id = ? AND tenant_id = ?')
      .get(sourceId, tenantId)

    if (!source) return res.status(404).json({ message: '来源不存在' })

    const fieldMapping = JSON.parse(source.field_mapping)
    const stripQuotes = JSON.parse(source.strip_quotes || '{}')
    const refundQuantityCondition = JSON.parse(source.refund_quantity_condition || '{}')
    const sourceName = source.source_name

    const lines = csvData.trim().split('\n')
    if (lines.length < 2) {
      return res.status(400).json({ message: 'CSV数据至少需要包含表头和一行数据' })
    }

    const totalRows = lines.length - 1
    const batchSize = 1000
    let successCount = 0
    let failCount = 0
    const errors = []

    const stmt = db.prepare(`
      INSERT INTO orders (
        order_id, tenant_id, order_source, order_no, device_no, product_no, product_name,
        quantity, paid_amount, payment_status, payment_channel, paid_at, created_at,
        refund_quantity, refund_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const evaluateCondition = (values, condition) => {
      if (!condition.enabled || !condition.conditionColumn) return false

      const conditionIndex = excelColToIndex(condition.conditionColumn)
      const cellValue = conditionIndex >= 0 && conditionIndex < values.length 
        ? String(values[conditionIndex] || '') 
        : ''

      const compareValue = condition.compareValue

      switch (condition.operator) {
        case '=':
          return cellValue === compareValue
        case '!=':
          return cellValue !== compareValue
        case '>':
          return parseFloat(cellValue) > parseFloat(compareValue)
        case '>=':
          return parseFloat(cellValue) >= parseFloat(compareValue)
        case '<':
          return parseFloat(cellValue) < parseFloat(compareValue)
        case '<=':
          return parseFloat(cellValue) <= parseFloat(compareValue)
        default:
          return false
      }
    }

    for (let batchStart = 1; batchStart <= totalRows; batchStart += batchSize) {
      db.exec('BEGIN')
      try {
        const batchEnd = Math.min(batchStart + batchSize - 1, totalRows)
        for (let i = batchStart; i <= batchEnd; i++) {
          const values = parseCSVLine(lines[i])
          const row = {}
          for (const [targetField, excelCol] of Object.entries(fieldMapping)) {
            let value = ''
            if (excelCol === '__DEFAULT__') {
              value = targetField === 'quantity' ? '1' : ''
            } else {
              const columnIndex = excelColToIndex(excelCol)
              value = columnIndex >= 0 && columnIndex < values.length ? values[columnIndex] || '' : ''
            }
            if (stripQuotes[targetField]) {
              value = String(value).replace(/^['`"]|['`"]$/g, '')
            }
            row[targetField] = value
          }

          const orderId = nanoid(10)
          const now = new Date().toISOString()

          let refundQuantity = 0
          if (refundQuantityCondition.enabled) {
            const conditionMet = evaluateCondition(values, refundQuantityCondition)
            if (conditionMet) {
              if (refundQuantityCondition.resultType === 'fixed') {
                refundQuantity = Math.abs(parseInt(refundQuantityCondition.resultValue) || 0)
              } else if (refundQuantityCondition.resultType === 'column') {
                const resultIndex = excelColToIndex(refundQuantityCondition.resultValue)
                const resultValue = resultIndex >= 0 && resultIndex < values.length 
                  ? values[resultIndex] 
                  : ''
                refundQuantity = Math.abs(parseInt(resultValue) || 0)
              }
            } else {
              refundQuantity = Math.abs(parseInt(row.refundQuantity) || 0)
            }
          } else {
            refundQuantity = Math.abs(parseInt(row.refundQuantity) || 0)
          }
          const refundAmount = Math.abs(parseFloat(row.refundAmount) || 0)

          stmt.run(
            orderId,
            tenantId,
            sourceName,
            row.orderNo || '',
            row.deviceNo || null,
            row.productNo || null,
            row.productName || '',
            parseInt(row.quantity) || 0,
            parseFloat(row.paidAmount) || 0,
            row.paymentStatus || 'unpaid',
            row.paymentChannel || null,
            row.paidAt || null,
            now,
            refundQuantity,
            refundAmount,
          )
          successCount++
        }
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        const msg = String(e?.message ?? '')
        if (msg.includes('UNIQUE')) {
          return res.status(409).json({ message: '订单编号已存在' })
        }
        failCount += batchEnd - batchStart + 1
        errors.push({
          startRow: batchStart,
          endRow: batchEnd,
          message: msg,
        })
      }
    }

    res.json({
      success: true,
      successCount,
      failCount,
      totalRows,
      errors,
    })
  })

  app.get('/api/tenant/product-mappings', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId
    const { page = 1, pageSize = 20, originalName, unifiedName } = req.query

    let whereConditions = ['tenant_id = ?']
    let params = [tenantId]

    if (originalName) {
      whereConditions.push('original_name LIKE ?')
      params.push(`%${originalName}%`)
    }
    if (unifiedName) {
      whereConditions.push('unified_name LIKE ?')
      params.push(`%${unifiedName}%`)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(pageSize)
    const limit = Number(pageSize)

    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM product_mappings ${whereClause}`)
      .get(...params)

    const rows = db
      .prepare(
        `
        SELECT id, original_name, unified_name, source, created_at, updated_at
        FROM product_mappings ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        `,
      )
      .all(...params, limit, offset)

    const data = rows.map((r) => ({
      id: r.id,
      originalName: r.original_name,
      unifiedName: r.unified_name,
      source: r.source,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))

    res.json({
      data,
      total: countRow.total,
      success: true,
    })
  })

  app.post('/api/tenant/product-mappings', auth, requireTenant, (req, res) => {
    const schema = z.object({
      originalName: z.string().min(1),
      unifiedName: z.string().min(1),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '参数错误' })

    const tenantId = req.user.tenantId
    const { originalName, unifiedName } = parsed.data

    const id = nanoid(10)
    const now = new Date().toISOString()

    try {
      db.prepare(
        'INSERT INTO product_mappings (id, tenant_id, original_name, unified_name, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(id, tenantId, originalName, unifiedName, 'manual', now, now)
    } catch (e) {
      const msg = String(e?.message ?? '')
      if (msg.includes('UNIQUE')) return res.status(409).json({ message: `原系统商品名称 "${originalName}" 已存在` })
      return res.status(500).json({ message: '创建失败' })
    }

    res.json({
      id,
      originalName,
      unifiedName,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    })
  })

  app.put('/api/tenant/product-mappings/:id', auth, requireTenant, (req, res) => {
    const schema = z.object({
      originalName: z.string().min(1),
      unifiedName: z.string().min(1).optional(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '参数错误' })

    const tenantId = req.user.tenantId
    const { id } = req.params
    const { originalName, unifiedName } = parsed.data

    const now = new Date().toISOString()

    let result
    if (unifiedName) {
      result = db
        .prepare(
          'UPDATE product_mappings SET original_name = ?, unified_name = ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
        )
        .run(originalName, unifiedName, now, id, tenantId)
    } else {
      result = db
        .prepare(
          'UPDATE product_mappings SET original_name = ?, updated_at = ? WHERE id = ? AND tenant_id = ?',
        )
        .run(originalName, now, id, tenantId)
    }

    if (result.changes === 0) return res.status(404).json({ message: '记录不存在' })

    const row = db.prepare('SELECT * FROM product_mappings WHERE id = ?').get(id)

    res.json({
      id: row.id,
      originalName: row.original_name,
      unifiedName: row.unified_name,
      source: row.source,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })
  })

  app.delete('/api/tenant/product-mappings/batch', auth, requireTenant, (req, res) => {
    const schema = z.object({
      ids: z.array(z.string()).min(1),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '参数错误' })

    const tenantId = req.user.tenantId
    const { ids } = parsed.data

    const placeholders = ids.map(() => '?').join(',')
    const params = [...ids, tenantId]

    const result = db
      .prepare(`DELETE FROM product_mappings WHERE id IN (${placeholders}) AND tenant_id = ?`)
      .run(...params)

    res.json({ ok: true, deletedCount: result.changes })
  })

  app.delete('/api/tenant/product-mappings/:id', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId
    const { id } = req.params

    const result = db
      .prepare('DELETE FROM product_mappings WHERE id = ? AND tenant_id = ?')
      .run(id, tenantId)

    if (result.changes === 0) return res.status(404).json({ message: '记录不存在' })

    res.json({ ok: true })
  })

  app.post('/api/tenant/product-mappings/parse', auth, requireTenant, (req, res) => {
    const schema = z.object({
      csvData: z.string(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '参数错误' })

    const { csvData } = parsed.data

    const lines = csvData.trim().split('\n')
    if (lines.length < 2) {
      return res.status(400).json({ message: 'CSV数据至少需要包含表头和一行数据' })
    }

    const previewData = []
    const maxRows = Math.min(lines.length - 1, 5)

    for (let i = 1; i <= maxRows; i++) {
      const values = parseCSVLine(lines[i])
      previewData.push({
        originalName: values[0] || '',
        unifiedName: values[1] || '',
      })
    }

    res.json({
      success: true,
      previewData,
      totalRows: lines.length - 1,
    })
  })

  app.post('/api/tenant/product-mappings/import', auth, requireTenant, (req, res) => {
    const schema = z.object({
      csvData: z.string(),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: '参数错误' })

    const tenantId = req.user.tenantId
    const { csvData } = parsed.data

    const lines = csvData.trim().split('\n')
    if (lines.length < 2) {
      return res.status(400).json({ message: 'CSV数据至少需要包含表头和一行数据' })
    }

    const totalRows = lines.length - 1
    let successCount = 0
    let updateCount = 0
    let failCount = 0
    const errors = []
    const duplicateInFileNames = []
    const processedNames = new Set()

    const insertStmt = db.prepare(`
      INSERT INTO product_mappings (id, tenant_id, original_name, unified_name, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const updateStmt = db.prepare(`
      UPDATE product_mappings SET unified_name = ?, updated_at = ? WHERE tenant_id = ? AND original_name = ?
    `)

    const now = new Date().toISOString()

    db.exec('BEGIN')
    try {
      for (let i = 1; i <= totalRows; i++) {
        const values = parseCSVLine(lines[i])
        const originalName = values[0] || ''
        const unifiedName = values[1] || ''
        
        if (!originalName.trim()) {
          failCount++
          errors.push({
            row: i,
            message: '原系统商品名称为空',
          })
          continue
        }

        if (processedNames.has(originalName)) {
          if (!duplicateInFileNames.includes(originalName)) {
            duplicateInFileNames.push(originalName)
          }
          failCount++
          errors.push({
            row: i,
            originalName,
            message: `本次导入的表格内存在重复的原系统商品名称 "${originalName}"`,
          })
          continue
        }

        processedNames.add(originalName)

        const existing = db.prepare('SELECT * FROM product_mappings WHERE tenant_id = ? AND original_name = ?').get(tenantId, originalName)
        if (existing) {
          updateStmt.run(unifiedName, now, tenantId, originalName)
          updateCount++
          continue
        }

        const id = nanoid(10)
        insertStmt.run(id, tenantId, originalName, unifiedName, 'import', now, now)
        successCount++
      }
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      return res.status(500).json({ message: String(e?.message ?? '导入失败') })
    }

    let message = `导入完成！新增 ${successCount} 条，更新 ${updateCount} 条，失败 ${failCount} 条`
    
    if (duplicateInFileNames.length > 0) {
      const displayNames = duplicateInFileNames.slice(0, 5)
      const remaining = duplicateInFileNames.length - displayNames.length
      const duplicateMsg = `本次重复商品${duplicateInFileNames.length}个，前5个是:${displayNames.join(', ')}${remaining > 0 ? `...还有${remaining}个` : ''}`
      message += `；${duplicateMsg}`
    }

    res.json({
      success: true,
      successCount,
      updateCount,
      failCount,
      totalRows,
      errors,
      duplicateInFileNames,
      message,
    })
  })

  app.get('/api/tenant/stats/unified-product', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId

    const rows = db.prepare(`
      SELECT 
          COALESCE(product_unified_name, product_name, '未映射') as unified_name,
          SUM(quantity - COALESCE(refund_quantity, 0)) as total_quantity,
          COUNT(*) as order_count,
          SUM(paid_amount - COALESCE(refund_amount, 0)) as total_amount
        FROM orders 
        WHERE tenant_id = ?
        GROUP BY COALESCE(product_unified_name, product_name, '未映射')
        ORDER BY total_quantity DESC
      `).all(tenantId)

    res.json({
      success: true,
      data: rows.map(r => ({
        unifiedName: r.unified_name,
        totalQuantity: r.total_quantity,
        orderCount: r.order_count,
        totalAmount: r.total_amount,
      })),
    })
  })

  app.get('/api/tenant/stats/unified-product/export', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId

    const rows = db.prepare(`
      SELECT 
        COALESCE(product_unified_name, product_name, '未映射') as unified_name,
        SUM(quantity - COALESCE(refund_quantity, 0)) as total_quantity,
        COUNT(*) as order_count,
        SUM(paid_amount - COALESCE(refund_amount, 0)) as total_amount
      FROM orders 
      WHERE tenant_id = ?
      GROUP BY COALESCE(product_unified_name, product_name, '未映射')
      ORDER BY total_quantity DESC
    `).all(tenantId)

    const headers = ['商品统一名称', '销售数量', '订单数', '销售金额']
    const rowsData = rows.map((r) => [
      r.unified_name,
      r.total_quantity,
      r.order_count,
      r.total_amount,
    ])

    const csvContent = [headers.join(','), ...rowsData.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="unified_product_stats_${Date.now()}.csv"`)
    res.send(csvContent)
  })

  app.get('/api/tenant/stats/device', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId

    const deviceSummary = db.prepare(`
      SELECT 
        device_no,
        COUNT(DISTINCT COALESCE(product_unified_name, product_name, '未映射')) as product_count,
        SUM(quantity - COALESCE(refund_quantity, 0)) as total_quantity,
        COUNT(*) as order_count,
        SUM(paid_amount - COALESCE(refund_amount, 0)) as total_amount
      FROM orders 
      WHERE tenant_id = ?
      GROUP BY device_no
      ORDER BY total_quantity DESC
    `).all(tenantId)

    const detailRows = db.prepare(`
      SELECT 
        device_no,
        COALESCE(product_unified_name, product_name, '未映射') as unified_name,
        SUM(quantity - COALESCE(refund_quantity, 0)) as total_quantity,
        COUNT(*) as order_count,
        SUM(paid_amount - COALESCE(refund_amount, 0)) as total_amount
      FROM orders 
      WHERE tenant_id = ?
      GROUP BY device_no, COALESCE(product_unified_name, product_name, '未映射')
      ORDER BY device_no, total_quantity DESC
    `).all(tenantId)

    const detailMap = new Map()
    for (const r of detailRows) {
      const deviceNo = r.device_no || '未知设备'
      if (!detailMap.has(deviceNo)) {
        detailMap.set(deviceNo, [])
      }
      detailMap.get(deviceNo).push({
        unifiedName: r.unified_name,
        totalQuantity: r.total_quantity,
        orderCount: r.order_count,
        totalAmount: r.total_amount,
      })
    }

    res.json({
      success: true,
      data: deviceSummary.map(r => ({
        deviceNo: r.device_no || '未知设备',
        productCount: r.product_count,
        totalQuantity: r.total_quantity,
        orderCount: r.order_count,
        totalAmount: r.total_amount,
        details: detailMap.get(r.device_no || '未知设备') || [],
      })),
    })
  })

  app.get('/api/tenant/stats/device/export', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId

    const rows = db.prepare(`
      SELECT 
        device_no,
        COUNT(DISTINCT COALESCE(product_unified_name, product_name, '未映射')) as product_count,
        SUM(quantity - COALESCE(refund_quantity, 0)) as total_quantity,
        COUNT(*) as order_count,
        SUM(paid_amount - COALESCE(refund_amount, 0)) as total_amount
      FROM orders 
      WHERE tenant_id = ?
      GROUP BY device_no
      ORDER BY total_quantity DESC
    `).all(tenantId)

    const headers = ['设备编号', '商品种类', '销售总数', '订单总数', '销售金额']
    const rowsData = rows.map((r) => [
      r.device_no || '未知设备',
      r.product_count,
      r.total_quantity,
      r.order_count,
      r.total_amount,
    ])

    const csvContent = [headers.join(','), ...rowsData.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="device_stats_${Date.now()}.csv"`)
    res.send(csvContent)
  })

  app.get('/api/tenant/stats/device/export-detail', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId

    const rows = db.prepare(`
      SELECT 
        device_no,
        COALESCE(product_unified_name, product_name, '未映射') as unified_name,
        SUM(quantity - COALESCE(refund_quantity, 0)) as total_quantity,
        SUM(paid_amount - COALESCE(refund_amount, 0)) as total_amount
      FROM orders 
      WHERE tenant_id = ?
      GROUP BY device_no, COALESCE(product_unified_name, product_name, '未映射')
      ORDER BY device_no, total_quantity DESC
    `).all(tenantId)

    const headers = ['设备编号', '商品名称', '销售数量', '销售金额']
    const rowsData = []
    let lastDeviceNo = null

    for (const r of rows) {
      const deviceNo = r.device_no || '未知设备'
      const displayDeviceNo = lastDeviceNo === deviceNo ? '' : deviceNo
      rowsData.push([
        displayDeviceNo,
        r.unified_name,
        r.total_quantity,
        r.total_amount,
      ])
      lastDeviceNo = deviceNo
    }

    const csvContent = [headers.join(','), ...rowsData.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="device_stats_detail_${Date.now()}.csv"`)
    res.send(csvContent)
  })

  app.get('/api/tenant/stats/source', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId

    const rows = db.prepare(`
      SELECT 
        order_source as source_name,
        COUNT(DISTINCT device_no) as device_count,
        SUM(quantity - COALESCE(refund_quantity, 0)) as total_quantity,
        SUM(paid_amount - COALESCE(refund_amount, 0)) as total_amount,
        COUNT(DISTINCT COALESCE(product_unified_name, product_name, '未映射')) as product_count
      FROM orders 
      WHERE tenant_id = ?
      GROUP BY order_source
      ORDER BY total_amount DESC
    `).all(tenantId)

    res.json({
      success: true,
      data: rows.map(r => ({
        sourceName: r.source_name,
        deviceCount: r.device_count,
        totalQuantity: r.total_quantity,
        totalAmount: r.total_amount,
        productCount: r.product_count,
      })),
    })
  })

  app.get('/api/tenant/stats/source/export', auth, requireTenant, (req, res) => {
    const tenantId = req.user.tenantId

    const rows = db.prepare(`
      SELECT 
        order_source as source_name,
        COUNT(DISTINCT device_no) as device_count,
        SUM(quantity - COALESCE(refund_quantity, 0)) as total_quantity,
        SUM(paid_amount - COALESCE(refund_amount, 0)) as total_amount,
        COUNT(DISTINCT COALESCE(product_unified_name, product_name, '未映射')) as product_count
      FROM orders 
      WHERE tenant_id = ?
      GROUP BY order_source
      ORDER BY total_amount DESC
    `).all(tenantId)

    const headers = ['订单来源', '设备数量', '销售总数', '销售金额', '商品种类']
    const rowsData = rows.map((r) => [
      r.source_name,
      r.device_count,
      r.total_quantity,
      r.total_amount,
      r.product_count,
    ])

    const csvContent = [headers.join(','), ...rowsData.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="source_stats_${Date.now()}.csv"`)
    res.send(csvContent)
  })
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())

  return result
}
