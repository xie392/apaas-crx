/**
 * 生成重定向规则
 * @param rulesName 规则名称
 * @param domain 域名
 * @returns 生成的规则
 */
export function generateRedirectRules(
  rulesName: string,
  domain: string
): chrome.declarativeNetRequest.Rule {
  return {
    id: Math.floor(Date.now() / 1000),
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
      redirect: {
        transform: extractDomainPattern(domain)
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
      urlFilter: `*${rulesName}*`
    }
  }
}

/**
 * 生成拦截规则
 * @param rulesName 规则名称
 * @param domains 适用的域名列表
 * @param ruleId 规则ID（可选）
 * @returns 生成的规则
 */
export function generateBlockRules(
  rulesName: string,
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
      urlFilter: `*${rulesName}`,
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
 * 提取域名
 * @param pattern URL模式
 * @returns 包含scheme、host和port的对象
 */
export function extractDomainPattern(pattern: string): {
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
