/**
 * URL替换的Service Worker
 * 用于拦截请求并替换URL
 */

import { Storage } from "@plasmohq/storage"

import { URL_REPLACEMENTS_STORAGE_KEY, URL_REPLACEMENT_UPDATED } from "~lib/constants"
import type { UrlReplacement } from "~types"

console.log("url-replacement-worker running");


const storage = new Storage()

/**
 * 获取所有启用的URL替换规则
 */
async function getEnabledUrlReplacements(): Promise<UrlReplacement[]> {
  const replacements = await storage.get<UrlReplacement[]>(URL_REPLACEMENTS_STORAGE_KEY)
  return replacements?.filter(r => r.enabled) || []
}

/**
 * 更新URL替换规则
 */
export async function updateUrlReplacementRules() {
  const enabledReplacements = await getEnabledUrlReplacements()
  
  // 先清除所有现有规则
  chrome.declarativeNetRequest.getDynamicRules(existingRules => {
    // 获取与URL替换相关的规则ID（我们使用10000以上的ID作为URL替换规则）
    const urlReplacementRuleIds = existingRules
      .filter(rule => rule.id >= 10000)
      .map(rule => rule.id)
    
    // 创建新规则
    const newRules = enabledReplacements.map((replacement, index) => {
      return {
        id: 10000 + index, // 使用10000以上的ID避免与其他规则冲突
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
          redirect: {
            url: replacement.targetUrl
          }
        },
        condition: {
          urlFilter: replacement.sourceUrl,
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
            chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
            chrome.declarativeNetRequest.ResourceType.WEBSOCKET,
            chrome.declarativeNetRequest.ResourceType.OTHER
          ]
        }
      }
    })
    
    // 更新规则
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: urlReplacementRuleIds,
      addRules: newRules
    }, () => {
      console.log(`已更新URL替换规则，共${newRules.length}条`)
      
      // 通知popup更新
      chrome.runtime.sendMessage({
        action: URL_REPLACEMENT_UPDATED,
        replacements: enabledReplacements
      })
    })
  })
}

// 监听存储变化，当URL替换配置更新时，更新规则
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[URL_REPLACEMENTS_STORAGE_KEY]) {
    updateUrlReplacementRules()
  }
})

// 初始化时更新规则
updateUrlReplacementRules()