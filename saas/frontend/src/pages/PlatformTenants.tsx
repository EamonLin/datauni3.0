import { PlusOutlined } from '@ant-design/icons'
import {
  DrawerForm,
  ModalForm,
  ProFormText,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, Descriptions, Popconfirm, Space, Tag, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { ApiError, api } from '../lib/api'

type TenantStatus = 'enabled' | 'disabled'

type TenantRecord = {
  tenantId: string
  name: string
  status: TenantStatus
  createdAt: string
  tenantAdmin: {
    account: string
    displayName: string
  }
}

export function PlatformTenants() {
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null)
  const [dataVersion, setDataVersion] = useState(0)
  const [loading, setLoading] = useState(false)
  const [tenants, setTenants] = useState<TenantRecord[]>([])

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.platform
      .listTenants()
      .then((rows) => {
        if (!alive) return
        setTenants(rows)
      })
      .catch((e) => {
        if (!alive) return
        if (e instanceof ApiError) message.error(e.message)
        else message.error('加载租户列表失败')
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [dataVersion])

  const activeTenant = useMemo(() => {
    void dataVersion
    if (!activeTenantId) return null
    return tenants.find((t) => t.tenantId === activeTenantId) ?? null
  }, [activeTenantId, dataVersion, tenants])

  const columns: ProColumns<TenantRecord>[] = [
    {
      title: '租户名称',
      dataIndex: 'name',
    },
    {
      title: '租户ID',
      dataIndex: 'tenantId',
      copyable: true,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, row) =>
        row.status === 'enabled' ? (
          <Tag color="green">启用</Tag>
        ) : (
          <Tag color="red">停用</Tag>
        ),
    },
    {
      title: '租户管理员账号',
      dataIndex: ['tenantAdmin', 'account'],
    },
    {
      title: '租户管理员显示名',
      dataIndex: ['tenantAdmin', 'displayName'],
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, row) => {
        const next: TenantStatus = row.status === 'enabled' ? 'disabled' : 'enabled'
        return (
          <Space>
            <Button
              type="link"
              onClick={() => {
                setActiveTenantId(row.tenantId)
                setDetailOpen(true)
              }}
            >
              详情
            </Button>
            <Popconfirm
              title={`确认${next === 'enabled' ? '启用' : '停用'}该租户吗？`}
              onConfirm={async () => {
                try {
                  await api.platform.setTenantStatus(row.tenantId, next)
                  setDataVersion((v) => v + 1)
                  message.success('已更新')
                } catch (e) {
                  if (e instanceof ApiError) message.error(e.message)
                  else message.error('更新失败')
                }
              }}
            >
              <Button type="link">{next === 'enabled' ? '启用' : '停用'}</Button>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <>
      <ProTable<TenantRecord>
        rowKey="tenantId"
        search={false}
        options={false}
        headerTitle="租户列表"
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新建租户
          </Button>,
        ]}
        dataSource={tenants}
        columns={columns}
        pagination={{ pageSize: 10 }}
        loading={loading}
      />

      <ModalForm
        title="新建租户"
        open={createOpen}
        onOpenChange={setCreateOpen}
        modalProps={{ destroyOnClose: true }}
        onFinish={async (values) => {
          try {
            const created = await api.platform.createTenant({
              tenantName: String(values.tenantName),
              tenantAdminAccount: String(values.tenantAdminAccount),
              tenantAdminDisplayName: String(values.tenantAdminDisplayName),
              tenantAdminPassword: String(values.tenantAdminPassword),
            })
            message.success('创建成功')
            message.info(`租户管理员初始密码：${created.initialPassword}`)
            setDataVersion((v) => v + 1)
            return true
          } catch (e) {
            if (e instanceof ApiError) message.error(e.message)
            else message.error('创建失败')
            return false
          }
        }}
      >
        <ProFormText
          name="tenantName"
          label="租户名称"
          placeholder="例如：XX公司"
          rules={[{ required: true, message: '请输入租户名称' }]}
        />
        <ProFormText
          name="tenantAdminAccount"
          label="租户管理员账号"
          placeholder="用于租户登录"
          rules={[{ required: true, message: '请输入租户管理员账号' }]}
        />
        <ProFormText
          name="tenantAdminDisplayName"
          label="租户管理员显示名"
          placeholder="右上角显示"
          rules={[{ required: true, message: '请输入显示名' }]}
        />
        <ProFormText.Password
          name="tenantAdminPassword"
          label="租户管理员初始密码"
          placeholder="用于租户登录"
          rules={[{ required: true, message: '请输入初始密码' }]}
        />
      </ModalForm>

      <DrawerForm
        title="租户详情"
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setActiveTenantId(null)
        }}
        submitter={false}
        drawerProps={{ destroyOnClose: true, width: 520 }}
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="租户名称">{activeTenant?.name ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="租户ID">{activeTenant?.tenantId ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            {activeTenant?.status === 'enabled' ? (
              <Tag color="green">启用</Tag>
            ) : (
              <Tag color="red">停用</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">{activeTenant?.createdAt ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="租户管理员账号">
            {activeTenant?.tenantAdmin.account ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="租户管理员显示名">
            {activeTenant?.tenantAdmin.displayName ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="租户管理员当前密码">
            不可获取（请重置密码）
          </Descriptions.Item>
        </Descriptions>

        <div style={{ height: 12 }} />

        <ModalForm
          title="重置租户管理员密码"
          trigger={<Button type="primary">重置密码</Button>}
          modalProps={{ destroyOnClose: true }}
          onFinish={async (values) => {
            if (!activeTenant) return false
            try {
              const r = await api.platform.resetTenantAdminPassword(
                activeTenant.tenantId,
                values.newPassword ? String(values.newPassword) : undefined,
              )
              message.success('已重置')
              message.info(`新密码：${r.newPassword}`)
              setDataVersion((v) => v + 1)
              return true
            } catch (e) {
              if (e instanceof ApiError) message.error(e.message)
              else message.error('重置失败')
              return false
            }
          }}
        >
          <ProFormText.Password
            name="newPassword"
            label="新密码"
            placeholder="不填则自动生成随机密码"
          />
        </ModalForm>
      </DrawerForm>
    </>
  )
}
