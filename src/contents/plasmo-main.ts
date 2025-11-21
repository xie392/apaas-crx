import type { PlasmoCSConfig } from "plasmo"

import { APP_INIT, GET_FILE_LIST } from "~lib/constants"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start"
}

// 存储文件映射（路径 -> Blob URL）
let fileMap: Record<string, string> = {}

chrome.runtime.sendMessage({ action: APP_INIT })

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === GET_FILE_LIST) {
    const dataUrls = request.data as Record<string, string>

    // 将 Data URL 转为 Blob URL（在 content script 中可以使用 URL.createObjectURL）
    const promises = Object.entries(dataUrls).map(async ([path, dataUrl]) => {
      try {
        // 将 data URL 转为 blob
        const res = await fetch(dataUrl)
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        fileMap[path] = blobUrl
      } catch (err) {
        console.error(`转换 ${path} 失败:`, err)
        // 如果转换失败，直接使用 data URL
        fileMap[path] = dataUrl
      }
    })

    // 等待所有转换完成后再拦截
    Promise.allSettled(promises).then(() => {
      interceptPageResources()
      sendResponse({ success: true, message: "文件处理完成" })
    })

    return true // 异步响应
  }
  return true
})

/**
 * 拦截页面中的资源请求
 */
function interceptPageResources() {
  // 使用 MutationObserver 监听 DOM 变化
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      console.info("interceptPageResources", mutation)
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element

          // 拦截 script 标签
          if (element.tagName === "SCRIPT") {
            console.info("(element.tagName", element.tagName)
            const script = element as HTMLScriptElement
            const src = script.src
            if (src) {
              // 检查是否需要替换
              for (const [path, blobUrl] of Object.entries(fileMap)) {
                if (src.includes(path)) {
                  console.log(`拦截并替换 script: ${path}`)
                  script.src = blobUrl
                  break
                }
              }
            }
          }

          // 拦截 link 标签
          if (element.tagName === "LINK") {
            const link = element as HTMLLinkElement
            const href = link.href
            if (href && link.rel === "stylesheet") {
              // 检查是否需要替换
              for (const [path, blobUrl] of Object.entries(fileMap)) {
                if (href.includes(path)) {
                  console.log(`拦截并替换 stylesheet: ${path}`)
                  link.href = blobUrl
                  break
                }
              }
            }
          }
        }
      })
    })
  })

  // 开始监听
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  })

  console.log("开始监听页面资源加载")
}
