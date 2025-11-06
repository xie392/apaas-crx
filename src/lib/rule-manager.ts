/**
 * 生成重定向规则
 * @param scriptMappings 脚本映射关系
 * @param domains 适用的域名列表
 * @returns 生成的规则数组
 */
export function generateRules(
  scriptMappings: Record<string, string>,
  domains: string[] = []
): chrome.declarativeNetRequest.Rule[] {
  return Object.entries(scriptMappings).map(([fileName], index) => {
    return {
      id: index + 1, // 规则ID必须是正整数
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.BLOCK
      },
      condition: {
        urlFilter: fileName,
        domains,
        resourceTypes: [
          chrome.declarativeNetRequest.ResourceType.SCRIPT,
          chrome.declarativeNetRequest.ResourceType.STYLESHEET
        ]
      }
    }
  })
}

/**
 * 应用拦截规则
 * @param rules 要应用的规则数组
 * @returns Promise
 */
export async function interceptRequest(
  rules: chrome.declarativeNetRequest.Rule[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
        const existingRuleIds = existingRules.map((rule) => rule.id)
        chrome.declarativeNetRequest.updateDynamicRules(
          {
            removeRuleIds: existingRuleIds,
            addRules: rules
          },
          () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError)
            } else {
              resolve()
            }
          }
        )
      })
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * 清除所有动态重定向规则
 * @returns Promise
 */
export async function clearRedirectRules(): Promise<void> {
  console.log(`%c清除所有动态重定向规则`, "color: #f00")
  return new Promise((resolve, reject) => {
    try {
      chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
        chrome.declarativeNetRequest.updateDynamicRules(
          {
            removeRuleIds: existingRules.map((rule) => rule.id),
            addRules: []
          },
          () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError)
            } else {
              console.log(`%c已禁用脚本替换功能`, "color: #f00")
              resolve()
            }
          }
        )
      })
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * 应用规则到指定的包名和域名
 * @param outputName 输出名称
 * @param domains 适用的域名列表
 */
export async function applyRules(
  outputName: string,
  domains: string[] = []
): Promise<void> {
  try {
    const jsFileName = outputName + ".umd.js"
    const cssFileName = outputName + ".css"
    const wookerFileName = outputName + ".umd.worker.js"

    const scriptMappings: Record<string, string> = {
      [`*${jsFileName}`]: jsFileName,
      [`*${cssFileName}`]: cssFileName,
      [`*${wookerFileName}`]: wookerFileName
    }

    const rules = generateRules(scriptMappings, domains)
    await interceptRequest(rules)
  } catch (error) {
    console.error("应用网络请求拦截规则失败:", error)
  }
}
