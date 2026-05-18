import { ProLayout } from '@ant-design/pro-components'
import { HomeOutlined, LogoutOutlined, ShoppingCartOutlined, SettingOutlined, BarChartOutlined } from '@ant-design/icons'
import { Dropdown } from 'antd'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearSession, getSession } from '../lib/auth'

export function TenantLayout() {
  const location = useLocation()
  const nav = useNavigate()
  const session = getSession()

  const title = session?.type === 'tenant' ? session.tenantName : '租户端'
  const account =
    session?.type === 'tenant' ? `${session.displayName}（${session.account}）` : '租户管理员'

  return (
    <ProLayout
      title={title}
      layout="mix"
      location={{ pathname: location.pathname }}
      route={{
        path: '/tenant',
        routes: [
          {
            path: '/tenant/home',
            name: '首页',
            icon: <HomeOutlined />,
          },
          {
            path: '/tenant/orders',
            name: '订单管理',
            icon: <ShoppingCartOutlined />,
            routes: [
              {
                path: '/tenant/orders/list',
                name: '订单列表',
              },
              {
                path: '/tenant/orders/import',
                name: '订单导入',
              },
              {
                path: '/tenant/orders/sources',
                name: '来源配置',
                icon: <SettingOutlined />,
              },
            ],
          },
          {
            path: '/tenant/products',
            name: '商品中心',
            icon: <SettingOutlined />,
            routes: [
              {
                path: '/tenant/products/mapping',
                name: '商品名称映射表',
              },
            ],
          },
          {
            path: '/tenant/stats',
            name: '统计',
            icon: <BarChartOutlined />,
            routes: [
              {
                path: '/tenant/stats/unified-product',
                name: '统一名称销售汇总',
              },
              {
                path: '/tenant/stats/device',
                name: '设备销售汇总',
              },
            ],
          },
        ],
      }}
      avatarProps={{
        title: account,
        render: (_, dom) => (
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: () => {
                    clearSession()
                    nav('/login', { replace: true })
                  },
                },
              ],
            }}
          >
            {dom}
          </Dropdown>
        ),
      }}
      menuItemRender={(item, dom) => {
        if (!item.path) return dom
        return <Link to={item.path}>{dom}</Link>
      }}
      contentStyle={{ paddingBlock: 16 }}
    >
      <Outlet />
    </ProLayout>
  )
}
