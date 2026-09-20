import type { PlasmoCSConfig } from "plasmo"

import { APP_INIT, DEV_FILE_CHANGED, GET_DEV_CONFIGS } from "~lib/constants"
import { SSEClient } from "~lib/sse-client"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start"
}

chrome.runtime.sendMessage({ action: APP_INIT })

chrome.runtime.sendMessage({ action: GET_DEV_CONFIGS }, (res) => {
  if (!res?.devConfigs?.length) return

  // 防抖：服务端已合并推送，这里兜底确保一次构建只触发一次重注入
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  res.devConfigs.forEach(({ packageName, devUrl }) => {
    const sseClient = new SSEClient(`${devUrl}/sse`)
    sseClient.onMessage(({ event, filePath }) => {
      if (event !== "change") return
      clearTimeout(timers.get(packageName))
      timers.set(
        packageName,
        setTimeout(() => {
          console.info(
            `%c【APaaS扩展】${packageName} 变更: ${filePath}`,
            "color: #007bff"
          )
          chrome.runtime.sendMessage({ action: DEV_FILE_CHANGED, packageName })
        }, 300)
      )
    })
    sseClient.onError((error) => {
      console.warn(`【SSE错误 (${packageName})】：`, error)
    })
  })
})
