import { APP_INIT, REPLACEMENT_UPDATED } from "~lib/constants"
import { applyRules, clearRedirectRules } from "~lib/rule-manager"
import { extractDomainFromPattern, matchApp, splitFileNames } from "~lib/utils"
import type { Application, Package } from "~types"

import { injectedScript, injectedStyle } from "./injected-helper"
import { injectResource } from "./url-replacement-worker"

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.action === APP_INIT) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      matchApp(sender.url).then((apps) => {
        if (apps.isPattern && apps.app && apps.app?.enabled) {
          updateRedirectRules(tab.id, apps.app)
        } else {
          clearRedirectRules()
        }
      })
    })
  }
})

/**
 * 向 Chrome 扩展的弹出窗口发送消息
 * @param message 要发送的消息内容
 * @description 该函数通过 Chrome 扩展 API 查询当前活动标签页，并向其发送指定消息
 */
function sendToPopup(message: any) {
  try {
    chrome.runtime.sendMessage(
      {
        action: REPLACEMENT_UPDATED,
        ...message
      },
      () => {
        // 检查是否有运行时错误
        if (chrome.runtime.lastError) {
          // 忽略 "Receiving end does not exist" 错误，这通常发生在popup未打开时
          if (
            !chrome.runtime.lastError.message?.includes(
              "Receiving end does not exist"
            )
          ) {
            console.warn(
              "发送消息到popup时出错:",
              chrome.runtime.lastError.message
            )
          }
        }
      }
    )
  } catch (error) {
    console.warn("发送消息到popup失败:", error)
  }
}

/**
 * 更新 Chrome 扩展的重定向规则
 *
 * @param app Application 对象，包含应用配置信息
 * @description
 * 该函数根据应用配置更新 Chrome 扩展的动态重定向规则：
 * - 如果应用没有上传包，则直接返回
 * - 如果功能被禁用，清除所有现有规则
 * - 根据配置的 URL 模式和包文件创建新的重定向规则
 * - 支持 JS 和 CSS 文件的重定向
 * - 规则仅应用于指定域名范围
 */
async function updateRedirectRules(tabId: number, app: Application) {
  // 从匹配模式中提取域名部分，用于更精确的匹配
  const domains = app.urlPatterns.map(extractDomainFromPattern)
  
  // 如果有开发配置
  if (app.devConfigs.length) injectResource(tabId, app, domains)

  // 如果没有上传任何包
  if (!app.packages.length) return

  // 如果功能被禁用，清除所有规则
  if (!app.enabled || !app) {
    clearRedirectRules()
    return
  }

  // 构建所有需要重定向的文件映射
  const scriptMappings: Record<string, ArrayBuffer> = {}

  // 等待所有包处理完成
  await Promise.all(
    app.packages.map(async (pkg: Package) => {
      const jsFileName = pkg.config.outputName + ".umd.js"
      const cssFileName = pkg.config.outputName + ".css"
      const wookerFileName = pkg.config.outputName + ".umd.worker.js"

      // 先应用拦截规则，阻止原始文件加载
      await applyRules(pkg.config.outputName, domains)

      if (pkg.files[jsFileName]) {
        scriptMappings[`*${jsFileName}`] = pkg.files[jsFileName]
      }
      if (pkg.files[cssFileName]) {
        scriptMappings[`*${cssFileName}`] = pkg.files[cssFileName]
      }
      if (pkg.files[wookerFileName]) {
        scriptMappings[`*${wookerFileName}`] = pkg.files[wookerFileName]
      }
    })
  )

  const files: string[] = []
  // 现在 scriptMappings 已经填充完成
  Object.entries(scriptMappings).forEach(([fileName, buffer]) => {
    injectScriptWithEval(tabId, fileName, buffer)
    files.push(fileName)
  })

  // 发送消息给 Popup
  sendToPopup({ files })
}

/**
 * 使用 eval 动态注入脚本到页面中
 * @param tabId - 当前标签页 ID
 * @param fileName - 脚本文件名
 * @param buffer - 脚本内容的 ArrayBuffer
 */
function injectScriptWithEval(
  tabId: number,
  fileName: string,
  buffer: ArrayBuffer
) {
  const decoder = new TextDecoder("utf-8")
  const content = decoder.decode(buffer)

  const { isWorker, isCss, isUmdJs, name } = splitFileNames(fileName)

  // 注入 umd.js 和 worker.js
  if (isUmdJs || isWorker) {
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: injectedScript,
      args: [{ url: content, name, isWorker, isContent: true, isDev: false }]
    })
  }

  // 注入 css
  if (isCss) {
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: injectedStyle,
      args: [{ url: content, name, isContent: true, isDev: false }]
    })
  }
}
