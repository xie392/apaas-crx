import { SSEClient } from "~lib/sse-client"
import { generateRules, interceptRequest, splitFileNames } from "~lib/utils"

async function applyRules(outputName: string = "") {
  try {
    // const domains = app.urlPatterns.map(extractDomainFromPattern)
    const jsFileName = outputName + ".umd.js"
    const cssFileName = outputName + ".css"
    const wookerFileName = outputName + ".umd.worker.js"

    const scriptMappings: Record<string, string> = {
      [`*${jsFileName}`]: jsFileName,
      [`*${cssFileName}`]: cssFileName,
      [`*${wookerFileName}`]: wookerFileName
    }
    const rules = generateRules(scriptMappings)
    await interceptRequest(rules)
  } catch (error) {
    console.error("应用网络请求拦截规则失败:", error)
  }
}

async function replaceUrl(url: string, name: string) {
  console.log("【开始插入】：", url)
  const oldScript = document.getElementById(name)
  if (oldScript) oldScript.remove()
  const content = await fetch(url).then((res) => res.text())
  const blob = new Blob([content], { type: "text/javascript" })
  const blobUrl = URL.createObjectURL(blob)
  const script = document.createElement("script")
  script.src = blobUrl
  script.id = name
  document.body.appendChild(script)
  script.onload = () => {
    const plugin = window[name]
    if (window?.vue && plugin) {
      plugin?.default?.install(window.vue, {})
      console.info(`%c【APaaS扩展】: ${name} 已更新`, "color: #007bff")
    }
  }
}

function executeScript(tabId: number, args: any[]) {
  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: replaceUrl,
    args
  })
}

// function executeStyle(tabId:number) {
//   chrome.scripting.executeScript({
//     target: { tabId },
//     world: "MAIN",
//     func: ,
//   })
// }

//监听标签页更新事件
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.includes("https://crm-fw.yuchaiqas.com")
  ) {
    applyRules()

    const url = "http://127.0.0.1:3000/apaas-custom-test.umd.js"

    executeScript(tabId, [url, "apaas-custom-test"])

    const sseClient = new SSEClient("http://127.0.0.1:3000/sse")
    sseClient.onMessage((data) => {
      const { event, filePath } = data
      if (event === "change") {
        const { isJs } = splitFileNames(filePath)
        if (isJs) {
          executeScript(tabId, [url, "apaas-custom-test"])
        }
        // if (isCss) {
        //   executeStyle(tabId)
        // }
      }
    })
    sseClient.onError((error) => {
      console.error("【SSE错误】：", error)
    })
  }
})
