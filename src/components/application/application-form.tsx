
import { AlertCircleIcon, CheckCircleIcon } from "lucide-react"
import { useState } from "react"
import { useDropzone } from "react-dropzone"
import { v4 as uuidv4 } from "uuid"

import { PackageItem } from "~components/package-item"
import { Alert, AlertDescription, AlertTitle } from "~components/ui/alert"
import { Button } from "~components/ui/button"
import { Switch } from "~components/ui/switch"
import { processZipFile } from "~services/package"
import type { Application, Package } from "~types"

interface ApplicationFormProps {
  app?: Application
  onSave: (app: Application) => void
  onCancel: () => void
}

interface AlertMessageProps {
  error: string | null
  success: string | null
  isUploading: boolean
}

const AlertMessage: React.FC<AlertMessageProps> = ({
  error,
  success,
  isUploading
}) => {
  if (!error && !success) return null

  return (
    <>
      {error && (
        <Alert variant="destructive" className="tw-mb-4">
          <AlertCircleIcon className="tw-h-4 tw-w-4" />
          <AlertTitle>错误</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert
          variant={isUploading ? "default" : "success"}
          className="tw-mb-4">
          {isUploading ? (
            <div className="tw-flex tw-items-center">
              <div className="tw-animate-spin tw-rounded-full tw-h-4 tw-w-4 tw-border-b-2 tw-border-primary tw-mr-2"></div>
              <AlertTitle>处理中</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </div>
          ) : (
            <>
              <CheckCircleIcon className="tw-h-4 tw-w-4" />
              <AlertTitle>成功</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </>
          )}
        </Alert>
      )}
    </>
  )
}

interface BasicInfoFormProps {
  name: string
  setName: (name: string) => void
  urlPatterns: string
  setUrlPatterns: (patterns: string) => void
  // enabled: boolean
  // setEnabled: (enabled: boolean) => void
  isUploading: boolean
}

const BasicInfoForm: React.FC<BasicInfoFormProps> = ({
  name,
  setName,
  urlPatterns,
  setUrlPatterns,
  isUploading
}) => {
  return (
    <>
      <div>
        <label className="tw-block tw-text-sm tw-font-medium tw-mb-1">
          应用名称
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="tw-w-full tw-p-2 tw-border tw-rounded tw-focus:outline-none tw-focus:ring-2 tw-focus:ring-primary"
          required
          disabled={isUploading}
        />
      </div>

      <div>
        <label className="tw-block tw-text-sm tw-font-medium tw-mb-1">
          URL 匹配规则（每行一个）
        </label>
        <textarea
          value={urlPatterns}
          onChange={(e) => setUrlPatterns(e.target.value)}
          placeholder="例如: https://*.example.com/*"
          className="tw-w-full tw-p-2 tw-border tw-rounded tw-focus:outline-none tw-focus:ring-2 tw-focus:ring-primary tw-h-24"
          required
          disabled={isUploading}
        />
        <p className="tw-text-xs tw-text-gray-500 tw-mt-1">
          使用 * 作为通配符，每行一个规则。例如: https://*.example.com/*
        </p>
      </div>
    </>
  )
}

interface PackageUploadAreaProps {
  editingPackageId: string | null
  handleCancelEdit: () => void
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  isUploading: boolean
  dropzoneProps: ReturnType<typeof useDropzone>
}

const PackageUploadArea: React.FC<PackageUploadAreaProps> = ({
  editingPackageId,
  handleCancelEdit,
  enabled,
  setEnabled,
  isUploading,
  dropzoneProps
}) => {
  const { getRootProps, getInputProps, isDragActive } = dropzoneProps

  return (
    <div>
      <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
        <label className="tw-block tw-text-sm tw-font-medium">
          上传包文件
          {editingPackageId && (
            <span className="tw-ml-2 tw-text-primary tw-text-xs">
              (编辑模式)
            </span>
          )}
        </label>
        <div className="tw-flex tw-items-center">
          {editingPackageId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancelEdit}
              className="tw-mr-3"
              disabled={isUploading}>
              取消编辑
            </Button>
          )}
          <span className="tw-text-sm tw-mr-2">启用应用</span>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={isUploading}
          />
        </div>
      </div>

      <div
        {...getRootProps()}
        className={`upload-area tw-border-2 tw-border-dashed tw-rounded-md tw-p-6 tw-text-center ${isUploading ? "tw-opacity-70 tw-cursor-not-allowed" : "tw-cursor-pointer"} ${
          isDragActive
            ? "tw-border-primary tw-bg-primary/10"
            : editingPackageId
              ? "tw-border-yellow-500 tw-bg-yellow-50 dark:tw-bg-yellow-950/20"
              : "tw-border-gray-300"
        }`}>
        <input {...getInputProps()} disabled={isUploading} />

        {isUploading ? (
          <div className="tw-flex tw-flex-col tw-items-center tw-justify-center">
            <div className="tw-animate-spin tw-rounded-full tw-h-8 tw-w-8 tw-border-b-2 tw-border-primary tw-mb-2"></div>
            <p className="tw-font-medium">正在处理文件，请稍候...</p>
          </div>
        ) : editingPackageId ? (
          <p className="tw-font-medium tw-text-yellow-600 dark:tw-text-yellow-400">
            拖放新的 ZIP 文件到此处以替换选中的包
          </p>
        ) : (
          <p>拖放 ZIP 文件到此处，或点击上传</p>
        )}

        {!isUploading && (
          <p className="tw-text-xs tw-text-gray-500 tw-mt-1">
            ZIP 文件必须包含 apaas.json 文件，其中包含 outputName 字段
          </p>
        )}
      </div>
    </div>
  )
}

interface PackageListProps {
  packages: Package[]
  editingPackageId: string | null
  onDelete: (id: string) => void
  onEdit: (id: string) => void
}

const PackageList: React.FC<PackageListProps> = ({
  packages,
  editingPackageId,
  onDelete,
  onEdit
}) => {
  if (packages.length === 0) return null

  return (
    <div>
      <h3 className="tw-font-medium tw-mb-2">
        已上传的包 ({packages.length})
        {editingPackageId && (
          <span className="tw-ml-2 tw-text-primary tw-text-xs">- 编辑模式</span>
        )}
      </h3>
      <div className="tw-space-y-2">
        {packages.map((pkg) => (
          <PackageItem
            key={pkg.id}
            pkg={pkg}
            onDelete={onDelete}
            onEdit={onEdit}
            isEditing={pkg.id === editingPackageId}
          />
        ))}
      </div>
    </div>
  )
}

interface FormActionsProps {
  onCancel: () => void
  isUploading: boolean
}

const FormActions: React.FC<FormActionsProps> = ({ onCancel, isUploading }) => {
  return (
    <div className="tw-flex tw-justify-end tw-space-x-2">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isUploading}>
        取消
      </Button>
      <Button type="submit" disabled={isUploading}>
        {isUploading ? (
          <>
            <div className="tw-animate-spin tw-rounded-full tw-h-4 tw-w-4 tw-border-b-2 tw-border-white tw-mr-2"></div>
            处理中...
          </>
        ) : (
          "保存"
        )}
      </Button>
    </div>
  )
}


export const ApplicationForm: React.FC<ApplicationFormProps> = ({
  app,
  onSave,
  onCancel
}) => {
  const [name, setName] = useState(app?.name || "")
  const [urlPatterns, setUrlPatterns] = useState(
    app?.urlPatterns.join("\n") || ""
  )
  const [packages, setPackages] = useState<Package[]>(app?.packages || [])
  const [enabled, setEnabled] = useState(app?.enabled !== false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const dropzoneProps = useDropzone({
    accept: {
      "application/zip": [".zip"]
    },
    onDrop: async (acceptedFiles) => {
      setError(null)
      setSuccess(null)
      setIsUploading(true)

      try {
        for (const file of acceptedFiles) {
          // 显示正在处理的文件名
          setSuccess(`正在处理文件：${file.name}...`)

          const pkg = await processZipFile(file)
          if (pkg) {
            // 检查是否正在编辑已有包
            if (editingPackageId) {
              // 替换现有包
              setPackages((prev) =>
                prev.map((p) =>
                  p.id === editingPackageId
                    ? { ...pkg, id: editingPackageId }
                    : p
                )
              )
              setSuccess(`文件 ${file.name} 已成功替换`)
              setEditingPackageId(null) // 重置编辑状态
            } else {
              // 检查是否存在同名的包
              const hasDuplicateOutputName = packages.some(
                (p) => p.config.outputName === pkg.config.outputName
              )

              if (hasDuplicateOutputName) {
                setError(
                  `已存在输出名称为 ${pkg.config.outputName} 的包。如需覆盖，请点击对应包的"编辑"按钮。`
                )
              } else {
                // 添加新包
                setPackages((prev) => [...prev, pkg])
                setSuccess(`文件 ${file.name} 上传成功`)
              }
            }
          } else {
            setError(
              `无法处理文件 ${file.name}，请确保包含 apaas.json 文件且格式正确`
            )
          }
        }
      } catch (err) {
        setError(
          `上传文件时出错: ${err instanceof Error ? err.message : String(err)}`
        )
      } finally {
        setIsUploading(false)
      }
    },
    disabled: isUploading // 上传过程中禁用拖放功能
  })

  const handleDeletePackage = (id: string) => {
    setPackages((prev) => prev.filter((pkg) => pkg.id !== id))
    // 如果正在编辑的包被删除，重置编辑状态
    if (id === editingPackageId) {
      setEditingPackageId(null)
    }
  }

  const handleEditPackage = (id: string) => {
    // 如果当前正在编辑，并且点击了相同的包，则取消编辑
    if (editingPackageId === id) {
      setEditingPackageId(null)
      setSuccess(null)
      return
    }

    // 如果当前正在编辑其他包，先确认是否切换
    if (editingPackageId && editingPackageId !== id) {
      const confirmSwitch = window.confirm(
        "您正在编辑另一个包，是否切换到编辑当前选择的包？"
      )
      if (!confirmSwitch) {
        return
      }
    }

    setEditingPackageId(id)

    // 找到当前编辑的包
    const pkg = packages.find((p) => p.id === id)
    if (pkg) {
      // 设置成功消息，使用更醒目的提示
      setSuccess(
        `请上传新的包以替换: "${pkg.name}" (输出名称: ${pkg.config.outputName})`
      )

      // 自动滚动到上传区域，提高用户体验
      setTimeout(() => {
        const uploadArea = document.querySelector(".upload-area")
        if (uploadArea) {
          uploadArea.scrollIntoView({ behavior: "smooth", block: "center" })
        }
      }, 100)
    }
  }

  const handleCancelEdit = () => {
    setEditingPackageId(null)
    setSuccess(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // 如果正在上传，不允许提交
    if (isUploading) return

    // 如果用户正在编辑包但未完成，询问是否继续
    if (editingPackageId) {
      const confirmContinue = window.confirm(
        "您正在编辑一个包，但尚未上传新文件替换。是否继续保存应用？"
      )
      if (!confirmContinue) {
        return
      }
    }

    const patterns = urlPatterns
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean)

    const newApp: Application = {
      id: app?.id || uuidv4(),
      name,
      enabled,
      urlPatterns: patterns,
      packages,
      createdAt: app?.createdAt || Date.now(),
      updatedAt: Date.now()
    }
    onSave(newApp)
  }

  return (
    <form onSubmit={handleSubmit} className="tw-space-y-4">
      <AlertMessage error={error} success={success} isUploading={isUploading} />

      <BasicInfoForm
        name={name}
        setName={setName}
        urlPatterns={urlPatterns}
        setUrlPatterns={setUrlPatterns}
        // enabled={enabled}
        // setEnabled={setEnabled}
        isUploading={isUploading}
      />

      <PackageUploadArea
        editingPackageId={editingPackageId}
        handleCancelEdit={handleCancelEdit}
        enabled={enabled}
        setEnabled={setEnabled}
        isUploading={isUploading}
        dropzoneProps={dropzoneProps}
      />

      <PackageList
        packages={packages}
        editingPackageId={editingPackageId}
        onDelete={handleDeletePackage}
        onEdit={handleEditPackage}
      />

      <FormActions onCancel={onCancel} isUploading={isUploading} />
    </form>
  )
}
