import { ProLayout } from '@ant-design/pro-components'
import { LogoutOutlined, TeamOutlined } from '@ant-design/icons'
import { Dropdown } from 'antd'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearSession, getSession } from '../lib/auth'

export function PlatformLayout() {
  const location = useLocation()
  const nav = useNavigate()
  const session = getSession()

  const account = session?.type === 'platform' ? session.account : '平台管理员'

  return (
    <ProLayout
      title="数据平台"
      layout="mix"
      location={{ pathname: location.pathname }}
      route={{
        path: '/platform',
        routes: [
          {
            path: '/platform/tenants',
            name: '租户管理',
            icon: <TeamOutlined />,
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
