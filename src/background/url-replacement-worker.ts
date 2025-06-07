import { SSEClient } from "~lib/sse-client"
import { splitFileNames } from "~lib/utils"
import { applyRules } from "~lib/rule-manager"
import { executeScript, executeStyle } from "~lib/resource-injector"
import type { Application } from "~types"

export async function injectResource(
  tabId: number,
  app: Application,
  domains: string[] = []
) {
  const devConfigs = app.devConfigs

  devConfigs.forEach(async (config) => {
    const { packageName, devUrl } = config
    applyRules(packageName, domains)
    executeScript(tabId, [`${devUrl}/${packageName}.umd.js`, packageName], false, true)
    executeStyle(tabId, [`${devUrl}/${packageName}.css`, packageName], false, false, true)

    const sseClient = new SSEClient(`${devUrl}/sse`)
    sseClient.onMessage((data) => {
      const { event, filePath } = data
      if (event === "change") {
        const { isJs, isCss } = splitFileNames(filePath)
        if (isJs) executeScript(tabId, [`${devUrl}/${packageName}.umd.js`, packageName], false, true)
        if (isCss) executeStyle(tabId, [`${devUrl}/${packageName}.css`, packageName], false, false, true)
      }
    })
    sseClient.onError((error) => {
      console.error(`【SSE错误 (${packageName})】：`, error)
    })
  })
}
