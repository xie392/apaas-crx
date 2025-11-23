import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { getApps } from "~services/storage"
import type { Application } from "~types"

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

/**
 * 根据给定的URL匹配应用程序
 * @param url - 需要匹配的URL字符串
 * @returns 返回一个Promise,包含匹配结果对象
 *          isPattern: 是否匹配成功
 *          app: 匹配到的应用程序,未匹配则为null
 */
export async function matchApp(
  url: string
): Promise<{ isPattern: boolean; app: Application }> {
  const apps = await getApps()
  let isPattern = false
  let newApp: Application = null
  for (const app of apps) {
    if (urlMatchesPatterns(url, app.urlPatterns)) {
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
 * 分割文件名
 * @param fileName 文件名
 * @returns 文件名、文件类型、是否是js、是否是css、是否是worker
 */
export function splitFileNames(fileName: string): {
  name: string
  type: string
  isJs: boolean
  isCss: boolean
  isWorker: boolean
  isUmdJs: boolean
} {
  const fileNameArr = fileName.split(".")
  const name = fileNameArr?.shift()?.replace("*", "")
  const type = fileNameArr?.pop()
  const isJs = type === "js"
  const isCss = type === "css"
  const isWorker = fileName.includes("worker") && isJs
  const isUmdJs = isJs && !isWorker && fileNameArr?.slice(-2)?.includes("umd")
  return { name, type, isJs, isCss, isWorker, isUmdJs }
}

export function getFileSuffix(filePath: string) {
  return filePath?.split(".")?.pop()
}
