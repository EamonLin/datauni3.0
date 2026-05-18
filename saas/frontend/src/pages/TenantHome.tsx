import { Card, Descriptions, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { ApiError, api } from '../lib/api'

export function TenantHome() {
  const [me, setMe] = useState<{
    tenantId: string
    tenantName: string
    account: string
    displayName: string
  } | null>(null)

  useEffect(() => {
    let alive = true
    api.tenant
      .me()
      .then((r) => {
        if (!alive) return
        setMe(r)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError) message.error(e.message)
        else message.error('加载失败')
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <Card>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        首页（空壳）
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        这个页面的目的：验证“租户管理员登录成功”以及“能稳定拿到 tenant_id”。
      </Typography.Paragraph>
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="tenant_id">{me?.tenantId ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="租户名称">{me?.tenantName ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="账号">{me?.account ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="显示名">{me?.displayName ?? '-'}</Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
