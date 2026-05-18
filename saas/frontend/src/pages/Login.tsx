import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { LoginForm, ProFormText } from '@ant-design/pro-components'
import { message, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { setSession } from '../lib/auth'
import { ApiError, api } from '../lib/api'

export function Login() {
  const nav = useNavigate()

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <LoginForm
        title="登录"
        subTitle="账号为 admin 时进入平台端，否则进入租户端"
        onFinish={async (values) => {
          const account = String(values.account ?? '')
          const password = String(values.password ?? '')

          try {
            const result = await api.login({ account, password })
            if (result.type === 'platform') {
              setSession({ type: 'platform', account: result.account, token: result.token })
              nav('/platform/tenants', { replace: true })
              return true
            }
            setSession({
              type: 'tenant',
              tenantId: result.tenantId,
              tenantName: result.tenantName,
              account: result.account,
              displayName: result.displayName,
              token: result.token,
            })
            nav('/tenant/home', { replace: true })
            return true
          } catch (e) {
            if (e instanceof ApiError) {
              message.error(e.message)
              return false
            }
            message.error('登录失败')
            return false
          }
        }}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          平台端默认账号：admin / admin123
        </Typography.Paragraph>
        <ProFormText
          name="account"
          fieldProps={{ size: 'large', prefix: <UserOutlined /> }}
          placeholder="账号"
          rules={[{ required: true, message: '请输入账号' }]}
        />
        <ProFormText.Password
          name="password"
          fieldProps={{ size: 'large', prefix: <LockOutlined /> }}
          placeholder="密码"
          rules={[{ required: true, message: '请输入密码' }]}
        />
      </LoginForm>
    </div>
  )
}
