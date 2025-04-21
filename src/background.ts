import { APP_INIT } from "~lib/constants";
import { base64ToBlob, extractDomainFromPattern, urlMatchesPatterns } from "~lib/utils";
import { getApps } from "~services/storage";
import type { Application, Package } from "~types";

// 请求使用scripting API的权限
// chrome.permissions.contains({ permissions: ["scripting"] }, (hasPermission) => {
//   if (!hasPermission) {
//     console.error("扩展缺少scripting权限，无法注入脚本")
//   } else {
//     console.log("扩展已具有scripting权限")
//   }
// })

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background script received message:", request);
  
  // init
  if (request?.action === APP_INIT) {
    console.log(`Received APP_INIT request for URL: ${sender.url}`);
    
    init(sender.url)
      .then(apps => {
        console.log("URL matching result:", apps);
        if (apps.isPattern && apps.app) {
          try {
            updateRedirectRules(apps.app);
            console.log("Redirect rules updated successfully");
          } catch (error) {
            console.error("Error updating redirect rules:", error);
          }
        }
        sendResponse(apps);
      })
      .catch(error => {
        console.error("Error initializing:", error);
        sendResponse({ isPattern: false, app: null, error: error.message });
      });
    
    return true; // 保持消息通道开放以异步发送响应
  }
  
  return false; // 对于其他消息类型，不期待异步响应
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

/**
 * 更新 Chrome 扩展的重定向规则
 *
 * @param app Application 对象，包含应用配置信息
 * @description
 * 该函数根据应用配置更新 Chrome 扩展的动态重定向规则：
 * - 如果应用没有上传包，则直接返回
 * - 如果功能被禁用，清除所有现有规则
 * - 根据配置的 URL 模式和包文件创建新的重定向规则
 * - 支持 JS 和 CSS 文件的重定向
 * - 规则仅应用于指定域名范围
 *
 * @example
 * updateRedirectRules({
 *   enabled: true,
 *   urlPatterns: ['*://example.com/*'],
 *   packages: [...]
 * })
 */
function updateRedirectRules(app: Application) {
  // 如果没有上传任何包
  if (!app.packages.length) return

  // 如果功能被禁用，清除所有规则
  if (!app.enabled) {
    chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
      chrome.declarativeNetRequest.updateDynamicRules(
        {
          removeRuleIds: existingRules.map((rule) => rule.id),
          addRules: []
        },
        () => {
          console.log(`%c已禁用脚本替换功能`, "color: #f00")
        }
      )
    })
    return
  }

  // 从匹配模式中提取域名部分，用于更精确的匹配
  const domains = app.urlPatterns.map(extractDomainFromPattern)

  // 构建所有需要重定向的文件映射
  const scriptMappings: Record<string, string> = {}

  app.packages.forEach((pkg: Package) => {
    const jsFileName = pkg.config.outputName + ".umd.js"
    const cssFileName = pkg.config.outputName + ".css"
    if (pkg.files[jsFileName]) {
      const contentType = "application/javascript";
      scriptMappings[`*${jsFileName}`] = base64ToBlob(pkg.files[jsFileName], contentType);
    }
    if (pkg.files[cssFileName]) {
      const contentType = "text/css";
      scriptMappings[`*${cssFileName}`] = base64ToBlob(pkg.files[cssFileName], contentType);
    }
  })

  // 创建重定向规则
  const rules: chrome.declarativeNetRequest.Rule[] = Object.entries(
    scriptMappings
  ).map(([from, to], index) => {
    console.log(`Rule ${index + 1}: ${from} => ${to.substring(0, 50)}...`);
    // 确定资源类型
    let resourceType = chrome.declarativeNetRequest.ResourceType.SCRIPT;
    
    // 基于MIME类型判断资源类型
    if (to.includes("text/css")) {
      resourceType = chrome.declarativeNetRequest.ResourceType.STYLESHEET;
    }

    return {
      id: index + 1, // 规则ID必须是正整数
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: {
          url: to // 使用data:URL直接重定向
        }
      },
      condition: {
        // 添加域名限制，确保只匹配指定域名
        urlFilter: from,
        domains,
        resourceTypes: [resourceType]
      }
    }
  });

  // 更新动态规则
  chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
    console.log("现有规则数量:", existingRules.length);
    
    chrome.declarativeNetRequest.updateDynamicRules(
      {
        removeRuleIds: existingRules.map((rule) => rule.id),
        addRules: rules
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error("更新规则失败:", chrome.runtime.lastError);
        } else {
          console.log("资源替换规则已更新，规则数量:", rules.length);
          // 输出所有规则详情
          // rules.forEach((rule, index) => {
          //   console.log(`规则 ${index + 1}:`, {
          //     id: rule.id,
          //     urlFilter: rule.condition.urlFilter,
          //     resourceType: rule.condition.resourceTypes[0]
          //   });
          // });
        }
      }
    )
  });
}