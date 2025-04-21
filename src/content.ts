import { type PlasmoCSConfig } from "plasmo"

import { APP_INIT } from "~lib/constants"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

// 发送消息判断是否需要开启替换资源
chrome.runtime.sendMessage({ action: APP_INIT }, (response: boolean) => {
  if (response) {
    console.log(
      "%c[APaaS资源拦截器] 开启替换资源",
      "color: #4285f4; font-size: 20px; padding: 10px;"
    )
    checkPageResources()
  } else {
    console.log("[APaaS资源拦截器] 当前页面没有匹配的应用或未启用")
  }
})

// 执行页面资源检查
function checkPageResources() {
  console.log("%c[APaaS资源拦截器] 开始检查页面资源", "color: #4285f4;")
  // 检查脚本资源
  const scripts = document.querySelectorAll("script[src]")
  console.log(`[APaaS资源拦截器] 页面中有 ${scripts.length} 个脚本资源:`)
  // 检查样式表资源
  const stylesheets = document.querySelectorAll('link[rel="stylesheet"]')
  console.log(`[APaaS资源拦截器] 页面中有 ${stylesheets.length} 个样式表资源:`)

  console.log("%c[APaaS资源拦截器] 页面资源检查完成", "color: #4285f4;")
}
