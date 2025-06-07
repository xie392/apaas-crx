import { SSEClient } from "~lib/sse-client"
import { generateRules, interceptRequest, splitFileNames } from "~lib/utils"
import type { Application } from "~types"

async function applyRules(outputName: string, domains: string[] = []) {
  try {
    const jsFileName = outputName + ".umd.js"
    const cssFileName = outputName + ".css"
    const wookerFileName = outputName + ".umd.worker.js"

    const scriptMappings: Record<string, string> = {
      [`*${jsFileName}`]: jsFileName,
      [`*${cssFileName}`]: cssFileName,
      [`*${wookerFileName}`]: wookerFileName
    }
    const rules = generateRules(scriptMappings, domains)
    await interceptRequest(rules)
  } catch (error) {
    console.error("应用网络请求拦截规则失败:", error)
  }
}

async function replaceUrl(url: string, name: string) {
  const oldScript = document.getElementById(`${name}-script`)
  if (oldScript) oldScript.remove()
  const content = await fetch(url).then((res) => res.text())
  const blob = new Blob([content], { type: "text/javascript" })
  const blobUrl = URL.createObjectURL(blob)
  const script = document.createElement("script")
  script.src = blobUrl
  script.id = `${name}-script`
  document.body.appendChild(script)
  script.onload = () => {
    const plugin = window[name]
    if (window?.vue && plugin) {
      plugin?.default?.install(window.vue, {})
      console.info(`%c【APaaS扩展】: ${name} 已更新`, "color: #007bff")
    }
  }
}

async function replaceStyle(url: string, name: string) {
  const oldStyle = document.getElementById(`${name}-style`)
  if (oldStyle) oldStyle.remove()

  const content = await fetch(url).then((res) => res.text())
  const style = document.createElement("style")
  style.id = `${name}-style`
  style.textContent = content
  document.head.appendChild(style)
  console.info(`%c【APaaS扩展】: ${name} 样式已更新`, "color: #28a745")
}

function executeScript(tabId: number, args: any[]) {
  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: replaceUrl,
    args
  })
}

function executeStyle(tabId: number, args: any[]) {
  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: replaceStyle,
    args
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
    executeScript(tabId, [`${devUrl}/${packageName}.umd.js`, packageName])
    executeStyle(tabId, [`${devUrl}/${packageName}.css`, packageName])

    const sseClient = new SSEClient(`${devUrl}/sse`)
    sseClient.onMessage((data) => {
      const { event, filePath } = data
      if (event === "change") {
        const { isJs, isCss } = splitFileNames(filePath)
        if (isJs) executeScript(tabId, [devUrl, packageName])
        if (isCss) executeStyle(tabId, [devUrl, packageName])
      }
    })
    sseClient.onError((error) => {
      console.error(`【SSE错误 (${packageName})】：`, error)
    })
  })
}
