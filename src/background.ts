// 处理文件请求
chrome.webRequest.onBeforeRequest.addListener((details) => {
  
})

// 配置匹配规则，使本地脚本可以被网页访问
export const config = {
  matches: ["http://gscrm-ycdl-fw-jsfw.yctp.yuchaiqas.com/*", "<all_urls>"]
}
