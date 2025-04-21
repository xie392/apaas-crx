import React, { useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { v4 as uuidv4 } from "uuid"

import { Alert, AlertDescription, AlertTitle } from "~components/ui/alert"
import { Button } from "~components/ui/button"
import {
  AlertCircleIcon,
  CheckCircleIcon,
  EditIcon,
  SettingsIcon,
  TrashIcon
} from "~components/ui/icons"
import { Switch } from "~components/ui/switch"
import { processZipFile } from "~services/package"
import {
  deleteApp,
  getApps,
  saveApp,
  toggleAppEnabled
} from "~services/storage"
import type { Application, Package } from "~types"

import "~style.css"

import { Logo } from "~components/logo"

const PackageItem: React.FC<{
  pkg: Package
  onDelete: (id: string) => void
  onEdit: (id: string) => void
  isEditing?: boolean
}> = ({ pkg, onDelete, onEdit, isEditing = false }) => {
  // 阻止事件冒泡的处理函数
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation() // 防止事件冒泡
    e.preventDefault()
    onEdit(pkg.id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation() // 防止事件冒泡
    e.preventDefault()
    onDelete(pkg.id)
  }

  return (
    <div
      className={`tw-flex tw-items-center tw-justify-between tw-p-3 tw-mb-2 tw-rounded ${
        isEditing
          ? "tw-bg-yellow-50 tw-border-2 tw-border-yellow-500 dark:tw-bg-yellow-950/30"
          : "tw-bg-gray-100 dark:tw-bg-gray-800"
      }`}>
      <div>
        <div className="tw-font-medium">{pkg.name}</div>
        <div className="tw-text-xs tw-text-gray-500">
          输出名称: {pkg.config.outputName}
        </div>
        <div className="tw-text-xs tw-text-gray-500">
          上传时间: {new Date(pkg.uploadedAt).toLocaleString()}
        </div>
        {isEditing && (
          <div className="tw-text-xs tw-text-yellow-600 dark:tw-text-yellow-400 tw-mt-1">
            <strong>编辑中</strong> - 请上传新文件进行替换
          </div>
        )}
      </div>
      <div className="tw-flex tw-space-x-2">
        <Button
          variant={isEditing ? "default" : "outline"}
          size="sm"
          onClick={handleEdit}
          disabled={isEditing}
          className={
            isEditing
              ? "tw-bg-yellow-500 tw-text-white hover:tw-bg-yellow-600"
              : ""
          }>
          <EditIcon className="tw-h-4 tw-w-4 tw-mr-1" />
          {isEditing ? "编辑中" : "编辑"}
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <TrashIcon className="tw-h-4 tw-w-4 tw-mr-1" />
          删除
        </Button>
      </div>
    </div>
  )
}

const ApplicationForm: React.FC<{
  app?: Application
  onSave: (app: Application) => void
  onCancel: () => void
}> = ({ app, onSave, onCancel }) => {
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
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

    // Parse URL patterns from textarea
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

      {packages.length > 0 && (
        <div>
          <h3 className="tw-font-medium tw-mb-2">
            已上传的包 ({packages.length})
            {editingPackageId && (
              <span className="tw-ml-2 tw-text-primary tw-text-xs">
                - 编辑模式
              </span>
            )}
          </h3>
          <div className="tw-space-y-2">
            {packages.map((pkg) => (
              <PackageItem
                key={pkg.id}
                pkg={pkg}
                onDelete={handleDeletePackage}
                onEdit={handleEditPackage}
                isEditing={pkg.id === editingPackageId}
              />
            ))}
          </div>
        </div>
      )}

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
    </form>
  )
}

const ApplicationItem: React.FC<{
  app: Application
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}> = ({ app, onEdit, onDelete, onToggle }) => {
  return (
    <div className="tw-border tw-rounded-md tw-p-4 tw-mb-3">
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-3">
        <h3 className="tw-text-lg tw-font-medium">{app.name}</h3>
        <div className="tw-flex tw-items-center">
          <Switch
            checked={app.enabled}
            onCheckedChange={onToggle}
            className="tw-mr-2"
          />
          <span className="tw-text-sm tw-text-gray-500 tw-mr-3">
            {app.enabled ? "已启用" : "已禁用"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="tw-mr-1">
            <EditIcon className="tw-h-4 tw-w-4 tw-mr-1" />
            编辑
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <TrashIcon className="tw-h-4 tw-w-4 tw-mr-1" />
            删除
          </Button>
        </div>
      </div>

      <div className="tw-text-sm">
        <div className="tw-mb-2">
          <span className="tw-font-medium">URL 规则：</span>
          <div className="tw-flex tw-flex-wrap tw-gap-1 tw-mt-1">
            {app.urlPatterns.map((pattern, i) => (
              <span
                key={i}
                className="tw-bg-gray-100 dark:tw-bg-gray-800 tw-px-2 tw-py-1 tw-rounded tw-text-xs">
                {pattern}
              </span>
            ))}
          </div>
        </div>
        <div className="tw-mb-2">
          <span className="tw-font-medium">包数量：</span> {app.packages.length}
        </div>
      </div>
    </div>
  )
}

const Options: React.FC = () => {
  const [apps, setApps] = useState<Application[]>([])
  const [editingApp, setEditingApp] = useState<Application | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const loadApps = async () => {
      setLoading(true)
      try {
        const loadedApps = await getApps()
        setApps(loadedApps)
      } catch (error) {
        console.error("Failed to load apps:", error)
      } finally {
        setLoading(false)
      }
    }

    loadApps()
  }, [])

  const handleSaveApp = async (app: Application) => {
    try {
      await saveApp(app)

      setApps((prev) => {
        const index = prev.findIndex((a) => a.id === app.id)
        if (index >= 0) {
          return [...prev.slice(0, index), app, ...prev.slice(index + 1)]
        } else {
          return [...prev, app]
        }
      })

      setEditingApp(null)
      setIsCreating(false)
    } catch (error) {
      console.error("Failed to save app:", error)
    }
  }

  const handleDeleteApp = async (id: string) => {
    if (!confirm("确定要删除此应用吗？")) {
      return
    }

    try {
      await deleteApp(id)
      setApps((prev) => prev.filter((app) => app.id !== id))
    } catch (error) {
      console.error("Failed to delete app:", error)
    }
  }

  const handleToggleApp = async (id: string) => {
    try {
      const updatedApp = await toggleAppEnabled(id)
      if (updatedApp) {
        setApps((prev) =>
          prev.map((app) =>
            app.id === id ? { ...app, enabled: updatedApp.enabled } : app
          )
        )
      }
    } catch (error) {
      console.error("Failed to toggle app:", error)
    }
  }

  return (
    <div className="tw-container tw-mx-auto tw-py-6 tw-px-4 tw-max-w-4xl">
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-6">
        <h1 className="tw-text-2xl tw-font-bold">
          <Logo title="APaaS 脚本替换工具配置" size="large" />
        </h1>
        <div className="tw-flex tw-space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowHelp(!showHelp)}
            className="tw-mr-2">
            <SettingsIcon className="tw-h-4 tw-w-4 tw-mr-1" />
            {showHelp ? "隐藏帮助" : "显示帮助"}
          </Button>
          {!isCreating && !editingApp && (
            <Button onClick={() => setIsCreating(true)}>创建新应用</Button>
          )}
        </div>
      </div>

      {showHelp && (
        <Alert className="tw-mb-6">
          <div className="tw-text-sm tw-mb-2">
            <strong>应用包管理说明：</strong>
          </div>
          <ul className="tw-list-disc tw-list-inside tw-text-sm tw-space-y-1">
            <li>上传包时，系统会自动检查是否存在相同输出名称的包</li>
            <li>如果发现同名包，系统会阻止上传并显示错误信息</li>
            <li>要替换已有的包，请点击对应包的"编辑"按钮，然后上传新包</li>
            <li>替换包时，新包将保留原包的ID，但会更新其内容</li>
            <li>
              包的输出名称决定了最终替换的文件名，确保与目标网站的资源名称匹配
            </li>
          </ul>
        </Alert>
      )}

      {loading ? (
        <div className="tw-flex tw-justify-center tw-py-10">
          <div className="tw-animate-spin tw-rounded-full tw-h-10 tw-w-10 tw-border-b-2 tw-border-primary"></div>
        </div>
      ) : isCreating || editingApp ? (
        <div className="tw-bg-card tw-rounded-lg tw-p-6 tw-shadow-sm">
          <h2 className="tw-text-xl tw-font-bold tw-mb-4">
            {isCreating ? "创建新应用" : "编辑应用"}
          </h2>
          <ApplicationForm
            app={editingApp || undefined}
            onSave={handleSaveApp}
            onCancel={() => {
              setIsCreating(false)
              setEditingApp(null)
            }}
          />
        </div>
      ) : apps.length > 0 ? (
        <div className="tw-space-y-4">
          {apps.map((app) => (
            <ApplicationItem
              key={app.id}
              app={app}
              onEdit={() => setEditingApp(app)}
              onDelete={() => handleDeleteApp(app.id)}
              onToggle={() => handleToggleApp(app.id)}
            />
          ))}
        </div>
      ) : (
        <div className="tw-text-center tw-py-10">
          <p className="tw-text-gray-500 tw-mb-4">还没有创建应用</p>
          <Button onClick={() => setIsCreating(true)}>创建第一个应用</Button>
        </div>
      )}
    </div>
  )
}

export default Options
