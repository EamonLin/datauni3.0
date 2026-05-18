import { Button, Card, Space, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'

export function Landing() {
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
      <Card style={{ width: 520 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            数据平台（MVP）
          </Typography.Title>
          <Typography.Text type="secondary">
            请选择进入平台端或租户端登录
          </Typography.Text>
          <Space wrap>
            <Button type="primary" onClick={() => nav('/platform/login')}>
              平台管理员登录
            </Button>
            <Button onClick={() => nav('/tenant/login')}>租户管理员登录</Button>
          </Space>
        </Space>
      </Card>
    </div>
  )
}

