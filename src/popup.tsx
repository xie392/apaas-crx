import React, { useEffect, useState } from "react"

import { Button } from "~components/ui/button"
import { Switch } from "~components/ui/switch"
import { toggleAppEnabled } from "~services/storage"
import type { ReplacementInfo } from "~types"

import "~style.css"

interface AppStatus {
  id: string
  name: string
  enabled: boolean
}

interface PageResource {
  type: "script" | "style"
  url: string
}

const Popup: React.FC = () => {
  const [currentUrl, setCurrentUrl] = useState<string>("")
  const [replacements, setReplacements] = useState<ReplacementInfo[]>([])
  const [activeApps, setActiveApps] = useState<AppStatus[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [pageResources, setPageResources] = useState<PageResource[]>([])
  const [showResources, setShowResources] = useState<boolean>(false)

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        // 获取当前标签页信息
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true
        })
        if (!tab || !tab.id) return

        // 获取当前 URL
        try {
          chrome.tabs.sendMessage(
            tab.id,
            { type: "GET_PAGE_URL" },
            (response) => {
              if (response && response.url) {
                setCurrentUrl(response.url)
              }
            }
          )
        } catch (error) {
          console.error("无法获取页面 URL:", error)
        }

        // 获取当前标签页的替换信息
        chrome.runtime.sendMessage(
          { type: "GET_REPLACEMENTS", tabId: tab.id },
          (response) => {
            if (response && response.replacements) {
              setReplacements(response.replacements)

              // 提取唯一的应用
              const apps: AppStatus[] = []
              const appIds = new Set<string>()

              response.replacements.forEach((replacement: ReplacementInfo) => {
                if (!appIds.has(replacement.appId)) {
                  appIds.add(replacement.appId)
                  apps.push({
                    id: replacement.appId,
                    name: replacement.appName,
                    enabled: true // 如果看到替换，则应用已启用
                  })
                }
              })

              setActiveApps(apps)
            }
          }
        )
      } catch (error) {
        console.error("初始化 popup 时出错:", error)
      } finally {
        setLoading(false)
      }
    }

    init()

    // 监听替换更新消息
    const handleMessage = (message: any) => {
      if (message.type === "REPLACEMENT_UPDATED") {
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
          if (tab && tab.id === message.tabId) {
            setReplacements(message.replacements)

            // 更新应用状态
            const apps: AppStatus[] = []
            const appIds = new Set<string>()

            message.replacements.forEach((replacement: ReplacementInfo) => {
              if (!appIds.has(replacement.appId)) {
                appIds.add(replacement.appId)
                apps.push({
                  id: replacement.appId,
                  name: replacement.appName,
                  enabled: true
                })
              }
            })

            setActiveApps(apps)
          }
        })
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  /**
   * 切换应用启用状态并重新加载当前标签页
   * @param appId - 需要切换状态的应用ID
   * @throws 当切换应用状态失败时可能抛出错误
   * @description
   * 1. 调用 toggleAppEnabled 更新应用状态
   * 2. 更新本地应用列表状态
   * 3. 重新加载当前活动标签页以应用更改
   */
  const handleToggleApp = async (appId: string) => {
    try {
      const updatedApp = await toggleAppEnabled(appId)

      if (updatedApp) {
        setActiveApps((prev) =>
          prev.map((app) =>
            app.id === appId ? { ...app, enabled: updatedApp.enabled } : app
          )
        )

        // Reload the page to apply changes
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true
        })
        if (tab && tab.id) {
          chrome.tabs.reload(tab.id)
        }
      }
    } catch (error) {
      console.error("Error toggling app:", error)
    }
  }

  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  const openDevTools = () => {
    // 打开扩展后台页面的开发者工具
    chrome.tabs.create({ url: "chrome://extensions" }, () => {
      chrome.runtime.sendMessage({ type: "OPEN_DEV_TOOLS" })
    })
  }

  const checkPageResources = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0] && tabs[0].id) {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            func: () => {
              const resources: { type: "script" | "style"; url: string }[] = []

              // 获取所有脚本
              document.querySelectorAll("script[src]").forEach((script) => {
                const src = script.getAttribute("src")
                if (src) resources.push({ type: "script", url: src })
              })

              // 获取所有样式表
              document
                .querySelectorAll('link[rel="stylesheet"]')
                .forEach((link) => {
                  const href = link.getAttribute("href")
                  if (href) resources.push({ type: "style", url: href })
                })

              return resources
            }
          },
          (results) => {
            if (results && results[0] && results[0].result) {
              setPageResources(results[0].result)
              setShowResources(true)
            }
          }
        )
      }
    })
  }

  return (
    <div className="tw-p-4 tw-min-w-[350px]">
      <h1 className="tw-text-xl tw-font-bold tw-mb-4">APaaS 脚本替换工具</h1>

      {loading ? (
        <div className="tw-flex tw-justify-center tw-my-4">
          <div className="tw-animate-spin tw-rounded-full tw-h-6 tw-w-6 tw-border-b-2 tw-border-primary"></div>
        </div>
      ) : (
        <>
          {/* 应用信息与开关区域 */}
          {/* {activeApps.length > 0 ? ( */}
          <div className="tw-mb-4">
            <h2 className="tw-text-md tw-font-medium tw-mb-2">当前页面应用</h2>
            <div className="tw-space-y-2">
              {activeApps.map((app) => (
                <div
                  key={app.id}
                  className="tw-flex tw-items-center tw-justify-between tw-p-2 tw-bg-gray-100 dark:tw-bg-gray-800 tw-rounded">
                  <span>{app.name}</span>
                  <Switch
                    checked={app.enabled}
                    onCheckedChange={() => handleToggleApp(app.id)}
                  />
                </div>
              ))}
            </div>
          </div>
          {/* ) : (
            <p className="tw-text-sm tw-text-gray-500 tw-mb-4">
              当前页面没有匹配的应用
            </p>
          )} */}

          {/* 替换资源列表 */}
          {replacements.length > 0 ? (
            <div>
              <h2 className="tw-text-md tw-font-medium tw-mb-2">
                已替换资源 ({replacements.length})
              </h2>
              <div className="tw-max-h-60 tw-overflow-y-auto tw-space-y-2">
                {replacements.map((replacement, index) => (
                  <div
                    key={index}
                    className="tw-p-2 tw-bg-gray-100 dark:tw-bg-gray-800 tw-rounded tw-text-xs">
                    <div className="tw-truncate">
                      <span className="tw-font-medium">原始:</span>{" "}
                      {replacement.originalUrl}
                    </div>
                    <div className="tw-truncate">
                      <span className="tw-font-medium">替换:</span>{" "}
                      {replacement.replacedUrl}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="tw-text-sm tw-text-gray-500 tw-mb-4">
              当前页面没有替换的资源
            </p>
          )}

          {/* 显示页面资源的区域 */}
          <div className="tw-mt-4">
            <div className="tw-flex tw-items-center tw-justify-between tw-mb-2">
              <button
                className="tw-text-sm tw-text-blue-600 hover:tw-underline"
                onClick={() => setShowResources(!showResources)}>
                {showResources ? "隐藏页面资源" : "显示页面资源"}
              </button>
              <Button variant="outline" size="sm" onClick={checkPageResources}>
                检查资源
              </Button>
            </div>

            {showResources && pageResources.length > 0 && (
              <div className="tw-mt-2">
                <h3 className="tw-text-sm tw-font-medium tw-mb-1">
                  页面资源 ({pageResources.length})
                </h3>
                <div className="tw-max-h-60 tw-overflow-y-auto tw-border tw-rounded tw-p-2 tw-text-xs">
                  {pageResources.map((resource, index) => (
                    <div
                      key={index}
                      className="tw-mb-1 tw-py-1 tw-border-b last:tw-border-b-0">
                      <div className="tw-flex">
                        <span className="tw-font-bold tw-mr-1">
                          {resource.type === "script" ? "📜 JS:" : "🎨 CSS:"}
                        </span>
                        <span className="tw-truncate">{resource.url}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="tw-flex tw-justify-between tw-mt-4">
            <Button variant="outline" size="sm" onClick={openOptions}>
              配置
            </Button>
            <Button variant="outline" size="sm" onClick={openDevTools}>
              开发者工具
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export default Popup
