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

export const api = {
  login(input: { account: string; password: string }) {
    return requestJson<
      | { type: 'platform'; token: string; account: string }
      | {
          type: 'tenant'
          token: string
          tenantId: string
          tenantName: string
          account: string
          displayName: string
        }
    >('POST', '/api/login', input)
  },

  platform: {
    listTenants() {
      return requestJson<
        Array<{
          tenantId: string
          name: string
          status: 'enabled' | 'disabled'
          createdAt: string
          tenantAdmin: { account: string; displayName: string }
        }>
      >('GET', '/api/platform/tenants')
    },
    createTenant(input: {
      tenantName: string
      tenantAdminAccount: string
      tenantAdminDisplayName: string
      tenantAdminPassword: string
    }) {
      return requestJson<{
        tenantId: string
        name: string
        status: 'enabled' | 'disabled'
        createdAt: string
        tenantAdmin: { account: string; displayName: string }
        initialPassword: string
      }>('POST', '/api/platform/tenants', input)
    },
    setTenantStatus(tenantId: string, status: 'enabled' | 'disabled') {
      return requestJson<{ ok: true }>('PATCH', `/api/platform/tenants/${tenantId}/status`, { status })
    },
    resetTenantAdminPassword(tenantId: string, newPassword?: string) {
      return requestJson<{ newPassword: string }>(
        'POST',
        `/api/platform/tenants/${tenantId}/reset-password`,
        newPassword ? { newPassword } : {},
      )
    },
  },

  tenant: {
    me() {
      return requestJson<{
        tenantId: string
        tenantName: string
        account: string
        displayName: string
      }>('GET', '/api/tenant/me')
    },
  },
}

export interface Order {
  orderId: string
  orderSource: string
  orderNo: string
  deviceNo?: string
  productNo?: string
  productName: string
  productUnifiedName?: string
  quantity: number
  paidAmount: number
  paymentStatus: string
  paymentChannel?: string
  paidAt?: string
  createdAt: string
  refundQuantity: number
  refundAmount: number
}

export interface OrderListParams {
  page?: number
  pageSize?: number
  orderSource?: string
  orderNo?: string
  paymentStatus?: string
}

export interface OrderListResponse {
  data: Order[]
  total: number
  success: boolean
}

export const orderApi = {
  listOrders(params: OrderListParams) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.append(key, String(value))
      }
    })
    const query = searchParams.toString()
    return requestJson<OrderListResponse>(
      'GET',
      `/api/tenant/orders${query ? '?' + query : ''}`,
    )
  },
}
