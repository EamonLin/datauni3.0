import { type ProColumns, ProTable } from '@ant-design/pro-components'
import { Tag, message, Button } from 'antd'
import { PlusOutlined, DownloadOutlined } from '@ant-design/icons'
import { useRef, useState } from 'react'
import type { Order, OrderListParams } from '../lib/api'
import { orderApi as orderApiMain } from '../lib/api'
import { orderApi } from '../lib/orderApi'

export function TenantOrderList() {
  const actionRef = useRef<any>()
  const [syncLoading, setSyncLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  const handleSyncProductName = async () => {
    setSyncLoading(true)
    try {
      const result = await orderApi.syncProductName()
      message.success(result.message)
      actionRef.current?.reload()
    } catch (error: any) {
      message.error(error?.message || '同步失败')
    } finally {
      setSyncLoading(false)
    }
  }

  const handleExportOrders = async () => {
    setExportLoading(true)
    try {
      const response = await orderApi.exportOrders()
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `orders_${Date.now()}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        message.success('导出成功')
      } else {
        message.error('导出失败')
      }
    } catch (error: any) {
      message.error(error?.message || '导出失败')
    } finally {
      setExportLoading(false)
    }
  }

  const columns: ProColumns<Order>[] = [
    {
      title: '订单来源',
      dataIndex: 'orderSource',
      valueType: 'text',
      search: true,
    },
    {
      title: '订单编号',
      dataIndex: 'orderNo',
      valueType: 'text',
      search: true,
    },
    {
      title: '设备编号',
      dataIndex: 'deviceNo',
      valueType: 'text',
      search: false,
    },
    {
      title: '商品编号',
      dataIndex: 'productNo',
      valueType: 'text',
      search: false,
    },
    {
      title: '商品名称',
      dataIndex: 'productName',
      valueType: 'text',
      search: false,
    },
    {
      title: '商品统一名称',
      dataIndex: 'productUnifiedName',
      valueType: 'text',
      search: false,
    },
    {
      title: '商品数量',
      dataIndex: 'quantity',
      valueType: 'digit',
      search: false,
    },
    {
      title: '实收金额',
      dataIndex: 'paidAmount',
      valueType: 'money',
      search: false,
    },
    {
      title: '退货数量',
      dataIndex: 'refundQuantity',
      valueType: 'digit',
      search: false,
    },
    {
      title: '退款金额',
      dataIndex: 'refundAmount',
      valueType: 'money',
      search: false,
    },
    {
      title: '收款状态',
      dataIndex: 'paymentStatus',
      valueType: 'select',
      valueEnum: {
        unpaid: { text: '未支付', status: 'Default' },
        paid: { text: '已支付', status: 'Success' },
        refunded: { text: '已退款', status: 'Error' },
      },
      render: (_, record) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          unpaid: { text: '未支付', color: 'default' },
          paid: { text: '已支付', color: 'green' },
          refunded: { text: '已退款', color: 'red' },
        }
        const status = statusMap[record.paymentStatus] || { text: record.paymentStatus, color: 'default' }
        return <Tag color={status.color}>{status.text}</Tag>
      },
      search: true,
    },
    {
      title: '收款渠道',
      dataIndex: 'paymentChannel',
      valueType: 'text',
      search: false,
    },
    {
      title: '支付时间',
      dataIndex: 'paidAt',
      valueType: 'dateTime',
      search: false,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      search: false,
    },
  ]

  const handleRequest = async (
    params: { pageSize?: number; current?: number; [key: string]: any },
    _sort: any,
    _filter: any,
  ) => {
    try {
      const queryParams: OrderListParams = {
        page: params.current || 1,
        pageSize: params.pageSize || 20,
        ...(params.orderSource ? { orderSource: params.orderSource } : {}),
        ...(params.orderNo ? { orderNo: params.orderNo } : {}),
        ...(params.paymentStatus ? { paymentStatus: params.paymentStatus } : {}),
      }

      const res = await orderApiMain.listOrders(queryParams)
      return {
        data: res.data,
        success: res.success,
        total: res.total,
      }
    } catch (e) {
      message.error('获取订单列表失败')
      return {
        data: [],
        success: false,
        total: 0,
      }
    }
  }

  return (
    <ProTable<Order>
      columns={columns}
      actionRef={actionRef}
      cardBordered
      request={handleRequest}
      rowKey="orderId"
      pagination={{
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total) => `共 ${total} 条记录`,
      }}
      dateFormatter="string"
      headerTitle="订单列表"
      toolBarRender={() => [
        <Button
          key="sync"
          type="primary"
          loading={syncLoading}
          onClick={handleSyncProductName}
          icon={<PlusOutlined />}
        >
          同步商品映射关系
        </Button>,
        <Button
          key="export"
          loading={exportLoading}
          onClick={handleExportOrders}
          icon={<DownloadOutlined />}
          style={{ marginLeft: 8 }}
        >
          导出订单列表
        </Button>,
      ]}
    />
  )
}
