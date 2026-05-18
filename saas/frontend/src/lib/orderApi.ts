import { getToken } from './auth'

async function requestJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const data = (await res.json().catch(() => ({}))) as { message?: string }
  if (!res.ok) {
    throw new Error(data.message || '请求失败')
  }
  return data as T
}

export interface RefundQuantityCondition {
  enabled: boolean
  conditionColumn: string
  operator: string
  compareValue: string
  resultType: string
  resultValue: string
}

export interface OrderSource {
  sourceId: string
  sourceName: string
  fieldMapping: Record<string, string>
  stripQuotes?: Record<string, boolean>
  refundQuantityCondition?: RefundQuantityCondition
  createdAt: string
  updatedAt: string
}

export interface SourceExportData {
  sourceName: string
  fieldMapping: Record<string, string>
  stripQuotes?: Record<string, boolean>
  refundQuantityCondition?: RefundQuantityCondition
}

export interface ImportSourceImportResult {
  success: boolean
  sourceId: string
  sourceName: string
  message: string
}

export const orderSourceApi = {
  listSources() {
    return requestJson<OrderSource[]>('GET', '/api/tenant/order-sources')
  },

  createSource(input: { sourceName: string; fieldMapping: Record<string, string>; stripQuotes?: Record<string, boolean> }) {
    return requestJson<OrderSource>('POST', '/api/tenant/order-sources', input)
  },

  updateSource(sourceId: string, input: { sourceName: string; fieldMapping: Record<string, string>; stripQuotes?: Record<string, boolean> }) {
    return requestJson<OrderSource>('PUT', `/api/tenant/order-sources/${sourceId}`, input)
  },

  deleteSource(sourceId: string) {
    return requestJson<{ ok: boolean }>('DELETE', `/api/tenant/order-sources/${sourceId}`)
  },

  exportSource(sourceId: string) {
    const token = getToken()
    return fetch(`/api/tenant/order-sources/${sourceId}/export`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  },

  importSource(data: SourceExportData) {
    return requestJson<ImportSourceImportResult>('POST', '/api/tenant/order-sources/import', data)
  },
}

export interface ParseResult {
  success: boolean
  previewData: Record<string, any>[]
  totalRows: number
}

export interface ImportResult {
  success: boolean
  successCount: number
  failCount: number
  errors: string[]
}

export const orderImportApi = {
  parseCsv(sourceId: string, csvData: string) {
    return requestJson<ParseResult>('POST', '/api/tenant/orders/parse', { sourceId, csvData })
  },

  importOrders(sourceId: string, csvData: string) {
    return requestJson<ImportResult>('POST', '/api/tenant/orders/import', { sourceId, csvData })
  },
}

export interface SyncResult {
  success: boolean
  updatedCount: number
  totalMappings: number
  totalOrders: number
  message: string
}

export const orderApi = {
  syncProductName() {
    return requestJson<SyncResult>('POST', '/api/tenant/orders/sync-product-name')
  },

  exportOrders() {
    const token = getToken()
    return fetch('/api/tenant/orders/export', {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  },
}

export interface UnifiedProductStat {
  unifiedName: string
  totalQuantity: number
  orderCount: number
  totalAmount: number
}

export interface DeviceProductDetail {
  unifiedName: string
  totalQuantity: number
  orderCount: number
  totalAmount: number
}

export interface DeviceStat {
  deviceNo: string
  productCount: number
  totalQuantity: number
  orderCount: number
  totalAmount: number
  details: DeviceProductDetail[]
}

export interface SourceStat {
  sourceName: string
  deviceCount: number
  totalQuantity: number
  totalAmount: number
  productCount: number
}

export interface StatsResult<T> {
  success: boolean
  data: T[]
}

export const statsApi = {
  getUnifiedProductStats() {
    return requestJson<StatsResult<UnifiedProductStat>>('GET', '/api/tenant/stats/unified-product')
  },

  exportUnifiedProductStats() {
    const token = getToken()
    return fetch('/api/tenant/stats/unified-product/export', {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  },

  getDeviceStats() {
    return requestJson<StatsResult<DeviceStat>>('GET', '/api/tenant/stats/device')
  },

  exportDeviceStats() {
    const token = getToken()
    return fetch('/api/tenant/stats/device/export', {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  },

  exportDeviceStatsDetail() {
    const token = getToken()
    return fetch('/api/tenant/stats/device/export-detail', {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  },

  getSourceStats() {
    return requestJson<StatsResult<SourceStat>>('GET', '/api/tenant/stats/source')
  },

  exportSourceStats() {
    const token = getToken()
    return fetch('/api/tenant/stats/source/export', {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  },
}
