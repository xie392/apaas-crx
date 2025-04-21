import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * 检查给定的 URL 是否匹配指定的模式列表
 * @param url 需要检查的 URL 字符串
 * @param patterns 匹配模式字符串数组,支持通配符(*)
 * @returns 如果 URL 匹配任一模式则返回 true,否则返回 false
 * @example
 * urlMatchesPatterns('https://example.com', ['*.example.com']) // 返回 true
 * urlMatchesPatterns('https://test.com', ['*.example.com']) // 返回 false
 * urlMatchesPatterns('https://example.com', ['https://example.com/tt']) // 返回 true
 
 */
export function urlMatchesPatterns(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = new RegExp(pattern.replace(/\./g, "\\.").replace(/\*/g, ".*"))
    const matches = regex.test(url)
    return matches
  })
}

/**
 * 将Base64字符串转换为Blob对象，并返回可用于Chrome扩展的数据URL
 * @param base64Data 完整的Base64字符串（可包含data:前缀）
 * @param contentType MIME类型，默认为'application/javascript'
 * @returns 返回数据URL字符串
 */
export function base64ToBlob(
  base64Data: string,
  contentType: string = "application/javascript"
): string {
  if (!base64Data) throw new Error("Base64数据不能为空")
  try {
    // 判断是否已经是data:URL格式
    if (base64Data.startsWith('data:'))  return base64Data;
    // 不是data:URL格式，需要转换
    return `data:${contentType};base64,${base64Data}`;
  } catch (error) {
    throw new Error(
      `Base64转换失败: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * 从匹配模式中提取域名
 * @param pattern URL匹配模式
 * @returns 提取的域名
 */
export function extractDomainFromPattern(pattern: string): string {
  try {
    let basePattern = pattern
    // 移除末尾的通配符
    if (basePattern.endsWith("*")) {
      basePattern = basePattern.slice(0, -1)
    }

    if (basePattern.endsWith("/")) {
      basePattern = basePattern.slice(0, -1)
    }

    // 提取域名
    const patternUrl = new URL(basePattern)
    return patternUrl.hostname
  } catch (e) {
    console.error("提取域名失败:", e)
    // 如果提取失败，使用原始匹配模式
    return pattern.replace(/^https?:\/\//, "").split("/")[0]
  }
}
