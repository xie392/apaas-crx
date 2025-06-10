import { applyRules } from "~lib/rule-manager"
import { SSEClient } from "~lib/sse-client"
import type { Application, DevConfig } from "~types"

import { injectedScript, injectedStyle } from "./injected-helper"

interface ScriptMapping {
  args: {
    url: string
    name: string
    isWorker: boolean
    isContent: boolean
    isDev: boolean
  }
  func: typeof injectedScript | typeof injectedStyle
}

/**
 * 生成脚本映射
 * @param config
 * @returns {ScriptMapping[]}
 */
function generateScriptMappings(config: DevConfig): ScriptMapping[] {
  const { packageName, devUrl } = config
  const args = {
    name: packageName,
    isWorker: false,
    isContent: false,
    isDev: true
  }
  const scriptMappings: ScriptMapping[] = [
    {
      args: { ...args, url: `${devUrl}/${packageName}.umd.js` },
      func: injectedScript
    },
    {
      args: { ...args, url: `${devUrl}/${packageName}.css` },
      func: injectedStyle
    },
    {
      args: {
        ...args,
        url: `${devUrl}/${packageName}.worker.js`,
        isWorker: true
      },
      func: injectedScript
    }
  ]

  return scriptMappings
}

/**
 * 执行数据
 * @param tabId    
 * @param config 
 */
function executeData(tabId: number, config: DevConfig) {
  generateScriptMappings(config).forEach(({ func, args }) => {
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func,
      args: [args]
    })
  })
}

export async function injectResource(
  tabId: number,
  app: Application,
  domains: string[] = []
) {
  const devConfigs = app.devConfigs

  devConfigs.forEach(async (config) => {
    const { packageName, devUrl } = config
    applyRules(packageName, domains)
    executeData(tabId, config)

    const sseClient = new SSEClient(`${devUrl}/sse`)
    sseClient.onMessage((data) => {
      const { event } = data
      if (event === "change") {
        executeData(tabId, config)
      }
    })
    sseClient.onError((error) => {
      console.error(`【SSE错误 (${packageName})】：`, error)
    })
  })
}
