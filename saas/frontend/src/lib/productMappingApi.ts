import { getToken } from './auth'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

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
    throw new ApiError(res.status, data.message || '请求失败')
  }
  return data as T
}

export interface ProductMapping {
  id: string
  originalName: string
  unifiedName: string
  source: 'manual' | 'import'
  createdAt: string
  updatedAt: string
}

export interface ProductMappingListParams {
  page?: number
  pageSize?: number
  originalName?: string
  unifiedName?: string
}

export interface ProductMappingListResponse {
  data: ProductMapping[]
  total: number
  success: boolean
}

export interface ProductMappingParseResponse {
  success: boolean
  previewData: Array<{ originalName: string; unifiedName: string }>
  totalRows: number
}

export interface ProductMappingImportResponse {
  success: boolean
  successCount: number
  updateCount?: number
  failCount: number
  totalRows: number
  errors?: Array<{ row: number; originalName?: string; message: string }>
  duplicateInFileNames?: string[]
  message?: string
}

export const productMappingApi = {
  listMappings(params: ProductMappingListParams) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, String(value))
      }
    })
    const query = searchParams.toString()
    return requestJson<ProductMappingListResponse>(
      'GET',
      `/api/tenant/product-mappings${query ? '?' + query : ''}`,
    )
  },

  createMapping(input: { originalName: string; unifiedName: string }) {
    return requestJson<ProductMapping>('POST', '/api/tenant/product-mappings', input)
  },

  updateMapping(id: string, input: { originalName: string; unifiedName?: string }) {
    return requestJson<ProductMapping>(`PUT`, `/api/tenant/product-mappings/${id}`, input)
  },

  deleteMapping(id: string) {
    return requestJson<{ ok: boolean }>('DELETE', `/api/tenant/product-mappings/${id}`)
  },

  batchDeleteMappings(ids: string[]) {
    return requestJson<{ ok: boolean; deletedCount: number }>('DELETE', '/api/tenant/product-mappings/batch', { ids })
  },

  parseCsv(csvData: string) {
    return requestJson<ProductMappingParseResponse>('POST', '/api/tenant/product-mappings/parse', {
      csvData,
    })
  },

  importMappings(csvData: string) {
    return requestJson<ProductMappingImportResponse>(
      'POST',
      '/api/tenant/product-mappings/import',
      { csvData },
    )
  },
}
