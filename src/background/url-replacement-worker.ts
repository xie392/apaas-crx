import { REPLACEMENT_UPDATED } from "~lib/constants"
import {
  clearRedirectRules,
  generateBlockRules,
  interceptRequest
} from "~lib/rule-manager"
import type { Application, Package } from "~types"

import { injectResource, injectScriptWithEval } from "./injected-helper"
import { extractDomainFromPattern } from "~lib/utils"

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
export async function updateRedirectRules(tabId: number, app: Application) {
  // 如果功能被禁用，清除所有规则
  if (!app.enabled || !app) {
    clearRedirectRules()
    return
  }

  // 如果有开发配置
  if (app.devConfigs.length) injectResource(tabId, app)

  // 如果没有上传任何包
  if (!app.packages.length) return

  // 构建所有需要重定向的文件映射
  const scriptMappings: Record<string, ArrayBuffer> = {}
  const domains = app.urlPatterns.map(extractDomainFromPattern)
  const rules: chrome.declarativeNetRequest.Rule[] = []
  let ruleId = 1

  // 等待所有包处理完成
  const promise = app.packages.map(async (pkg: Package) => {
    const jsFileName = pkg.config.outputName + ".umd.js"
    const cssFileName = pkg.config.outputName + ".css"

    scriptMappings[jsFileName] = pkg.files[jsFileName]
    scriptMappings[cssFileName] = pkg.files[cssFileName]

    const jsRule = generateBlockRules(jsFileName, domains, ruleId++)
    const cssRule = generateBlockRules(cssFileName, domains, ruleId++)
    rules.push(jsRule, cssRule)
  })

  await Promise.all(promise)
  await interceptRequest(rules)

  const files: string[] = []
  // 现在 scriptMappings 已经填充完成
  Object.entries(scriptMappings).forEach(([fileName, buffer]) => {
    injectScriptWithEval(tabId, fileName, buffer)
    files.push(fileName)
  })

  // 发送消息给 Popup
  sendToPopup({ files })
}
