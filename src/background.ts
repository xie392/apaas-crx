import { APP_INIT } from "~lib/constants"
import {
  base64ToBlob,
  extractDomainFromPattern,
  urlMatchesPatterns
} from "~lib/utils"
import { getApps } from "~services/storage"
import type { Application, Package } from "~types"

// 添加一个常量来定义最大允许的base64大小
const MAX_DATA_URL_SIZE = 1900000; // 约1.9MB，安全低于Chrome的2MB限制

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // init
  if (request?.action === APP_INIT) {
    init(sender.url)
      .then((apps) => {
        if (apps.isPattern && apps.app) {
          updateRedirectRules(apps.app)
        } else {
          clearRedirectRules()
        }
        sendResponse(apps.isPattern)
      })
      .catch((error) => {
        console.error("Error initializing:", error)
        sendResponse(false)
      })

    return true // 保持消息通道开放以异步发送响应
  }

  return false // 对于其他消息类型，不期待异步响应
})

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
 * 清除所有动态重定向规则
 *
 * 该函数会移除所有已存在的动态重定向规则,并在控制台打印提示信息
 */
function clearRedirectRules() {
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
  if (!app.enabled || !app) {
    clearRedirectRules()
    return
  }

  // 从匹配模式中提取域名部分，用于更精确的匹配
  const domains = app.urlPatterns.map(extractDomainFromPattern)

  // 构建所有需要重定向的文件映射
  const scriptMappings: Record<string, string> = {}
  const fileTypeMap: Record<string, string> = {}

  app.packages.forEach((pkg: Package) => {
    try {
      // 支持多种可能的文件名格式
      const jsFileNames = [
        pkg.config.outputName + ".umd.js",
        pkg.config.outputName + ".js",
        pkg.config.outputName + ".min.js"
      ];
      
      const cssFileNames = [
        pkg.config.outputName + ".css",
        pkg.config.outputName + ".min.css"
      ];
      
      // 处理JavaScript文件
      for (const jsFileName of jsFileNames) {
        if (pkg.files[jsFileName]) {
          console.log(`找到JavaScript文件: ${jsFileName}`);
          const contentType = "application/javascript";
          
          // 使用handleLargeFile处理文件，特别是大型文件
          const fileResult = handleLargeFile(pkg.files[jsFileName], jsFileName, contentType);
          
          // 使用更通用的URL过滤器
          const urlFilter = `*${jsFileName.replace('.', '\\.')}*`;
          scriptMappings[urlFilter] = fileResult.url;
          fileTypeMap[urlFilter] = "SCRIPT";
          console.log(`添加JS文件规则: ${urlFilter}`);
          
          // 添加不带路径的文件名规则
          const simpleFilter = `*${jsFileName}`;
          scriptMappings[simpleFilter] = fileResult.url;
          fileTypeMap[simpleFilter] = "SCRIPT";
          console.log(`添加JS简单规则: ${simpleFilter}`);
          
          // 如果是大文件，添加特殊处理
          if (fileResult.isLarge) {
            console.log(`${jsFileName} 是大文件，已使用替代存储方法`);
          }
          
          break; // 找到一个匹配的就停止
        }
      }
      
      // 处理CSS文件
      for (const cssFileName of cssFileNames) {
        if (pkg.files[cssFileName]) {
          console.log(`找到CSS文件: ${cssFileName}`);
          const contentType = "text/css";
          
          // 使用handleLargeFile处理文件，特别是大型文件
          const fileResult = handleLargeFile(pkg.files[cssFileName], cssFileName, contentType);
          
          // 使用更通用的URL过滤器
          const urlFilter = `*${cssFileName.replace('.', '\\.')}*`;
          scriptMappings[urlFilter] = fileResult.url;
          fileTypeMap[urlFilter] = "STYLESHEET";
          console.log(`添加CSS文件规则: ${urlFilter}`);
          
          // 添加不带路径的文件名规则
          const simpleFilter = `*${cssFileName}`;
          scriptMappings[simpleFilter] = fileResult.url;
          fileTypeMap[simpleFilter] = "STYLESHEET";
          console.log(`添加CSS简单规则: ${simpleFilter}`);
          
          // 如果是大文件，添加特殊处理
          if (fileResult.isLarge) {
            console.log(`${cssFileName} 是大文件，已使用替代存储方法`);
          }
          
          break; // 找到一个匹配的就停止
        }
      }
    } catch (error) {
      console.error(`处理包 ${pkg.name} 时出错:`, error);
    }
  })

  // 创建重定向规则
  const rules: chrome.declarativeNetRequest.Rule[] = Object.entries(
    scriptMappings
  ).map(([from, to], index) => {
    console.log(`Rule ${index + 1}: ${from} => ${to.substring(0, 50)}...`)
    // 确定资源类型
    let resourceType = chrome.declarativeNetRequest.ResourceType.SCRIPT

    // 基于MIME类型判断资源类型
    if (to.includes("text/css")) {
      resourceType = chrome.declarativeNetRequest.ResourceType.STYLESHEET
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
  })

  console.log("更新规则:", rules);
  
  // 更新动态规则
  chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
    console.log("现有规则数量:", existingRules.length)

    chrome.declarativeNetRequest.updateDynamicRules(
      {
        removeRuleIds: existingRules.map((rule) => rule.id),
        addRules: rules
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error("更新规则失败:", chrome.runtime.lastError)
        } else {
          console.log("资源替换规则已更新，规则数量:", rules.length)
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
  })
}

/**
 * 处理大文件，对于大型base64数据，将使用web_accessible_resources而不是直接数据URL
 * @param fileContent base64编码的文件内容
 * @param fileName 文件名
 * @param contentType 内容类型
 * @returns 处理后的URL和处理状态
 */
function handleLargeFile(fileContent: string, fileName: string, contentType: string): { url: string; isLarge: boolean } {
  if (!fileContent) {
    console.error(`文件内容为空: ${fileName}`);
    return { url: '', isLarge: false };
  }
  
  // 检查文件大小
  const contentSize = fileContent.length;
  console.log(`文件 ${fileName} 的大小: ${(contentSize / 1024 / 1024).toFixed(2)}MB`);
  
  // 如果文件较小，使用标准的data URL
  if (contentSize <= MAX_DATA_URL_SIZE) {
    return { 
      url: base64ToBlob(fileContent, contentType),
      isLarge: false 
    };
  }
  
  console.log(`文件 ${fileName} 太大(${(contentSize / 1024 / 1024).toFixed(2)}MB)，使用替代方法存储`);
  
  // 对于大文件，我们需要使用另一种方法
  try {
    // 方法1: 存储到扩展的存储区域，并创建一个后台脚本来动态提供内容
    const uniqueId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const storageKey = `large_file_${uniqueId}`;
    
    // 存储文件内容到扩展的存储区域
    chrome.storage.local.set({ [storageKey]: {
      content: fileContent,
      type: contentType,
      fileName: fileName
    }}, () => {
      if (chrome.runtime.lastError) {
        console.error(`存储大文件失败: ${chrome.runtime.lastError.message}`);
      } else {
        console.log(`大文件内容已存储在 ${storageKey}`);
      }
    });
    
    // 创建一个内部扩展URL，指向一个特殊的处理程序，该程序将检索并提供文件内容
    // 设置一个监听器来处理fetch请求
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request && request.action === 'FETCH_LARGE_FILE' && request.storageKey) {
        chrome.storage.local.get([request.storageKey], (result) => {
          if (chrome.runtime.lastError) {
            sendResponse({ 
              success: false, 
              error: chrome.runtime.lastError.message 
            });
          } else if (result[request.storageKey]) {
            sendResponse({ 
              success: true, 
              fileData: result[request.storageKey] 
            });
          } else {
            sendResponse({ 
              success: false, 
              error: '找不到文件数据' 
            });
          }
        });
        return true; // 保持异步响应通道打开
      }
      return false;
    });
    
    // 返回一个特殊的标识符URL，内容脚本将处理这种URL
    return {
      url: `chrome-extension-storage://${storageKey}`,
      isLarge: true
    };
  } catch (error) {
    console.error(`处理大文件失败: ${error}`);
    
    // 回退方法：截断数据URL
    console.warn(`将大文件截断到 ${MAX_DATA_URL_SIZE} 字节，可能导致不完整的资源`);
    return {
      url: base64ToBlob(fileContent.substring(0, MAX_DATA_URL_SIZE), contentType),
      isLarge: true
    };
  }
}
