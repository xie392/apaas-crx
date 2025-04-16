/**
 * URL处理工具函数
 * 提供URL匹配和处理相关的功能
 */

import { DEFAULT_MATCH_PATTERN } from "../constants";

/**
 * 判断URL是否匹配指定的模式
 * @param url 需要检查的URL
 * @param pattern 匹配模式，支持通配符
 * @returns 是否匹配
 */
export function urlMatchesPattern(url: string, pattern: string = DEFAULT_MATCH_PATTERN): boolean {
  try {
    // 解析URL和模式为URL对象
    const urlObj = new URL(url);
    
    // 移除模式末尾的通配符，获取基本URL部分
    let basePattern = pattern;
    if (basePattern.endsWith('*')) {
      basePattern = basePattern.slice(0, -1);
    }
    
    if (basePattern.endsWith('/')) {
      basePattern = basePattern.slice(0, -1);
    }
    
    // 检查URL是否以模式开头
    const urlString = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`;
    
    // 标准化URL和模式（去掉协议开头的多余部分）
    const normalizedUrl = urlString.replace(/^https?:\/\//, '');
    const normalizedPattern = basePattern.replace(/^https?:\/\//, '');
    
    console.log(`比较URL: ${normalizedUrl} 与模式: ${normalizedPattern}`);
    
    return normalizedUrl.startsWith(normalizedPattern);
  } catch (e) {
    console.error("URL匹配错误:", e);
    return false;
  }
}

/**
 * 从URL中提取文件名
 * @param url URL字符串
 * @returns 提取的文件名
 */
export function getFileNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    const fileName = pathParts[pathParts.length - 1];
    return fileName;
  } catch (e) {
    // 如果URL解析失败，尝试使用正则表达式提取最后一部分
    const matches = url.match(/([^/]+)$/);
    return matches ? matches[1] : url;
  }
}

/**
 * 从匹配模式中提取域名
 * @param pattern URL匹配模式
 * @returns 提取的域名
 */
export function extractDomainFromPattern(pattern: string): string {
  try {
    let basePattern = pattern;
    // 移除末尾的通配符
    if (basePattern.endsWith('*')) {
      basePattern = basePattern.slice(0, -1);
    }
    
    if (basePattern.endsWith('/')) {
      basePattern = basePattern.slice(0, -1);
    }
    
    // 提取域名
    const patternUrl = new URL(basePattern);
    return patternUrl.hostname;
  } catch (e) {
    console.error("提取域名失败:", e);
    // 如果提取失败，使用原始匹配模式
    return pattern.replace(/^https?:\/\//, '').split('/')[0];
  }
}