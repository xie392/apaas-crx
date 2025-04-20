import { APP_INIT } from "~lib/constants"
import { urlMatchesPatterns } from "~lib/utils"

import { getApps } from "~services/storage"
import type { Application } from "~types"

// 请求使用scripting API的权限
chrome.permissions.contains({ permissions: ["scripting"] }, (hasPermission) => {
  if (!hasPermission) {
    console.error("扩展缺少scripting权限，无法注入脚本");
  } else {
    console.log("扩展已具有scripting权限");
  }
});

// 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 处理APP_INIT请求
  if (request?.action === APP_INIT) {
    init(sender.url).then(apps => {
      sendResponse(apps);
    }).catch(error => {
      console.error("初始化应用时出错:", error);
      sendResponse({ isPattern: false, app: null });
    });
    return true; // 异步响应
  }

  // 处理脚本注入请求
  if (request?.type === "INJECT_SCRIPT") {
    try {
      // 获取当前标签页ID
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({ success: false, error: "无法获取当前标签页" });
        return true;
      }
      
      console.log(`收到脚本注入请求，tabId: ${tabId}`);
      
      // 使用chrome.scripting API注入脚本
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        // 使用函数包装器避免CSP限制
        func: (scriptContent, originalUrl) => {
          try {
            console.log(`APaaS扩展: 注入脚本 (来自 ${originalUrl})`);
            // 使用eval执行脚本内容
            // 这里不受页面CSP限制，因为是扩展API注入的
            eval(scriptContent);
            console.log(`APaaS扩展: 脚本执行完成`);
            return { success: true };
          } catch (error) {
            console.error("APaaS扩展: 脚本执行出错", error);
            return { success: false, error: String(error) };
          }
        },
        args: [request.jsContent, request.originalUrl],
        // 确保在主世界执行，以便与页面JS环境交互
        world: "MAIN"
      }).then(results => {
        if (results && results[0]) {
          sendResponse(results[0].result || { success: true });
        } else {
          sendResponse({ success: false, error: "脚本注入未返回结果" });
        }
      }).catch(error => {
        console.error("执行脚本注入时出错:", error);
        sendResponse({ success: false, error: String(error) });
      });
      
      return true; // 异步响应
    } catch (error) {
      console.error("处理脚本注入请求时出错:", error);
      sendResponse({ success: false, error: String(error) });
      return true;
    }
  }
});

/**
 * 根据给定的 URL 初始化应用程序
 *
 * @param url - 需要匹配的 URL 字符串
 * @returns 返回一个包含匹配结果的对象
 *          - isPattern: 是否匹配成功
 *          - app: 匹配到的应用程序对象，如果未匹配则为 null
 */
async function init(
  url: string
): Promise<{ isPattern: boolean; app: Application }> {
  const apps = await getApps()
  let isPattern = false
  let newApp: Application = null
  for (const app of apps) {
    if (urlMatchesPatterns(url, app.urlPatterns) && app.enabled) {
      isPattern = true
      newApp = app
      break
    }
  }
  return {
    isPattern,
    app: newApp
  }
}
