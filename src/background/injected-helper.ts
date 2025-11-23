import { generateRedirectRules, interceptRequest } from "~lib/rule-manager"
import { splitFileNames } from "~lib/utils"
import type { Application } from "~types"

declare global {
  interface Window {
    vue: any
  }
}

interface InjectedScriptOptions {
  name: string
  content: string
}

interface InjectedStyleOptions {
  name: string
  content: string
}

/**
 * 插入脚本到页面
 * @param options - 脚本配置选项
 * @param options.content - 脚本内容
 * @param options.name - 包名称
 */
export async function injectedScript({
  content,
  name
}: InjectedScriptOptions): Promise<void> {
  // 移除旧的脚本
  const oldScript = document.getElementById(`${name}-script`)
  if (oldScript) oldScript.remove()

  // 创建新的脚本元素
  const blob = new Blob([content], { type: "text/javascript" })
  const scriptUrl = URL.createObjectURL(blob)
  const script = document.createElement("script")
  script.src = scriptUrl
  script.id = `${name}-script`
  document.body.appendChild(script)
  script.onload = () => {
    const plugin = window[name]
    if (window?.vue && plugin) {
      // 手动安装插件
      // TODO: 开发模式下热更新
      plugin?.default?.install(window.vue)
      console.info(`%c【APaaS扩展】: ${name} 已更新`, "color: #007bff")
    }
  }
}

/**
 * 插入样式到页面
 * @param options - 样式配置选项
 * @param options.content - 样式内容
 * @param options.name - 包名称
 */
export async function injectedStyle({
  content,
  name
}: InjectedStyleOptions): Promise<void> {
  const oldStyle = document.getElementById(`${name}-style`)
  if (oldStyle) oldStyle.remove()

  const blob = new Blob([content], { type: "text/css" })
  const styleUrl = URL.createObjectURL(blob)
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = styleUrl
  link.id = `${name}-style`
  document.head.appendChild(link)

  console.info(`%c【APaaS扩展】: ${name} 样式已更新`, "color: #28a745")
}

/**
 * 使用 eval 动态注入脚本到页面中
 * @param tabId - 当前标签页 ID
 * @param fileName - 脚本文件名
 * @param buffer - 脚本内容的 ArrayBuffer
 */
export function injectScriptWithEval(
  tabId: number,
  fileName: string,
  buffer: ArrayBuffer
) {
  const decoder = new TextDecoder("utf-8")
  const content = decoder.decode(buffer)
  const { isCss, isUmdJs, name } = splitFileNames(fileName)

  // 注入 umd.js 和 worker.js
  if (isUmdJs) {
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: injectedScript,
      args: [{ content, name }]
    })
  }

  // 注入 css
  if (isCss) {
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: injectedStyle,
      args: [{ content, name }]
    })
  }
}

/**
 * 注入开发环境资源
 * @param tabId 标签页ID
 * @param app 应用配置
 */
export async function injectResource(
  tabId: number,
  app: Application
): Promise<void> {
  const devConfigs = app.devConfigs

  devConfigs.forEach(async (config) => {
    const { packageName, devUrl } = config
    const rule = generateRedirectRules(packageName, devUrl)
    await interceptRequest([rule]).then(() => {
      chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: (packageName) => {
          console.info(
            `%c【APaaS扩展】: ${packageName} 已更新`,
            "color: #007bff"
          )
        },
        args: [packageName]
      })
      // sse 链接
    })
  })
}
