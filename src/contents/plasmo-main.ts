import type { PlasmoCSConfig } from "plasmo"

import { APP_INIT, GET_FILE_LIST } from "~lib/constants"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start"
}

chrome.runtime.sendMessage({ action: APP_INIT })

let files: Record<string, string>

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === GET_FILE_LIST) {
    files = request.data
    console.log("files",files)
    // const dataUrls = request.data as Record<string, string>
    // const fileMap: Record<string, string> = {}
    // const promises = Object.entries(dataUrls).map(async ([path, dataUrl]) => {
    //   try {
    //     const res = await fetch(dataUrl)
    //     const blob = await res.blob()
    //     const blobUrl = URL.createObjectURL(blob)
    //     fileMap[path] = blobUrl
    //   } catch (err) {
    //     fileMap[path] = dataUrl
    //   }
    // })
    // Promise.allSettled(promises).then(() => {
    //   console.log("fileMap", fileMap)
    //   chrome.runtime.sendMessage({ action: GET_FILE_LIST, data: fileMap })
    // })
  }
  return false
})

// console.log("✅ 拦截脚本已注入，开始监听 DOM 变化...")

// // 创建一个 MutationObserver 实例
// const observer = new MutationObserver((mutations) => {
//   mutations.forEach((mutation) => {
//     // 遍历所有被添加的节点
//     mutation.addedNodes.forEach((node) => {
//       // 检查节点是否是一个 <script> 标签，并且具有 src 属性
//       if (node.nodeName === "SCRIPT") {
//         const script = node as HTMLScriptElement
//         console.log(`🔍 发现脚本: ${files}`)
//         //   // --- 在这里添加你的替换逻辑 ---
//         const targetScriptUrl = "apaas-custom-test"
//         const localScriptUrl = "http://localhost:5500/examples/replacemen.js"
//         if (script.src.includes(targetScriptUrl)) {
//           console.log(`🔄 将脚本 ${script.src} 替换为 ${localScriptUrl}`)
//           script.src = localScriptUrl
//         }
//       }
//     })
//   })
// })

// observer.observe(document.documentElement, {
//   childList: true,
//   subtree: true
// })

// window.addEventListener("load", () => {
//   observer.disconnect()
// })
