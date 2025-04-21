import React, { useEffect, useState } from "react"

import { Alert, AlertDescription } from "~components/ui/alert"
import { Button } from "~components/ui/button"
import { Switch } from "~components/ui/switch"
import { toggleAppEnabled } from "~services/storage"
import type { ReplacementInfo } from "~types"
import { APP_INIT } from "~lib/constants"

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
  const [extensionEnabled, setExtensionEnabled] = useState<boolean>(true)
  const [isMatchingPage, setIsMatchingPage] = useState<boolean>(false)

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        // 获取当前标签页信息
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true
        })
        if (!tab || !tab.id) {
          console.error("无法获取当前标签页");
          setLoading(false);
          return;
        }

        // 获取当前 URL
        let currentPageUrl = tab.url || "";
        try {
          chrome.tabs.sendMessage(
            tab.id,
            { type: "GET_PAGE_URL" },
            (response) => {
              if (response && response.url) {
                currentPageUrl = response.url;
                setCurrentUrl(response.url)
              }
            }
          )
        } catch (error) {
          console.error("无法获取页面 URL, 使用标签页URL:", tab.url, error)
          setCurrentUrl(tab.url || "");
        }

        // 获取扩展是否启用
        chrome.storage.local.get("extensionEnabled", (data) => {
          const enabled = data.extensionEnabled !== false; // 默认为true
          setExtensionEnabled(enabled);
        });

        // 首先检查URL是否匹配任何应用 (使用APP_INIT消息)
        chrome.runtime.sendMessage(
          { action: APP_INIT, url: currentPageUrl },
          (response) => {
            console.log("APP_INIT response:", response);
            if (response && response.isPattern) {
              // URL匹配应用，设置为匹配页面
              setIsMatchingPage(true);
              
              if (response.app) {
                // 添加匹配的应用到activeApps
                setActiveApps([{
                  id: response.app.id,
                  name: response.app.name,
                  enabled: response.app.enabled
                }]);
              }
            } else {
              // URL不匹配任何应用
              setIsMatchingPage(false);
            }
          }
        );

        // 然后获取当前标签页的替换信息
        chrome.runtime.sendMessage(
          { type: "GET_REPLACEMENTS", tabId: tab.id },
          (response) => {
            console.log("GET_REPLACEMENTS response:", response);
            if (response && response.success && response.replacements) {
              // 设置替换信息
              setReplacements(response.replacements);

              // 如果有替换信息，提取应用信息
              if (response.replacements.length > 0) {
                // 提取唯一的应用
                const apps: AppStatus[] = [];
                const appIds = new Set<string>();

                response.replacements.forEach((replacement: ReplacementInfo) => {
                  if (!appIds.has(replacement.appId)) {
                    appIds.add(replacement.appId);
                    apps.push({
                      id: replacement.appId,
                      name: replacement.appName,
                      enabled: true // 如果看到替换，则应用已启用
                    });
                  }
                });

                setActiveApps(apps);
              }
            } else if (response && response.error) {
              console.error("获取替换信息失败:", response.error);
            }
          }
        );

        // 检查页面资源
        checkPageResources();
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
            console.log("收到替换更新:", message.replacements);
            setReplacements(message.replacements);

            // 更新应用状态
            if (message.replacements.length > 0) {
              const apps: AppStatus[] = [];
              const appIds = new Set<string>();

              message.replacements.forEach((replacement: ReplacementInfo) => {
                if (!appIds.has(replacement.appId)) {
                  appIds.add(replacement.appId);
                  apps.push({
                    id: replacement.appId,
                    name: replacement.appName,
                    enabled: true
                  });
                }
              });

              setActiveApps(apps);
            }
          }
        });
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    }
  }, [])

  /**
   * 切换应用启用状态并重新加载当前标签页
   * @param appId - 需要切换状态的应用ID
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

  /**
   * 切换整个扩展的启用状态
   */
  const toggleExtensionEnabled = async () => {
    const newState = !extensionEnabled;
    setExtensionEnabled(newState);
    
    // 保存到存储中
    await chrome.storage.local.set({ extensionEnabled: newState });
    
    // 重新加载当前页面以应用更改
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    
    if (tab && tab.id) {
      chrome.tabs.reload(tab.id);
    }
  };

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
            }
          }
        )
      }
    })
  }

  return (
    <div className="tw-p-4 tw-min-w-[350px]">
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-4">
        <h1 className="tw-text-xl tw-font-bold">APaaS 脚本替换工具</h1>
        <div className="tw-flex tw-items-center tw-space-x-2">
          <span className="tw-text-sm tw-mr-1">启用</span>
          <Switch 
            checked={extensionEnabled} 
            onCheckedChange={toggleExtensionEnabled}
            disabled={!isMatchingPage}
          />
        </div>
      </div>

      {!isMatchingPage && (
        <Alert className="tw-mb-4 tw-bg-yellow-50 tw-border-yellow-200 dark:tw-bg-yellow-900/20 dark:tw-border-yellow-900/30">
          <AlertDescription className="tw-text-yellow-800 dark:tw-text-yellow-300">
            当前页面没有匹配的应用，无法启用扩展功能。
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="tw-flex tw-justify-center tw-my-4">
          <div className="tw-animate-spin tw-rounded-full tw-h-6 tw-w-6 tw-border-b-2 tw-border-primary"></div>
        </div>
      ) : (
        <>
          {/* 应用信息与开关区域 */}
          {activeApps.length > 0 && (
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
                      disabled={!extensionEnabled}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 替换资源列表 */}
          {replacements.length > 0 ? (
            <div className="tw-mb-4">
              <h2 className="tw-flex tw-items-center tw-justify-between tw-text-md tw-font-medium tw-mb-2">
                <span>替换资源 ({replacements.length})</span>
                <span className="tw-text-xs tw-text-gray-500">
                  {extensionEnabled ? '已启用' : '已禁用'}
                </span>
              </h2>
              <div className="tw-max-h-60 tw-overflow-y-auto tw-rounded-md tw-border">
                {replacements.map((replacement, index) => (
                  <div
                    key={index}
                    className="tw-py-2 tw-px-3 tw-border-b last:tw-border-b-0 hover:tw-bg-gray-50 dark:hover:tw-bg-gray-800/50">
                    <div className="tw-flex tw-items-center">
                      <div className={`tw-w-2 tw-h-2 tw-rounded-full tw-mr-2 ${
                        extensionEnabled 
                          ? 'tw-bg-green-500' 
                          : 'tw-bg-gray-400'
                      }`}></div>
                      <div className="tw-flex-1 tw-overflow-hidden">
                        <div className="tw-flex tw-flex-col">
                          <div className="tw-truncate tw-text-xs">
                            <span className="tw-font-medium tw-text-gray-700 dark:tw-text-gray-300">
                              原始:
                            </span>
                            <span className="tw-ml-1 tw-text-gray-600 dark:tw-text-gray-400">
                              {replacement.originalUrl}
                            </span>
                          </div>
                          <div className="tw-truncate tw-text-xs">
                            <span className="tw-font-medium tw-text-gray-700 dark:tw-text-gray-300">
                              替换:
                            </span>
                            <span className="tw-ml-1 tw-text-green-600 dark:tw-text-green-400">
                              {replacement.replacedUrl}
                            </span>
                          </div>
                        </div>
                      </div>
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

          {/* 页面资源区域 (默认显示) */}
          <div className="tw-mt-4">
            <h2 className="tw-text-md tw-font-medium tw-mb-2">页面资源 ({pageResources.length})</h2>
            <div className="tw-max-h-60 tw-overflow-y-auto tw-border tw-rounded-md tw-p-2">
              {pageResources.length > 0 ? (
                pageResources.map((resource, index) => (
                  <div
                    key={index}
                    className="tw-mb-1 tw-py-2 tw-px-2 tw-border-b last:tw-border-b-0 hover:tw-bg-gray-50 dark:hover:tw-bg-gray-800/50 tw-rounded-sm">
                    <div className="tw-flex">
                      <span className="tw-font-medium tw-mr-2 tw-text-xs">
                        {resource.type === "script" ? (
                          <span className="tw-bg-blue-100 tw-text-blue-800 dark:tw-bg-blue-900/30 dark:tw-text-blue-300 tw-px-1.5 tw-py-0.5 tw-rounded">JS</span>
                        ) : (
                          <span className="tw-bg-purple-100 tw-text-purple-800 dark:tw-bg-purple-900/30 dark:tw-text-purple-300 tw-px-1.5 tw-py-0.5 tw-rounded">CSS</span>
                        )}
                      </span>
                      <span className="tw-text-xs tw-truncate">{resource.url}</span>
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

          {/* 配置按钮 */}
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
