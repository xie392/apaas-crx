/**
 * 常量定义文件
 * 集中管理应用中使用的常量，避免重复定义
 */

// 默认的URL匹配模式
export const DEFAULT_MATCH_PATTERN = "http://gscrm-ycdl-fw-jsfw.yctp.yuchaiqas.com/*";

// 资源类型匹配模式
export const RESOURCE_PATTERNS = [
  '.umd.js',
  '.css',
  '.worker.js',
  'static/',
  'public/'
];

// 存储相关常量
export const STORAGE_CONSTANTS = {
  // 最大块大小 (1MB)
  MAX_CHUNK_SIZE: 1024 * 1024,
  // 安全缓冲区大小 (512KB)
  SAFETY_BUFFER: 512 * 1024,
  // 最大直接保存大小 (1MB)
  MAX_DIRECT_SAVE_SIZE: 1024 * 1024,
  // 默认存储配额 (5MB)
  DEFAULT_QUOTA: 5 * 1024 * 1024
};

// 日志前缀
export const LOG_PREFIX = '[APaaS]';

// 重要的JS文件模式
export const IMPORTANT_JS_PATTERNS = [
  "chunk-",
  "vendor",
  "polyfill",
  "runtime",
  "main",
  "app",
  "index",
  "bundle"
];

// 消息类型
export const MESSAGE_TYPES = {
  CHECK_RESOURCE: 'CHECK_RESOURCE',
  RESOURCE_RESPONSE: 'RESOURCE_RESPONSE'
};

// 超时设置
export const TIMEOUT_SETTINGS = {
  FETCH_TIMEOUT: 5000,
  XHR_TIMEOUT: 2000
};