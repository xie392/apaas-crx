/**
 * 生成重定向规则
 * @param scriptMappings 脚本映射关系
 * @param domains 适用的域名列表
 * @returns 生成的规则
 */
export function generateRedirectRules(
  rulesNamme: string,
  domain: string
): chrome.declarativeNetRequest.Rule {
  return {
    id: Math.floor(Date.now() / 1000),
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: {
        transform: extractDomainFromPattern(domain)
      },
      responseHeaders: [
        {
          header: "Access-Control-Allow-Origin",
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value: "*"
        },
        {
          header: "Access-Control-Allow-Methods",
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value: "GET, POST, PUT, DELETE, OPTIONS"
        }
      ]
    },
    condition: {
      urlFilter: `*${rulesNamme}*`
    }
  }
}

/**
 * 生成 Data URL 重定向规则
 * @param urlPattern 要匹配的 URL 模式（文件路径）
 * @param dataUrl 重定向到的 Data URL
 * @param ruleId 规则 ID
 * @returns 生成的规则
 */
export function generateDataUrlRedirectRule(
  rulesNamme: string,
  domain: string,
  ruleId: number
): chrome.declarativeNetRequest.Rule {
  return {
    id: ruleId,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: {
        url: domain
      }
    },
    condition: {
      urlFilter: `*${rulesNamme}*`,
      resourceTypes: [
        chrome.declarativeNetRequest.ResourceType.SCRIPT,
        chrome.declarativeNetRequest.ResourceType.STYLESHEET,
        chrome.declarativeNetRequest.ResourceType.IMAGE,
        chrome.declarativeNetRequest.ResourceType.FONT
      ]
    }
  }
}

/**
 * 生成拦截规则
 * @param rulesNamme  规则名称
 * @param domains 适用的域名列表
 * @returns 生成的规则
 */
export function generateBlockRules(
  rulesNamme: string,
  domains: string[] = [],
  ruleId?: number
): chrome.declarativeNetRequest.Rule {
  return {
    id: ruleId ?? Math.floor(Date.now() / 1000),
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.BLOCK
    },
    condition: {
      urlFilter: `*${rulesNamme}`,
      domains
    }
  }
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
 * @param isBlock 是否是拦截规则
 */
export async function applyRules(
  outputName: string,
  domains: string
): Promise<void> {
  try {
    const rules = generateRedirectRules(outputName, domains)
    return await interceptRequest([generateRedirectRules(outputName, domains)])
  } catch (error) {
    console.error("应用网络请求拦截规则失败:", error)
    return error
  }
}

/**
 * 应用 Data URL 重定向规则
 * @param dataUrls 文件路径到 Data URL 的映射
 */
export async function applyDataUrlRedirectRules(
  packageName: string,
  dataUrls: Record<string, string>
): Promise<void> {
  try {
    const rules: chrome.declarativeNetRequest.Rule[] = []
    let ruleId = Math.floor(Date.now() / 1000)

    // 为每个文件创建重定向规则
    for (const [path, dataUrl] of Object.entries(dataUrls)) {
      rules.push(
        generateDataUrlRedirectRule(`${packageName}/${path}`, dataUrl, ruleId++)
      )
    }

    console.log(`创建 ${rules.length} 条重定向规则`, rules)
    await interceptRequest(rules)
  } catch (error) {
    console.error("应用网络请求拦截规则失败:", error)
    throw error
  }
}

/**
 * 提取域名
 * @param url
 * @returns {scheme: string, host: string, port: string}
 */
export function extractDomainFromPattern(pattern: string): {
  scheme: string
  host: string
  port: string
} {
  const url = new URL(pattern)
  return {
    scheme: url.protocol.replace(":", ""),
    host: url.hostname,
    port: url.port
  }
}
