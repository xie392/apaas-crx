import type { PlasmoCSConfig } from "plasmo"
import { LOG_PREFIX, MESSAGE_TYPES } from "./constants"
import { getFileNameFromUrl } from "./utils/url"

// 配置内容脚本的匹配规则
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

/**
 * 在页面加载时将URL处理函数注入到页面中
 */
function injectURLHandlerScript() {
  // 首先检查扩展是否启用，并且当前URL是否匹配配置的模式
  chrome.runtime.sendMessage(
    {
      action: "checkUrlAndEnabledState",
      currentUrl: window.location.href
    },
    (response) => {
      // 禁用时不用处理
      if (!response || !response.shouldInject) {
        console.log(`${LOG_PREFIX} 已禁用脚本替换功能`)
        return
      }

      // 如果扩展启用并且URL匹配，则注入脚本
      const script = document.createElement("script")
      script.src = chrome.runtime.getURL("url-handler.js")
      script.onload = () => {
        script.remove()
      }
      ;(document.head || document.documentElement).appendChild(script)
    }
  )
}

// 处理从页面发来的消息
window.addEventListener("message", async (event) => {
  // 我们只处理来自当前页面的消息
  if (event.source !== window) return

  const data = event.data
  if (!data || data.type !== MESSAGE_TYPES.CHECK_RESOURCE) return

  // 检查URL是否匹配我们保存的资源
  const url = data.url
  const fileName = getFileNameFromUrl(url)

  console.log(`${LOG_PREFIX} 收到资源检查请求:`, { url, fileName })

  // 向扩展背景页发送消息，查询是否有缓存的资源
  chrome.runtime.sendMessage(
    {
      action: "getResource",
      fileName,
      url: url // 包含URL用于模式匹配
    },
    (response) => {
      if (response && response.exists) {
        console.log(`${LOG_PREFIX} 找到替换资源:`, fileName)
        // 如果资源存在，我们向页面发送消息
        window.postMessage(
          {
            type: MESSAGE_TYPES.RESOURCE_RESPONSE,
            forUrl: url,
            replace: true,
            dataUrl: response.dataUrl
          },
          "*"
        )
      } else {
        console.log(`${LOG_PREFIX} 未找到替换资源:`, fileName)
        // 如果资源不存在，我们通知页面继续原始请求
        window.postMessage(
          {
            type: MESSAGE_TYPES.RESOURCE_RESPONSE,
            forUrl: url,
            replace: false
          },
          "*"
        )
      }
    }
  )
})

// 当DOM加载完成后执行脚本注入
document.addEventListener("DOMContentLoaded", injectURLHandlerScript)

// 立即执行脚本注入，以防DOMContentLoaded已经触发
if (
  document.readyState === "interactive" ||
  document.readyState === "complete"
) {
  injectURLHandlerScript()
}
