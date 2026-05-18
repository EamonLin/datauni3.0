import { type ProColumns, ProTable } from '@ant-design/pro-components'
import { Modal, message, Select, Upload, Table, Alert, Button } from 'antd'
import { UploadOutlined, EyeOutlined, DownloadOutlined, ImportOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useEffect, useState } from 'react'
import type { OrderSource, SourceExportData } from '../lib/orderApi'

const ORDER_FIELDS = [
  { key: 'orderNo', label: '订单编号' },
  { key: 'deviceNo', label: '设备编号' },
  { key: 'productNo', label: '商品编号' },
  { key: 'productName', label: '商品名称' },
  { key: 'quantity', label: '商品数量', hasDefault: true, defaultLabel: '默认值为1' },
  { key: 'paidAmount', label: '实收金额' },
  { key: 'paymentStatus', label: '收款状态' },
  { key: 'paymentChannel', label: '收款渠道' },
  { key: 'paidAt', label: '支付时间' },
  { key: 'refundQuantity', label: '退货数量（选填/条件判断）', isConditionField: true },
  { key: 'refundAmount', label: '退款金额（选填）' },
]

function indexToExcelCol(index: number): string {
  let result = ''
  let num = index + 1
  while (num > 0) {
    num--
    result = String.fromCharCode(num % 26 + 'A'.charCodeAt(0)) + result
    num = Math.floor(num / 26)
  }
  return result
}

const EXCEL_COLUMNS = Array.from({ length: 52 }, (_, i) => ({
  value: indexToExcelCol(i),
  label: indexToExcelCol(i),
}))

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
  { title: '退货数量', dataIndex: 'refundQuantity', key: 'refundQuantity' },
  { title: '退款金额', dataIndex: 'refundAmount', key: 'refundAmount' },
]

export function OrderSourceList() {
  const [sources, setSources] = useState<OrderSource[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingSource, setEditingSource] = useState<OrderSource | null>(null)
  const [formValues, setFormValues] = useState<{
    sourceName: string
    fieldMapping: Record<string, string>
    stripQuotes: Record<string, boolean>
    refundQuantityCondition: {
      enabled: boolean
      conditionColumn: string
      operator: string
      compareValue: string
      resultType: string
      resultValue: string
    }
  }>({
    sourceName: '',
    fieldMapping: {},
    stripQuotes: {},
    refundQuantityCondition: {
      enabled: false,
      conditionColumn: '',
      operator: '=',
      compareValue: '',
      resultType: 'fixed',
      resultValue: '1',
    },
  })
  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [previewSource, setPreviewSource] = useState<OrderSource | null>(null)
  const [previewData, setPreviewData] = useState<Record<string, any>[]>([])
  const [previewTotalRows, setPreviewTotalRows] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [importPreviewData, setImportPreviewData] = useState<SourceExportData | null>(null)
  const [importLoading, setImportLoading] = useState(false)

  const loadSources = async () => {
    try {
      const { orderSourceApi } = await import('../lib/orderApi')
      const data = await orderSourceApi.listSources()
      setSources(data)
    } catch {
      message.error('加载来源配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSources()
  }, [])

  const handleAdd = () => {
    setEditingSource(null)
    setFormValues({
      sourceName: '',
      fieldMapping: {},
      stripQuotes: {},
    })
    setModalVisible(true)
  }

  const handleEdit = (source: OrderSource) => {
    setEditingSource(source)
    setFormValues({
      sourceName: source.sourceName,
      fieldMapping: { ...source.fieldMapping },
      stripQuotes: { ...(source.stripQuotes || {}) },
      refundQuantityCondition: {
        enabled: false,
        conditionColumn: '',
        operator: '=',
        compareValue: '',
        resultType: 'fixed',
        resultValue: '1',
        ...(source.refundQuantityCondition || {}),
      },
    })
    setModalVisible(true)
  }

  const handleDelete = async (sourceId: string) => {
    try {
      const { orderSourceApi } = await import('../lib/orderApi')
      await orderSourceApi.deleteSource(sourceId)
      message.success('删除成功')
      loadSources()
    } catch {
      message.error('删除失败')
    }
  }

  const handlePreview = (source: OrderSource) => {
    setPreviewSource(source)
    setPreviewData([])
    setPreviewTotalRows(0)
    setPreviewError('')
    setPreviewModalVisible(true)
  }

  const handlePreviewUpload = async (file: File) => {
    if (file.size > 1024 * 1024) {
      message.error('示例文件不能超过1MB')
      return false
    }

    if (!previewSource) return false

    setPreviewLoading(true)
    setPreviewError('')

    const reader = new FileReader()
    reader.onload = async (e) => {
      const csvData = e.target?.result as string
      try {
        const { orderImportApi } = await import('../lib/orderApi')
        const result = await orderImportApi.parseCsv(previewSource.sourceId, csvData)
        const enrichedData = result.previewData.map(row => ({
          orderNo: '',
          deviceNo: '',
          productNo: '',
          productName: '',
          quantity: '',
          paidAmount: '',
          paymentStatus: '',
          paymentChannel: '',
          paidAt: '',
          refundQuantity: '',
          refundAmount: '',
          ...row,
        }))
        setPreviewData(enrichedData)
        setPreviewTotalRows(result.totalRows)
      } catch (error) {
        setPreviewError('解析失败，请检查文件格式')
      } finally {
        setPreviewLoading(false)
      }
    }
    reader.readAsText(file)

    return false
  }

  const handleExport = async (source: OrderSource) => {
    try {
      const { orderSourceApi } = await import('../lib/orderApi')
      const response = await orderSourceApi.exportSource(source.sourceId)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `source_${source.sourceName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${Date.now()}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        message.success('导出成功')
      } else {
        const errorText = await response.text().catch(() => '')
        message.error(`导出失败: ${response.status} ${errorText}`)
      }
    } catch (error: any) {
      message.error(`导出失败: ${error?.message || error}`)
    }
  }

  const handleImportClick = () => {
    setImportPreviewData(null)
    setImportModalVisible(true)
  }

  const handleImportFile = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      message.error('请选择 JSON 文件')
      return false
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content) as SourceExportData
        if (!data.sourceName || !data.fieldMapping) {
          throw new Error('无效的配置文件')
        }
        setImportPreviewData(data)
      } catch (error) {
        message.error('解析配置文件失败，请检查文件格式')
      }
    }
    reader.readAsText(file)

    return false
  }

  const handleImportSubmit = async () => {
    if (!importPreviewData) {
      message.error('请先选择配置文件')
      return
    }

    setImportLoading(true)
    try {
      const { orderSourceApi } = await import('../lib/orderApi')
      const result = await orderSourceApi.importSource(importPreviewData)
      if (result.success) {
        message.success('导入成功')
        setImportModalVisible(false)
        loadSources()
      }
    } catch (error: any) {
      message.error(error?.message || '导入失败')
    } finally {
      setImportLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!formValues.sourceName.trim()) {
      message.error('请输入来源名称')
      return
    }
    if (Object.keys(formValues.fieldMapping).length === 0) {
      message.error('请至少配置一个字段映射')
      return
    }

    try {
      const { orderSourceApi } = await import('../lib/orderApi')
      if (editingSource) {
        await orderSourceApi.updateSource(editingSource.sourceId, {
          sourceName: formValues.sourceName,
          fieldMapping: formValues.fieldMapping,
          stripQuotes: formValues.stripQuotes,
          refundQuantityCondition: formValues.refundQuantityCondition,
        })
        message.success('更新成功')
      } else {
        await orderSourceApi.createSource({
          sourceName: formValues.sourceName,
          fieldMapping: formValues.fieldMapping,
          stripQuotes: formValues.stripQuotes,
          refundQuantityCondition: formValues.refundQuantityCondition,
        })
        message.success('创建成功')
      }
      setModalVisible(false)
      loadSources()
    } catch {
      message.error(editingSource ? '更新失败' : '创建失败')
    }
  }

  const handleFieldMappingChange = (fieldKey: string, csvColumn: string) => {
    setFormValues((prev) => ({
      ...prev,
      fieldMapping: {
        ...prev.fieldMapping,
        [fieldKey]: csvColumn,
      },
    }))
  }

  const columns: ProColumns<OrderSource>[] = [
    {
      title: '来源名称',
      dataIndex: 'sourceName',
    },
    {
      title: '字段映射',
      dataIndex: 'fieldMapping',
      render: (_, record) => {
        const mapping = Object.entries(record.fieldMapping)
        if (mapping.length === 0) return '-'
        return (
          <div style={{ fontSize: 12 }}>
            {mapping.map(([key, value]) => {
              const field = ORDER_FIELDS.find((f) => f.key === key)
              return (
                <div key={key}>
                  {field?.label || key}: → {value}
                </div>
              )
            })}
          </div>
        )
      },
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => [
        <a key="preview" onClick={() => handlePreview(record)}>
          <EyeOutlined /> 预览
        </a>,
        <a key="export" onClick={() => handleExport(record)}>
          <DownloadOutlined /> 导出
        </a>,
        <a key="edit" onClick={() => handleEdit(record)}>
          编辑
        </a>,
        <a key="delete" onClick={() => handleDelete(record.sourceId)} style={{ color: 'red' }}>
          删除
        </a>,
      ],
    },
  ]

  return (
    <div>
      <ProTable
        columns={columns}
        dataSource={sources}
        loading={loading}
        rowKey="sourceId"
        search={false}
        toolBarRender={() => [
          <Button key="add" type="primary" onClick={handleAdd}>
            新增来源配置
          </Button>,
          <Button key="import" icon={<ImportOutlined />} onClick={handleImportClick}>
            导入配置
          </Button>,
        ]}
      />

      <Modal
        title={editingSource ? '编辑来源配置' : '新增来源配置'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>来源名称</label>
          <input
            type="text"
            value={formValues.sourceName}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, sourceName: e.target.value }))
            }
            placeholder="例如：A系统、美团、淘宝等"
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 8 }}>CSV字段映射</label>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
            请指定CSV文件中的列（A、B、C...），对应到系统字段
          </p>

          {ORDER_FIELDS.map((field) => {
            const options = field.hasDefault
              ? [
                  { value: '__DEFAULT__', label: field.defaultLabel },
                  ...EXCEL_COLUMNS,
                ]
              : EXCEL_COLUMNS

            return (
              <div
                key={field.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span style={{ width: 100 }}>{field.label}</span>
                <span style={{ margin: '0 8px', color: '#999' }}>→</span>
                <Select
                  value={formValues.fieldMapping[field.key] || undefined}
                  onChange={(value) => handleFieldMappingChange(field.key, value || '')}
                  placeholder="选择列"
                  style={{ flex: 1, marginRight: 8 }}
                  options={options}
                  showSearch
                  allowClear
                />
                <label style={{ fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={formValues.stripQuotes?.[field.key] || false}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        stripQuotes: {
                          ...prev.stripQuotes,
                          [field.key]: e.target.checked,
                        },
                      }))
                    }
                  />
                  <span style={{ marginLeft: 4 }}>去引号</span>
                </label>
              </div>
            )
          })}

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #eee' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formValues.refundQuantityCondition.enabled}
                onChange={(e) =>
                  setFormValues((prev) => ({
                    ...prev,
                    refundQuantityCondition: {
                      ...prev.refundQuantityCondition,
                      enabled: e.target.checked,
                    },
                  }))
                }
              />
              <span style={{ marginLeft: 8, fontWeight: 'bold' }}>使用条件判断计算退货数量</span>
            </label>

            {formValues.refundQuantityCondition.enabled && (
              <div style={{ marginLeft: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ width: 80 }}>判断列</span>
                  <Select
                    value={formValues.refundQuantityCondition.conditionColumn || undefined}
                    onChange={(value) =>
                      setFormValues((prev) => ({
                        ...prev,
                        refundQuantityCondition: {
                          ...prev.refundQuantityCondition,
                          conditionColumn: value || '',
                        },
                      }))
                    }
                    placeholder="选择列"
                    style={{ width: 100, marginRight: 8 }}
                    options={EXCEL_COLUMNS}
                    showSearch
                    allowClear
                  />
                  <span style={{ marginRight: 8 }}>判断条件</span>
                  <Select
                    value={formValues.refundQuantityCondition.operator}
                    onChange={(value) =>
                      setFormValues((prev) => ({
                        ...prev,
                        refundQuantityCondition: {
                          ...prev.refundQuantityCondition,
                          operator: value || '=',
                        },
                      }))
                    }
                    style={{ width: 80, marginRight: 8 }}
                    options={[
                      { value: '=', label: '等于' },
                      { value: '!=', label: '不等于' },
                      { value: '>', label: '大于' },
                      { value: '>=', label: '大于等于' },
                      { value: '<', label: '小于' },
                      { value: '<=', label: '小于等于' },
                    ]}
                  />
                  <input
                    type="text"
                    value={formValues.refundQuantityCondition.compareValue}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        refundQuantityCondition: {
                          ...prev.refundQuantityCondition,
                          compareValue: e.target.value,
                        },
                      }))
                    }
                    placeholder="判断值"
                    style={{ width: 100, padding: '4px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ width: 80 }}>满足条件时</span>
                  <Select
                    value={formValues.refundQuantityCondition.resultType}
                    onChange={(value) =>
                      setFormValues((prev) => ({
                        ...prev,
                        refundQuantityCondition: {
                          ...prev.refundQuantityCondition,
                          resultType: value || 'fixed',
                        },
                      }))
                    }
                    style={{ width: 100, marginRight: 8 }}
                    options={[
                      { value: 'fixed', label: '固定值' },
                      { value: 'column', label: '某列值' },
                    ]}
                  />
                  {formValues.refundQuantityCondition.resultType === 'fixed' ? (
                    <input
                      type="text"
                      value={formValues.refundQuantityCondition.resultValue}
                      onChange={(e) =>
                        setFormValues((prev) => ({
                          ...prev,
                          refundQuantityCondition: {
                            ...prev.refundQuantityCondition,
                            resultValue: e.target.value,
                          },
                        }))
                      }
                      placeholder="固定值"
                      style={{ width: 100, padding: '4px' }}
                    />
                  ) : (
                    <Select
                      value={formValues.refundQuantityCondition.resultValue || undefined}
                      onChange={(value) =>
                        setFormValues((prev) => ({
                          ...prev,
                          refundQuantityCondition: {
                            ...prev.refundQuantityCondition,
                            resultValue: value || '',
                          },
                        }))
                      }
                      placeholder="选择列"
                      style={{ width: 100 }}
                      options={EXCEL_COLUMNS}
                      showSearch
                      allowClear
                    />
                  )}
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
                    （不满足条件时退货数量为0）
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        title={`预览来源：${previewSource?.sourceName}`}
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        width={800}
        footer={null}
      >
        <div>
          <Upload.Dragger
            accept=".csv"
            showUploadList={false}
            beforeUpload={handlePreviewUpload}
            disabled={previewLoading}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传示例 CSV 文件</p>
            <p className="ant-upload-hint">文件大小不能超过 1MB</p>
          </Upload.Dragger>

          {previewLoading && (
            <Alert message="正在解析..." type="info" style={{ marginTop: 16 }} />
          )}

          {previewError && (
            <Alert message={previewError} type="error" style={{ marginTop: 16 }} />
          )}

          {previewData.length > 0 && (
            <>
              <Alert
                message={`识别示例（显示前5条，共 ${previewTotalRows} 条数据）`}
                type="success"
                style={{ marginTop: 16 }}
              />
              <Table
                columns={PREVIEW_COLUMNS as TableColumnsType}
                dataSource={previewData}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }}
                style={{ marginTop: 16 }}
              />
            </>
          )}
        </div>
      </Modal>

      <Modal
        title="导入来源配置"
        open={importModalVisible}
        onOk={handleImportSubmit}
        onCancel={() => setImportModalVisible(false)}
        confirmLoading={importLoading}
        okText="确认导入"
        cancelText="取消"
      >
        <div>
          <Upload.Dragger
            accept=".json"
            showUploadList={false}
            beforeUpload={handleImportFile}
          >
            <p className="ant-upload-drag-icon">
              <ImportOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传配置文件</p>
            <p className="ant-upload-hint">请选择从其他账号导出的 JSON 配置文件</p>
          </Upload.Dragger>

          {importPreviewData && (
            <div style={{ marginTop: 16 }}>
              <Alert
                message="配置文件预览"
                type="success"
                style={{ marginBottom: 12 }}
              />
              <div style={{ fontSize: 14 }}>
                <p><strong>来源名称：</strong>{importPreviewData.sourceName}</p>
                <p><strong>字段映射：</strong></p>
                <div style={{ padding: '8px 16px', background: '#f5f5f5', borderRadius: 4 }}>
                  {Object.entries(importPreviewData.fieldMapping).map(([key, value]) => {
                    const field = ORDER_FIELDS.find((f) => f.key === key)
                    return (
                      <div key={key}>
                        {field?.label || key}: → {value}
                      </div>
                    )
                  })}
                </div>
                {importPreviewData.stripQuotes && Object.keys(importPreviewData.stripQuotes).length > 0 && (
                  <>
                    <p style={{ marginTop: 12 }}><strong>去引号配置：</strong></p>
                    <div style={{ padding: '8px 16px', background: '#f5f5f5', borderRadius: 4 }}>
                      {Object.entries(importPreviewData.stripQuotes).map(([key, value]) => {
                        const field = ORDER_FIELDS.find((f) => f.key === key)
                        return (
                          <div key={key}>
                            {field?.label || key}: {value ? '是' : '否'}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
