import { type ProColumns, ProTable } from '@ant-design/pro-components'
import { message, Button, Card, Statistic, Row, Col, Modal, Table, Space, Tabs } from 'antd'
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons'
import { useRef, useState, useEffect } from 'react'
import type { DeviceStat, DeviceProductDetail, SourceStat } from '../lib/orderApi'
import { statsApi } from '../lib/orderApi'

export function DeviceStats() {
  const actionRef = useRef<any>()
  const [exportLoading, setExportLoading] = useState(false)
  const [exportDetailLoading, setExportDetailLoading] = useState(false)
  const [sourceExportLoading, setSourceExportLoading] = useState(false)
  const [stats, setStats] = useState<DeviceStat[]>([])
  const [sourceStats, setSourceStats] = useState<SourceStat[]>([])
  const [loading, setLoading] = useState(false)
  const [sourceLoading, setSourceLoading] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [currentDetails, setCurrentDetails] = useState<DeviceProductDetail[]>([])
  const [currentDeviceNo, setCurrentDeviceNo] = useState('')

  const fetchStats = async () => {
    setLoading(true)
    try {
      const result = await statsApi.getDeviceStats()
      setStats(result.data)
    } catch (error: any) {
      message.error(error?.message || '获取统计数据失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchSourceStats = async () => {
    setSourceLoading(true)
    try {
      const result = await statsApi.getSourceStats()
      setSourceStats(result.data)
    } catch (error: any) {
      message.error(error?.message || '获取来源统计数据失败')
    } finally {
      setSourceLoading(false)
    }
  }

  const handleExportSource = async () => {
    setSourceExportLoading(true)
    try {
      const response = await statsApi.exportSourceStats()
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `source_stats_${Date.now()}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        message.success('导出来源统计成功')
      } else {
        message.error('导出来源统计失败')
      }
    } catch (error: any) {
      message.error(error?.message || '导出来源统计失败')
    } finally {
      setSourceExportLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchSourceStats()
  }, [])

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const response = await statsApi.exportDeviceStats()
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `device_stats_${Date.now()}.csv`
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

  const handleExportDetail = async () => {
    setExportDetailLoading(true)
    try {
      const response = await statsApi.exportDeviceStatsDetail()
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `device_stats_detail_${Date.now()}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        message.success('导出明细成功')
      } else {
        message.error('导出明细失败')
      }
    } catch (error: any) {
      message.error(error?.message || '导出明细失败')
    } finally {
      setExportDetailLoading(false)
    }
  }

  const handleViewDetails = (record: DeviceStat) => {
    setCurrentDeviceNo(record.deviceNo)
    setCurrentDetails(record.details)
    setDetailModalVisible(true)
  }

  const totalProductTypes = stats.reduce((sum, item) => sum + item.productCount, 0)
  const totalQuantity = stats.reduce((sum, item) => sum + item.totalQuantity, 0)
  const totalAmount = stats.reduce((sum, item) => sum + item.totalAmount, 0)

  const sourceTotalDevices = sourceStats.reduce((sum, item) => sum + item.deviceCount, 0)
  const sourceTotalQuantity = sourceStats.reduce((sum, item) => sum + item.totalQuantity, 0)
  const sourceTotalAmount = sourceStats.reduce((sum, item) => sum + item.totalAmount, 0)
  const sourceTotalProducts = sourceStats.reduce((sum, item) => sum + item.productCount, 0)

  const columns: ProColumns<DeviceStat>[] = [
    {
      title: '序号',
      dataIndex: 'index',
      valueType: 'index',
      width: 60,
      search: false,
    },
    {
      title: '设备编号',
      dataIndex: 'deviceNo',
      valueType: 'text',
      width: 200,
    },
    {
      title: '商品种类',
      dataIndex: 'productCount',
      valueType: 'digit',
      width: 100,
      sorter: (a, b) => a.productCount - b.productCount,
    },
    {
      title: '销售总数',
      dataIndex: 'totalQuantity',
      valueType: 'digit',
      width: 120,
      sorter: (a, b) => a.totalQuantity - b.totalQuantity,
    },
    {
      title: '订单总数',
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
    {
      title: '详情',
      key: 'action',
      width: 100,
      search: false,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          >
            查看详情
          </Button>
        </Space>
      ),
    },
  ]

  const sourceColumns: ProColumns<SourceStat>[] = [
    {
      title: '序号',
      dataIndex: 'index',
      valueType: 'index',
      width: 60,
      search: false,
    },
    {
      title: '订单来源',
      dataIndex: 'sourceName',
      valueType: 'text',
      width: 200,
    },
    {
      title: '设备数量',
      dataIndex: 'deviceCount',
      valueType: 'digit',
      width: 100,
      sorter: (a, b) => a.deviceCount - b.deviceCount,
    },
    {
      title: '销售总数',
      dataIndex: 'totalQuantity',
      valueType: 'digit',
      width: 120,
      sorter: (a, b) => a.totalQuantity - b.totalQuantity,
    },
    {
      title: '销售金额',
      dataIndex: 'totalAmount',
      valueType: 'money',
      width: 150,
      sorter: (a, b) => a.totalAmount - b.totalAmount,
    },
    {
      title: '商品种类',
      dataIndex: 'productCount',
      valueType: 'digit',
      width: 120,
      sorter: (a, b) => a.productCount - b.productCount,
    },
  ]

  const detailColumns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '商品统一名称',
      dataIndex: 'unifiedName',
      key: 'unifiedName',
      width: 400,
    },
    {
      title: '销售数量',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      width: 120,
      sorter: (a: DeviceProductDetail, b: DeviceProductDetail) => a.totalQuantity - b.totalQuantity,
    },
    {
      title: '订单数',
      dataIndex: 'orderCount',
      key: 'orderCount',
      width: 100,
      sorter: (a: DeviceProductDetail, b: DeviceProductDetail) => a.orderCount - b.orderCount,
    },
    {
      title: '销售金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 150,
      sorter: (a: DeviceProductDetail, b: DeviceProductDetail) => a.totalAmount - b.totalAmount,
    },
  ]

  const tabItems = [
    {
      key: 'device',
      label: '设备销售汇总',
      children: (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic title="设备数" value={stats.length} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="商品种类总数" value={totalProductTypes} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="总销售数量" value={totalQuantity} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="总销售金额" value={totalAmount} precision={2} prefix="¥" />
              </Card>
            </Col>
          </Row>

          <ProTable<DeviceStat>
            headerTitle="设备销售汇总"
            actionRef={actionRef}
            rowKey="deviceNo"
            loading={loading}
            dataSource={stats}
            columns={columns}
            search={{
              labelWidth: 'auto',
            }}
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
                导出汇总
              </Button>,
              <Button
                key="exportDetail"
                icon={<DownloadOutlined />}
                loading={exportDetailLoading}
                onClick={handleExportDetail}
              >
                导出明细
              </Button>,
            ]}
          />
        </>
      ),
    },
    {
      key: 'source',
      label: '来源销售汇总',
      children: (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card>
                <Statistic title="来源数" value={sourceStats.length} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="设备总数" value={sourceTotalDevices} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="总销售数量" value={sourceTotalQuantity} />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic title="总销售金额" value={sourceTotalAmount} precision={2} prefix="¥" />
              </Card>
            </Col>
          </Row>

          <ProTable<SourceStat>
            headerTitle="来源销售汇总"
            rowKey="sourceName"
            loading={sourceLoading}
            dataSource={sourceStats}
            columns={sourceColumns}
            search={{
              labelWidth: 'auto',
            }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条数据`,
            }}
            toolBarRender={() => [
              <Button
                key="exportSource"
                type="primary"
                icon={<DownloadOutlined />}
                loading={sourceExportLoading}
                onClick={handleExportSource}
              >
                导出来源统计
              </Button>,
            ]}
          />
        </>
      ),
    },
  ]

  return (
    <div>
      <Tabs items={tabItems} defaultActiveKey="device" />

      <Modal
        title={`设备 ${currentDeviceNo} - 商品销售详情`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={1000}
      >
        <Table
          columns={detailColumns}
          dataSource={currentDetails}
          rowKey="unifiedName"
          pagination={false}
          scroll={{ y: 400 }}
        />
      </Modal>
    </div>
  )
}
