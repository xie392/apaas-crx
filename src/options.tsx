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
}> = ({ pkg, onDelete }) => {
  return (
    <div className="tw-flex tw-items-center tw-justify-between tw-p-3 tw-mb-2 tw-bg-gray-100 dark:tw-bg-gray-800 tw-rounded">
      <div>
        <div className="tw-font-medium">{pkg.name}</div>
        <div className="tw-text-xs tw-text-gray-500">
          输出名称: {pkg.config.outputName}
        </div>
        <div className="tw-text-xs tw-text-gray-500">
          上传时间: {new Date(pkg.uploadedAt).toLocaleString()}
        </div>
      </div>
      <Button variant="destructive" size="sm" onClick={() => onDelete(pkg.id)}>
        删除
      </Button>
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/zip": [".zip"]
    },
    onDrop: async (acceptedFiles) => {
      setError(null)
      setSuccess(null)

      try {
        for (const file of acceptedFiles) {
          const pkg = await processZipFile(file)
          if (pkg) {
            setPackages((prev) => [...prev, pkg])
            setSuccess(`文件 ${file.name} 上传成功`)
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
      }
    }
  })

  const handleDeletePackage = (id: string) => {
    setPackages((prev) => {
      const pkgToDelete = prev.find((p) => p.id === id)
      if (pkgToDelete) {
        // revokePackageUrls(pkgToDelete)
      }
      return prev.filter((pkg) => pkg.id !== id)
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

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
    // const { packages: _, ...apps } = newApp
    // setStores((prev) => ({
    //   ...prev,
    //   [newApp.id]: apps
    // }))
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
        <Alert variant="success" className="tw-mb-4">
          <CheckCircleIcon className="tw-h-4 tw-w-4" />
          <AlertTitle>成功</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
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
        />
        <p className="tw-text-xs tw-text-gray-500 tw-mt-1">
          使用 * 作为通配符，每行一个规则。例如: https://*.example.com/*
        </p>
      </div>

      <div>
        <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
          <label className="tw-block tw-text-sm tw-font-medium">
            上传包文件
          </label>
          <div className="tw-flex tw-items-center">
            <span className="tw-text-sm tw-mr-2">启用应用</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <div
          {...getRootProps()}
          className={`tw-border-2 tw-border-dashed tw-rounded-md tw-p-6 tw-text-center tw-cursor-pointer ${
            isDragActive
              ? "tw-border-primary tw-bg-primary/10"
              : "tw-border-gray-300"
          }`}>
          <input {...getInputProps()} />
          <p>拖放 ZIP 文件到此处，或点击上传</p>
          <p className="tw-text-xs tw-text-gray-500 tw-mt-1">
            ZIP 文件必须包含 apaas.json 文件，其中包含 outputName 字段
          </p>
        </div>
      </div>

      {packages.length > 0 && (
        <div>
          <h3 className="tw-font-medium tw-mb-2">
            已上传的包 ({packages.length})
          </h3>
          <div className="tw-space-y-2">
            {packages.map((pkg) => (
              <PackageItem
                key={pkg.id}
                pkg={pkg}
                onDelete={handleDeletePackage}
              />
            ))}
          </div>
        </div>
      )}

      <div className="tw-flex tw-justify-end tw-space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit">保存</Button>
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
        <div>
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

  // const [_, setStores] = useStorage<{ [appId: string]: AppStore }>(
  //   APPS_STORE_KEY
  // )

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

      // 保存到本地，方便 contents 页使用
      // const { packages: _, ...apps } = app
      // setStores((prev) => ({
      //   ...prev,
      //   [app.id]: apps
      // }))

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
      // Revoke all package URLs before deleting
      const appToDelete = apps.find((app) => app.id === id)
      if (appToDelete) {
        //
        alert("TODO: Revoke package URLs")
        // appToDelete.packages.forEach((pkg) => revokePackageUrls(pkg))
      }

      // 删除本地存储
      // setStores((prev) => {
      //   const { [id]: _, ...apps } = prev
      //   return apps
      // })

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
        {!isCreating && !editingApp && (
          <Button onClick={() => setIsCreating(true)}>创建新应用</Button>
        )}
      </div>

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
