import { APP_INIT, GET_FILE_LIST, REPLACEMENT_UPDATED } from "~lib/constants"
import {
  applyDataUrlRedirectRules,
  applyRules,
  clearRedirectRules,
  generateBlockRules,
  interceptRequest
} from "~lib/rule-manager"
import {
  extractDomainFromPattern,
  getFileSuffix,
  matchApp,
  splitFileNames
} from "~lib/utils"
import type { Application, Package } from "~types"

import { injected, injectedScript, injectedStyle } from "./injected-helper"
// import { injectedScript, injectedStyle } from "./injected-helper"
import { injectResource } from "./url-replacement-worker"

/**
 * 根据文件路径获取 MIME 类型
 */
function getMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    js: "application/javascript",
    css: "text/css",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    eot: "application/vnd.ms-fontobject"
  }
  return mimeTypes[ext || ""] || "application/octet-stream"
}

/**
 * 将 ArrayBuffer 转换为 Data URL
 */
function arrayBufferToDataUrl(
  arrayBuffer: ArrayBuffer,
  mimeType: string
): string {
  const uint8Array = new Uint8Array(arrayBuffer)
  let binary = ""
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  const base64 = btoa(binary)
  return `data:${mimeType};base64,${base64}`
}

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

  // 如果功能被禁用，清除所有规则
  if (!app.enabled || !app) {
    clearRedirectRules()
    return
  }

  // 如果有开发配置
  if (app.devConfigs.length) injectResource(tabId, app)

  // 如果没有上传任何包
  if (!app.packages.length) return

  // 处理压缩包 - 将 ArrayBuffer 转为 Data URL
  // const dataUrls: Record<string, string> = {}

  const domains = app.urlPatterns.map(extractDomainFromPattern)
  const rules: chrome.declarativeNetRequest.Rule[] = []
  let ruleId = 1
  const files: Record<string, ArrayBuffer> = {}
  // // 将 ArrayBuffer 转为 Data URL
  for (const pkg of app.packages) {
    for (const [path, arrayBuffer] of Object.entries(pkg.files)) {
      const rule = generateBlockRules(path, domains, ruleId++)
      rules.push(rule)
      files[path] = arrayBuffer
      // injectScriptWithEval(tabId, path, files[path])
      //   const mimeType = getMimeType(path)
      //   dataUrls[path] = arrayBufferToDataUrl(arrayBuffer, mimeType)
    }
  }
  await interceptRequest(rules)

  // chrome.webRequest.onBeforeRequest.addListener(
  //   (details) => {
  //     if (!app.enabled || !app) return {}

  //     const rule = rules.find((r) =>
  //       details.url.includes(r.condition.urlFilter.replace("*", ""))
  //     )

  //     if (rule) {
  //       const path = rule.condition.urlFilter.replace("*", "")
  //       injectScriptWithEval(details.tabId, path, files[path])
  //     }

  //     return {}
  //   },
  //   {
  //     // urls: ["<all_urls>"]
  //     urls: app.urlPatterns
  //   }
  // )

  // // 发送 data URLs 到 content script 进行注入
  // chrome.tabs.sendMessage(tabId, { action: GET_FILE_LIST, data: dataUrls })

  // // 发送消息给 Popup
  // sendToPopup({ files: Object.keys(dataUrls) })
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

  // const isJs = getFileSuffix(fileName)
  // const isCss = getFileSuffix(fileName)
  // const { isWorker, isCss, isUmdJs, name } = splitFileNames(fileName)

  // 注入 umd.js 和 worker.js
  // if (isJs) {
  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: injected,
    args: [{ content, name: fileName }]
  })
  // }

  // 注入 css
  // if (isCss) {
  //   chrome.scripting.executeScript({
  //     target: { tabId },
  //     world: "MAIN",
  //     func: injectedStyle,
  //     args: [{ content, name }]
  //   })
  // }
}

function main() {
  chrome.runtime.onMessage.addListener((request) => {
    // 初始化
    if (request.action === APP_INIT) {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        matchApp(tab.url).then((apps) => {
          if (apps.isPattern && apps.app && apps.app?.enabled) {
            updateRedirectRules(tab.id, apps.app)
          } else {
            clearRedirectRules()
          }
        })
      })
    }
  })
}

main()
