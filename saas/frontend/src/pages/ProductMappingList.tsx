import { type ProColumns, ProTable } from '@ant-design/pro-components'
import { Modal, message, Upload, Button, Table, Alert } from 'antd'
import { UploadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { TableColumnsType } from 'antd'
import { useState, useRef } from 'react'
import type { ProductMapping } from '../lib/productMappingApi'
import { productMappingApi } from '../lib/productMappingApi'

interface FormValues {
  originalName: string
  unifiedName: string
}

const PREVIEW_COLUMNS = [
  { title: '原系统商品名称', dataIndex: 'originalName', key: 'originalName' },
  { title: '统一商品名称', dataIndex: 'unifiedName', key: 'unifiedName' },
]

export function ProductMappingList() {
  const actionRef = useRef<any>()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingMapping, setEditingMapping] = useState<ProductMapping | null>(null)
  const [formValues, setFormValues] = useState<FormValues>({
    originalName: '',
    unifiedName: '',
  })
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [previewData, setPreviewData] = useState<Array<{ originalName: string; unifiedName: string }>>(
    [],
  )
  const [totalRows, setTotalRows] = useState(0)
  const [csvData, setCsvData] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedRows, setSelectedRows] = useState<ProductMapping[]>([])

  const columns: ProColumns<ProductMapping>[] = [
    {
      title: '原系统商品名称',
      dataIndex: 'originalName',
      valueType: 'text',
      search: true,
    },
    {
      title: '统一商品名称',
      dataIndex: 'unifiedName',
      valueType: 'text',
      search: true,
    },
    {
      title: '数据来源',
      dataIndex: 'source',
      valueType: 'select',
      valueEnum: {
        manual: { text: '手动添加', status: 'Default' },
        import: { text: '导入', status: 'Success' },
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, record) => [
        <a key="edit" onClick={() => handleEdit(record)}>
          编辑
        </a>,
        <a key="delete" onClick={() => handleDelete(record.id)} style={{ color: 'red' }}>
          删除
        </a>,
      ],
    },
  ]

  const handleAdd = () => {
    setEditingMapping(null)
    setFormValues({
      originalName: '',
      unifiedName: '',
    })
    setModalVisible(true)
  }

  const handleEdit = (mapping: ProductMapping) => {
    setEditingMapping(mapping)
    setFormValues({
      originalName: mapping.originalName,
      unifiedName: mapping.unifiedName,
    })
    setModalVisible(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await productMappingApi.deleteMapping(id)
      message.success('删除成功')
      actionRef.current?.reload()
    } catch {
      message.error('删除失败')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedRows.length === 0) {
      message.warning('请先选择要删除的记录')
      return
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRows.length} 条记录吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const ids = selectedRows.map((row) => row.id)
          const result = await productMappingApi.batchDeleteMappings(ids)
          message.success(`成功删除 ${result.deletedCount} 条记录`)
          setSelectedRows([])
          actionRef.current?.reload()
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  const handleSubmit = async () => {
    if (!formValues.originalName.trim()) {
      message.error('请输入原系统商品名称')
      return
    }
    if (!formValues.unifiedName.trim()) {
      message.error('请输入统一商品名称')
      return
    }

    try {
      if (editingMapping) {
        await productMappingApi.updateMapping(editingMapping.id, {
          originalName: formValues.originalName,
          unifiedName: formValues.unifiedName,
        })
        message.success('更新成功')
      } else {
        await productMappingApi.createMapping({
          originalName: formValues.originalName,
          unifiedName: formValues.unifiedName,
        })
        message.success('创建成功')
      }
      setModalVisible(false)
      actionRef.current?.reload()
    } catch (error: any) {
      message.error(error?.message || (editingMapping ? '更新失败' : '创建失败'))
    }
  }

  const handleImportUpload = async (file: File) => {
    if (file.size > 1024 * 1024) {
      message.error('文件不能超过1MB')
      return false
    }

    setLoading(true)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const data = e.target?.result as string
      try {
        const result = await productMappingApi.parseCsv(data)
        setPreviewData(result.previewData)
        setTotalRows(result.totalRows)
        setCsvData(data)
      } catch (error: any) {
        message.error(error?.message || '解析失败')
      } finally {
        setLoading(false)
      }
    }
    reader.readAsText(file)

    return false
  }

  const handleImport = async () => {
    if (!csvData) {
      message.error('请先上传文件')
      return
    }

    setLoading(true)
    try {
      const result = await productMappingApi.importMappings(csvData)
      if (result.success) {
        message.success(`导入成功！成功 ${result.successCount} 条，失败 ${result.failCount} 条`)
      } else {
        message.error(result.message || '导入失败')
        if (result.errors && result.errors.length > 0) {
          console.log('导入错误详情:', result.errors)
        }
      }
      setImportModalVisible(false)
      setPreviewData([])
      setCsvData('')
      actionRef.current?.reload()
    } catch (error: any) {
      message.error(error?.message || '导入失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <ProTable
        columns={columns}
        request={async (params) => {
          const result = await productMappingApi.listMappings({
            page: params.current,
            pageSize: params.pageSize,
            originalName: params.originalName,
            unifiedName: params.unifiedName,
          })
          return {
            data: result.data,
            success: result.success,
            total: result.total,
          }
        }}
        actionRef={actionRef}
        rowKey="id"
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys: selectedRows.map((row) => row.id),
          onChange: (_, rows) => {
            setSelectedRows(rows as ProductMapping[])
          },
        }}
        toolBarRender={() => [
          <Button key="add" type="primary" onClick={handleAdd}>
            <PlusOutlined /> 手动添加
          </Button>,
          <Button key="import" onClick={() => setImportModalVisible(true)}>
            <UploadOutlined /> 导入CSV
          </Button>,
          <Button
            key="batch-delete"
            danger
            onClick={handleBatchDelete}
            disabled={selectedRows.length === 0}
            icon={<DeleteOutlined />}
          >
            批量删除 ({selectedRows.length})
          </Button>,
        ]}
      />

      <Modal
        title={editingMapping ? '编辑映射' : '添加映射'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8 }}>原系统商品名称 *</label>
            <input
              type="text"
              value={formValues.originalName}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, originalName: e.target.value }))
              }
              placeholder="请输入原系统商品名称"
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8 }}>统一商品名称 *</label>
            <input
              type="text"
              value={formValues.unifiedName}
              onChange={(e) =>
                setFormValues((prev) => ({ ...prev, unifiedName: e.target.value }))
              }
              placeholder="请输入统一商品名称"
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title="导入商品映射"
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => {
          setImportModalVisible(false)
          setPreviewData([])
          setCsvData('')
        }}
        width={700}
        okText="确认导入"
        okButtonProps={{ loading }}
        cancelButtonProps={{ disabled: loading }}
      >
        <div>
          <Upload.Dragger
            accept=".csv"
            showUploadList={false}
            beforeUpload={handleImportUpload}
            disabled={loading}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传 CSV 文件</p>
            <p className="ant-upload-hint">文件大小不能超过 1MB，需包含两列：原系统商品名称、统一商品名称</p>
          </Upload.Dragger>

          {loading && <Alert message="正在解析..." type="info" style={{ marginTop: 16 }} />}

          {previewData.length > 0 && (
            <>
              <Alert
                message={`识别示例（显示前5条，共 ${totalRows} 条数据）`}
                type="success"
                style={{ marginTop: 16 }}
              />
              <Table
                columns={PREVIEW_COLUMNS as TableColumnsType}
                dataSource={previewData}
                pagination={false}
                size="small"
                style={{ marginTop: 16 }}
              />
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}