import React, { useCallback, useEffect, useState } from "react"

import { useStorage } from "@plasmohq/storage/hook"

import { Alert, AlertDescription } from "~components/ui/alert"
import { Button } from "~components/ui/button"
import { Switch } from "~components/ui/switch"
import { toggleAppEnabled } from "~services/storage"
import type { Application } from "~types"

import "~style.css"

import { REPLACEMENT_UPDATED } from "~lib/constants"
import { matchApp } from "~lib/utils"

interface PageResource {
  type: "script" | "style"
  url: string
}

const Popup: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true)
  const [pageResources, setPageResources] = useState<PageResource[]>([])
  const [app, setApp] = useState<Application | null>(null)
  const [files, setFiles] = useStorage<string[]>("files", [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        // 获取当前标签页信息
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true
        })
        if (!tab || !tab.id) return setLoading(false)

        const app = await matchApp(tab.url)
        setApp(app.app)
        if (app?.app?.enabled) checkPageResources()
      } catch (error) {
        console.error("初始化 popup 时出错:", error)
      } finally {
        setLoading(false)
      }
    }

    init()

    const handlerMessage = (request: any) => {
      if (request.action === REPLACEMENT_UPDATED) {
        setFiles(request?.files ?? [])
      }
    }

    chrome.runtime.onMessage.addListener(handlerMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handlerMessage)
    }
  }, [])

  const openOptions = () => {
    chrome.runtime.openOptionsPage()
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
              setLoading(false)
            }
          }
        )
      }
    })
  }

  const toggleAppEnabledHandler = async () => {
    const newApp = await toggleAppEnabled(app?.id)
    if (app) {
      setApp(newApp)
      setTimeout(() => chrome.tabs.reload(), 500)
      if (newApp?.enabled) {
        setLoading(true)
        setTimeout(() => checkPageResources(), 500)
      }
    }
  }

  const isMatchUrl = useCallback(
    (url: string) => files.some((file) => url.includes(file?.replace("*", ""))),
    [files]
  )

  return (
    <div className="tw-p-4 tw-min-w-[350px]">
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-4">
        <h1 className="tw-text-xl tw-font-bold">APaaS 脚本替换工具</h1>
        <div className="tw-flex tw-items-center tw-space-x-2">
          <span className="tw-text-sm tw-mr-1">启用</span>
          <Switch
            checked={app?.enabled}
            onCheckedChange={toggleAppEnabledHandler}
          />
        </div>
      </div>

      {!app?.enabled && (
        <Alert className="tw-mb-4 tw-bg-yellow-50 tw-border-yellow-200 dark:tw-bg-yellow-900/20 dark:tw-border-yellow-900/30">
          <AlertDescription className="tw-text-yellow-800 dark:tw-text-yellow-300">
            当前页面没有匹配的应用或应用已禁用
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="tw-flex tw-justify-center tw-my-4">
          <div className="tw-animate-spin tw-rounded-full tw-h-6 tw-w-6 tw-border-b-2 tw-border-primary"></div>
        </div>
      ) : (
        <>
          {app?.enabled && (
            <div className="tw-mt-4">
              <h2 className="tw-text-md tw-font-medium tw-mb-2">
                页面资源 ({pageResources.length})
              </h2>
              <div className="tw-max-h-60 tw-overflow-y-auto tw-border tw-rounded-md tw-p-2">
                {pageResources.length > 0 ? (
                  pageResources.map((resource, index) => (
                    <div
                      key={index}
                      className="tw-mb-1 tw-py-2 tw-px-1 tw-border-b last:tw-border-b-0 hover:tw-bg-gray-50 dark:hover:tw-bg-gray-800/50 tw-rounded-sm">
                      <div className="tw-flex">
                        <span className="tw-font-medium tw-mr-2 tw-text-xs tw-flex-shrink-0">
                          {resource.type === "script" ? (
                            <span className="tw-bg-blue-100 tw-text-blue-800 dark:tw-bg-blue-900/30 dark:tw-text-blue-300 tw-px-1.5 tw-py-0.5 tw-rounded">
                              JS
                            </span>
                          ) : (
                            <span className="tw-bg-purple-100 tw-text-purple-800 dark:tw-bg-purple-900/30 dark:tw-text-purple-300 tw-px-1.5 tw-py-0.5 tw-rounded">
                              CSS
                            </span>
                          )}
                        </span>
                        <div className="tw-flex-1 tw-flex tw-items-center tw-justify-between tw-gap-2">
                          <p
                            className="tw-text-xs tw-truncate tw-max-w-[98%]"
                            title={resource.url}>
                            {resource.url}
                          </p>
                          {isMatchUrl(resource.url) && (
                            <span className="tw-font-medium tw-mr-2 tw-text-xs tw-flex-shrink-0 tw-bg-yellow-100 tw-text-blue-800 dark:tw-bg-blue-900/30 dark:tw-text-blue-300 tw-px-1.5 tw-py-0.5 tw-rounded">
                              已替换
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="tw-text-center tw-py-4 tw-text-gray-500 tw-text-sm">
                    未检测到页面资源
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="tw-flex tw-justify-end tw-mt-4">
            <Button variant="outline" onClick={openOptions}>
              配置
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export default Popup
