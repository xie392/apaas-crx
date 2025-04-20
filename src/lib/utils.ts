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
 * 将Base64字符串转换为Blob对象
 * @param base64Data 完整的Base64字符串（可包含data:前缀）
 * @param contentType MIME类型，默认为'application/javascript'
 * @returns 返回Blob对象
 */
export function base64ToBlob(
  base64Data: string,
  contentType: string = "application/javascript"
): Blob {
  if (!base64Data) throw new Error("Base64数据不能为空")
  // 分离可能的data:前缀
  const base64WithoutPrefix = base64Data.split(",")[1] || base64Data

  try {
    const byteCharacters = atob(base64WithoutPrefix)
    const byteArrays: Uint8Array[] = []

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512)
      const byteNumbers = new Array(slice.length)

      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i)
      }

      byteArrays.push(new Uint8Array(byteNumbers))
    }

    return new Blob(byteArrays, { type: contentType })
  } catch (error) {
    throw new Error(
      `Base64转换失败: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
