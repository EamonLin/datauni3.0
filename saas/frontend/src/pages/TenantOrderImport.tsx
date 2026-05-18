import { Card, Upload, Button, Table, Select, message, Space, Modal, Alert, Divider, Empty, Progress } from 'antd'
import { UploadOutlined, DeleteOutlined, CheckOutlined, FileTextOutlined, LoadingOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useEffect, useState } from 'react'
import type { OrderSource } from '../lib/orderApi'
import { orderSourceApi, orderImportApi } from '../lib/orderApi'

interface UploadedFile {
  uid: string
  name: string
  size: number
  sourceId?: string
  previewData?: Record<string, any>[]
  totalRows?: number
  csvData?: string
  status: 'pending' | 'ready' | 'importing' | 'imported' | 'error'
  error?: string
  importProgress?: number
}

const PREVIEW_COLUMNS = [
  { title: '订单编号', dataIndex: 'orderNo', key: 'orderNo' },
  { title: '设备编号', dataIndex: 'deviceNo', key: 'deviceNo' },
  { title: '商品编号', dataIndex: 'productNo', key: 'productNo' },
  { title: '商品名称', dataIndex: 'productName', key: 'productName' },
  { title: '商品数量', dataIndex: 'quantity', key: 'quantity' },
  { title: '实收金额', dataIndex: 'paidAmount', key: 'paidAmount' },
  { title: '收款状态', dataIndex: 'paymentStatus', key: 'paymentStatus' },
  { title: '收款渠道', dataIndex: 'paymentChannel', key: 'paymentChannel' },
  { title: '支付时间', dataIndex: 'paidAt', key: 'paidAt' },
]

export function TenantOrderImport() {
  const [sources, setSources] = useState<OrderSource[]>([])
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadSources()
  }, [])

  const loadSources = async () => {
    try {
      const data = await orderSourceApi.listSources()
      setSources(data)
    } catch {
      message.error('加载来源配置失败')
    }
  }

  const handleUpload = async (file: File) => {
    const fileData: UploadedFile = {
      uid: file.name + Date.now(),
      name: file.name,
      size: file.size,
      status: 'pending',
    }

    setFiles((prev) => [...prev, fileData])

    const reader = new FileReader()
    reader.onload = (e) => {
      const csvData = e.target?.result as string
      setFiles((prev) =>
        prev.map((f) => (f.uid === fileData.uid ? { ...f, csvData } : f)),
      )
    }
    reader.readAsText(file)

    return false
  }

  const handleSourceChange = (fileUid: string, sourceId: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.uid === fileUid ? { ...f, sourceId, status: 'pending' as const } : f,
      ),
    )
  }

  const handleProcessAll = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending' && f.sourceId && f.csvData)
    if (pendingFiles.length === 0) {
      message.warning('没有待处理的文件')
      return
    }

    setProcessing(true)

    for (const file of pendingFiles) {
      try {
        const result = await orderImportApi.parseCsv(file.sourceId!, file.csvData!)
        setFiles((prev) =>
          prev.map((f) =>
            f.uid === file.uid
              ? {
                  ...f,
                  previewData: result.previewData,
                  totalRows: result.totalRows,
                  status: 'ready' as const,
                }
              : f,
          ),
        )
      } catch {
        setFiles((prev) =>
          prev.map((f) =>
            f.uid === file.uid
              ? { ...f, status: 'error' as const, error: '解析失败' }
              : f,
          ),
        )
      }
    }

    setProcessing(false)
    message.success('处理完成')
  }

  const handleDeleteFile = (fileUid: string) => {
    setFiles((prev) => prev.filter((f) => f.uid !== fileUid))
  }

  const handleImportFile = async (fileUid: string) => {
    const file = files.find((f) => f.uid === fileUid)
    if (!file || !file.sourceId || !file.csvData) return

    setFiles((prev) =>
      prev.map((f) =>
        f.uid === fileUid ? { ...f, status: 'importing' as const, importProgress: 0 } : f,
      ),
    )

    try {
      const result = await orderImportApi.importOrders(file.sourceId, file.csvData)
      setFiles((prev) =>
        prev.map((f) =>
          f.uid === fileUid
            ? { ...f, status: 'imported' as const, importProgress: 100 }
            : f,
        ),
      )
      message.success(`导入成功，共 ${result.successCount} 条`)
    } catch (error: any) {
      setFiles((prev) =>
        prev.map((f) =>
          f.uid === fileUid
            ? { ...f, status: 'error' as const, error: error?.message || '导入失败' }
            : f,
        ),
      )
      message.error('导入失败')
    }
  }

  const handleImportAll = async () => {
    const readyFiles = files.filter((f) => f.status === 'ready')
    if (readyFiles.length === 0) {
      message.warning('没有可导入的文件')
      return
    }

    Modal.confirm({
      title: '确认导入',
      content: `即将导入 ${readyFiles.length} 个文件，是否继续？`,
      onOk: async () => {
        setFiles((prev) =>
          prev.map((f) =>
            f.status === 'ready' ? { ...f, status: 'importing' as const, importProgress: 0 } : f,
          ),
        )

        let successCount = 0
        let failCount = 0

        for (const file of readyFiles) {
          try {
            await orderImportApi.importOrders(file.sourceId!, file.csvData!)
            successCount++
            setFiles((prev) =>
              prev.map((f) =>
                f.uid === file.uid
                  ? { ...f, status: 'imported' as const, importProgress: 100 }
                  : f,
              ),
            )
          } catch (error: any) {
            failCount++
            setFiles((prev) =>
              prev.map((f) =>
                f.uid === file.uid
                  ? { ...f, status: 'error' as const, error: error?.message || '导入失败' }
                  : f,
              ),
            )
          }
        }

        if (failCount === 0) {
          message.success(`成功导入 ${successCount} 个文件`)
        } else {
          message.warning(`成功 ${successCount} 个，失败 ${failCount} 个`)
        }
      },
    })
  }

  const handleClearAll = () => {
    setFiles([])
  }

  const pendingCount = files.filter((f) => f.status === 'pending' && f.sourceId && f.csvData)
    .length
  const readyCount = files.filter((f) => f.status === 'ready').length
  const importedCount = files.filter((f) => f.status === 'imported').length

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)' }}>
      <div style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card
          title="上传文件"
          extra={
            <Button type="link" onClick={loadSources}>
              刷新来源
            </Button>
          }
        >
          <Upload.Dragger
            accept=".csv"
            multiple
            showUploadList={false}
            beforeUpload={handleUpload}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传 CSV 文件</p>
            <p className="ant-upload-hint">支持一次上传多个文件</p>
          </Upload.Dragger>
        </Card>

        <Card
          title={
            <span>
              文件列表{' '}
              <span style={{ fontSize: 12, color: '#999' }}>
                ({files.length})
              </span>
            </span>
          }
          extra={
            <Space>
              {files.length > 0 && (
                <Button size="small" onClick={handleClearAll}>
                  清空
                </Button>
              )}
            </Space>
          }
        >
          {files.length === 0 ? (
            <Empty description="暂无上传文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {files.map((file) => (
                <div
                  key={file.uid}
                  style={{
                    padding: 12,
                    border: '1px solid #f0f0f0',
                    borderRadius: 8,
                    background: file.status === 'imported' ? '#f6ffed' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <FileTextOutlined />
                      <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </span>
                    </Space>
                    <Space>
                      {file.status === 'imported' ? (
                        <CheckOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <DeleteOutlined
                          style={{ color: '#ff4d4f', cursor: 'pointer' }}
                          onClick={() => handleDeleteFile(file.uid)}
                        />
                      )}
                    </Space>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <Select
                      placeholder="选择订单来源"
                      value={file.sourceId}
                      onChange={(value) => handleSourceChange(file.uid, value)}
                      style={{ width: '100%' }}
                      disabled={file.status === 'imported'}
                      options={sources.map((s) => ({
                        label: s.sourceName,
                        value: s.sourceId,
                      }))}
                    />
                  </div>

                  {file.status === 'ready' && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#52c41a' }}>
                      ✓ 识别成功，共 {file.totalRows} 条数据
                    </div>
                  )}
                  {file.status === 'importing' && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, color: '#1890ff', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <LoadingOutlined spin />
                        正在导入...
                      </div>
                      <Progress
                        percent={file.importProgress || 0}
                        strokeColor="#1890ff"
                        style={{ marginTop: 8 }}
                      />
                    </div>
                  )}
                  {file.status === 'error' && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#ff4d4f' }}>
                      ✗ {file.error}
                    </div>
                  )}
                  {file.status === 'imported' && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#52c41a' }}>
                      ✓ 已导入
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {files.length > 0 && (
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>已上传：{files.length} 个</span>
                <span>待处理：{pendingCount} 个</span>
                <span>可导入：{readyCount} 个</span>
                <span>已导入：{importedCount} 个</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  type="default"
                  block
                  disabled={pendingCount === 0}
                  loading={processing}
                  onClick={handleProcessAll}
                >
                  处理 ({pendingCount})
                </Button>
                <Button
                  type="primary"
                  block
                  disabled={readyCount === 0}
                  loading={processing}
                  onClick={handleImportAll}
                >
                  确认导入 ({readyCount})
                </Button>
              </div>
            </Space>
          </Card>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Card title="预览区域">
          {files.length === 0 ? (
            <Empty description="请先上传文件" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {files.map((file) => (
                <div key={file.uid}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Space>
                      <FileTextOutlined />
                      <span>{file.name}</span>
                      {file.sourceId && (
                        <span style={{ fontSize: 12, color: '#999' }}>
                          来源：{sources.find((s) => s.sourceId === file.sourceId)?.sourceName}
                        </span>
                      )}
                    </Space>
                    {file.status === 'ready' && (
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => handleImportFile(file.uid)}
                      >
                        导入此文件
                      </Button>
                    )}
                    {file.status === 'importing' && (
                      <Button
                        type="primary"
                        size="small"
                        loading
                        disabled
                      >
                        导入中...
                      </Button>
                    )}
                  </div>

                  {file.previewData && file.previewData.length > 0 ? (
                    <>
                      <Alert
                        message={`识别示例（显示前5条，共 ${file.totalRows} 条数据）`}
                        type="info"
                        style={{ marginBottom: 8 }}
                      />
                      <Table
                        columns={PREVIEW_COLUMNS as TableColumnsType}
                        dataSource={file.previewData}
                        pagination={false}
                        size="small"
                        scroll={{ x: 'max-content' }}
                      />
                    </>
                  ) : file.status === 'pending' && !file.sourceId ? (
                    <Alert message="请选择订单来源以预览数据" type="warning" />
                  ) : null}

                  <Divider />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
