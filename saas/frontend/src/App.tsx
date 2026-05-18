import { type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { getSession } from './lib/auth'
import { PlatformLayout } from './layouts/PlatformLayout'
import { TenantLayout } from './layouts/TenantLayout'
import { Login } from './pages/Login'
import { PlatformTenants } from './pages/PlatformTenants'
import { TenantHome } from './pages/TenantHome'
import { TenantOrderImport } from './pages/TenantOrderImport'
import { TenantOrderList } from './pages/TenantOrderList'
import { OrderSourceList } from './pages/OrderSourceList'
import { ProductMappingList } from './pages/ProductMappingList'
import { UnifiedProductStats } from './pages/UnifiedProductStats'
import { DeviceStats } from './pages/DeviceStats'

function RequirePlatform({ children }: { children: ReactNode }) {
  const session = getSession()
  if (session?.type !== 'platform') return <Navigate to="/login" replace />
  return children
}

function RequireTenant({ children }: { children: ReactNode }) {
  const session = getSession()
  if (session?.type !== 'tenant') return <Navigate to="/login" replace />
  return children
}

function RedirectIfLoggedIn({ kind }: { kind: 'platform' | 'tenant' | 'any' }) {
  const session = getSession()
  if (kind === 'any' && session?.type === 'platform') {
    return <Navigate to="/platform/tenants" replace />
  }
  if (kind === 'any' && session?.type === 'tenant') {
    return <Navigate to="/tenant/home" replace />
  }
  if (kind === 'platform' && session?.type === 'platform') {
    return <Navigate to="/platform/tenants" replace />
  }
  if (kind === 'tenant' && session?.type === 'tenant') {
    return <Navigate to="/tenant/home" replace />
  }
  return null
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/login"
          element={
            <>
              <RedirectIfLoggedIn kind="any" />
              <Login />
            </>
          }
        />

        <Route
          path="/platform"
          element={
            <RequirePlatform>
              <PlatformLayout />
            </RequirePlatform>
          }
        >
          <Route index element={<Navigate to="/platform/tenants" replace />} />
          <Route path="tenants" element={<PlatformTenants />} />
        </Route>

        <Route
          path="/tenant"
          element={
            <RequireTenant>
              <TenantLayout />
            </RequireTenant>
          }
        >
          <Route index element={<Navigate to="/tenant/home" replace />} />
          <Route path="home" element={<TenantHome />} />
          <Route path="orders/list" element={<TenantOrderList />} />
          <Route path="orders/import" element={<TenantOrderImport />} />
          <Route path="orders/sources" element={<OrderSourceList />} />
          <Route path="products/mapping" element={<ProductMappingList />} />
          <Route path="stats/unified-product" element={<UnifiedProductStats />} />
          <Route path="stats/device" element={<DeviceStats />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
