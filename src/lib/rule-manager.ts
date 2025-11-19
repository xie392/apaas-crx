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
      }
    },
    condition: {
      urlFilter: `*${rulesNamme}*`
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
  domains: string[] = []
): chrome.declarativeNetRequest.Rule {
  return {
    id: Math.floor(Date.now() / 1000),
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.BLOCK
    },
    condition: {
      urlFilter: `*${rulesNamme}*`,
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
              console.log(
                `%c已启用脚本替换功能, 替换 url：${rules.map((v) => v.action.redirect).toString()}`,
                "color: #f00"
              )
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
  domains: string | string[],
  isBlock: boolean = false
): Promise<void> {
  try {
    const rules = isBlock
      ? generateBlockRules(outputName, domains as string[])
      : generateRedirectRules(outputName, domains as string)
    await interceptRequest([rules])
  } catch (error) {
    console.error("应用网络请求拦截规则失败:", error)
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
