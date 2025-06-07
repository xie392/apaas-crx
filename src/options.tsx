import React, { useEffect, useState } from "react"

import { Alert } from "~components/ui/alert"
import { Button } from "~components/ui/button"
import { SettingsIcon } from "~components/ui/icons"
import {
  deleteApp,
  getApps,
  saveApp,
  toggleAppEnabled
} from "~services/storage"
import type { Application } from "~types"

import "~style.css"

import { ApplicationForm } from "~components/application/application-form"
import { ApplicationItem } from "~components/application/application-item"
import { Logo } from "~components/logo"

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
            <SettingsIcon className="tw-h-4 tw-w-4 tw-mr-1.5" />
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
