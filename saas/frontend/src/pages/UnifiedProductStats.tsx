import { type ProColumns, ProTable } from '@ant-design/pro-components'
import { message, Button, Card, Statistic, Row, Col } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useRef, useState, useEffect } from 'react'
import type { UnifiedProductStat } from '../lib/orderApi'
import { statsApi } from '../lib/orderApi'

export function UnifiedProductStats() {
  const actionRef = useRef<any>()
  const [exportLoading, setExportLoading] = useState(false)
  const [stats, setStats] = useState<UnifiedProductStat[]>([])
  const [loading, setLoading] = useState(false)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const result = await statsApi.getUnifiedProductStats()
      setStats(result.data)
    } catch (error: any) {
      message.error(error?.message || '获取统计数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const response = await statsApi.exportUnifiedProductStats()
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `unified_product_stats_${Date.now()}.csv`
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

  const totalQuantity = stats.reduce((sum, item) => sum + item.totalQuantity, 0)
  const totalAmount = stats.reduce((sum, item) => sum + item.totalAmount, 0)
  const totalOrders = stats.reduce((sum, item) => sum + item.orderCount, 0)

  const columns: ProColumns<UnifiedProductStat>[] = [
    {
      title: '序号',
      dataIndex: 'index',
      valueType: 'index',
      width: 60,
      search: false,
    },
    {
      title: '商品统一名称',
      dataIndex: 'unifiedName',
      valueType: 'text',
      width: 400,
    },
    {
      title: '销售数量',
      dataIndex: 'totalQuantity',
      valueType: 'digit',
      width: 120,
      sorter: (a, b) => a.totalQuantity - b.totalQuantity,
    },
    {
      title: '订单数',
      dataIndex: 'orderCount',
      valueType: 'digit',
      width: 100,
      sorter: (a, b) => a.orderCount - b.orderCount,
    },
    {
      title: '销售金额',
      dataIndex: 'totalAmount',
      valueType: 'money',
      width: 150,
      sorter: (a, b) => a.totalAmount - b.totalAmount,
    },
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="商品种类数" value={stats.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总销售数量" value={totalQuantity} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总订单数" value={totalOrders} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="总销售金额" value={totalAmount} precision={2} prefix="¥" />
          </Card>
        </Col>
      </Row>

      <ProTable<UnifiedProductStat>
        headerTitle="统一名称销售汇总"
        actionRef={actionRef}
        rowKey="unifiedName"
        loading={loading}
        dataSource={stats}
        columns={columns}
        search={false}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条数据`,
        }}
        toolBarRender={() => [
          <Button
            key="export"
            type="primary"
            icon={<DownloadOutlined />}
            loading={exportLoading}
            onClick={handleExport}
          >
            导出
          </Button>,
        ]}
      />
    </div>
  )
}
