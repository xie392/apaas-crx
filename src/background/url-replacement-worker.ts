import { applyRules } from "~lib/rule-manager"
import { SSEClient } from "~lib/sse-client"
import type { Application, DevConfig } from "~types"

import { injectedScript, injectedStyle } from "./injected-helper"

interface ScriptMapping {
  args: {
    name: string
    isWorker: boolean
    isContent: boolean
    isDev: boolean
    content: string
  }
  func: typeof injectedScript | typeof injectedStyle
}

/**
 * 请求接口
 * @param url
 * @returns {Promise<any>}
 */
async function request(url: string): Promise<any> {
  const response = await fetch(url)
  return response.text()
}

/**
 * 生成脚本映射
 * @param config
 * @returns {ScriptMapping[]}
 */
async function generateScriptMappings(
  config: DevConfig
): Promise<ScriptMapping[]> {
  const { packageName, devUrl } = config
  const args = {
    name: packageName,
    isWorker: false,
    isContent: false,
    isDev: true
  }

  const js = `${devUrl}/${packageName}.umd.js`
  const css = `${devUrl}/${packageName}.css`
  const worker = `${devUrl}/${packageName}.worker.js`

  // fix: 25.11.06 由于浏览器安全策略 CORS private adress，请求本地私有网络的内容都会跨域，所以迁移到使用 background 请求
  return Promise.allSettled([request(js), request(css), request(worker)]).then(
    ([jsResult, cssResult, workerResult]) => {
      const scriptMappings: ScriptMapping[] = []

      // JS 和 CSS 是必需的
      if (jsResult.status === "fulfilled") {
        scriptMappings.push({
          args: { ...args, content: jsResult.value },
          func: injectedScript
        })
      }

      if (cssResult.status === "fulfilled") {
        scriptMappings.push({
          args: { ...args, content: cssResult.value },
          func: injectedStyle
        })
      }

      // Worker 是可选的
      if (workerResult.status === "fulfilled") {
        scriptMappings.push({
          args: { ...args, content: workerResult.value, isWorker: true },
          func: injectedScript
        })
      }

      return scriptMappings
    }
  )
}

/**
 * 执行数据
 * @param tabId
 * @param config
 */
async function executeData(tabId: number, config: DevConfig) {
  const scriptMappings = await generateScriptMappings(config)
  scriptMappings.forEach(({ func, args }) => {
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func,
      args: [args]
    })
  })
}

export async function injectResource(
  app: Application,
  // tabId: number,
  // domains: string[] = []
) {
  const devConfigs = app.devConfigs

  devConfigs.forEach(async (config) => {
    const { packageName, devUrl } = config
    applyRules(packageName, devUrl)
    // executeData(tabId, config)
    // const sseClient = new SSEClient(`${devUrl}/sse`)
    // sseClient.onMessage((data) => {
    //   const { event } = data
    //   if (event === "change") {
    //     executeData(tabId, config)
    //   }
    // })
    // sseClient.onError((error) => {
    //   console.error(`【SSE错误 (${packageName})】：`, error)
    // })
  })
}
