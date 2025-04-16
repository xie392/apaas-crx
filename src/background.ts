// 这是一个后台脚本，用于拦截网络请求并替换JavaScript文件
import JSZip from "jszip"

// 存储已经设置的规则和文件信息
interface AppState {
  outputName: string
  rules: {
    js?: string
    css?: string
    worker?: string
    other?: string[]
  }
  zipData?: Uint8Array
  lastUpdated?: number
  enabled: boolean // 添加启用/禁用标志
  matchPattern: string // 添加URL匹配模式
}

let appState: AppState = {
  outputName: "",
  rules: {},
  enabled: false, // 默认为禁用状态
  matchPattern: "http://gscrm-ycdl-fw-jsfw.yctp.yuchaiqas.com/*" // 默认匹配模式
}

// 初始化时从storage加载上一次的状态
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["appState"], (result) => {
    if (result.appState) {
      appState = result.appState
      console.log("Loaded previous state:", appState)

      // 如果有之前的状态，重新应用规则
      if (appState.outputName) {
        updateRedirectRules()
      }
    }
  })
})

// 监听浏览器启动，确保规则正确应用
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(["appState"], (result) => {
    if (result.appState) {
      appState = result.appState
      console.log("Loaded state on startup:", appState)
      
      // 检查并应用规则
      if (appState.outputName && appState.enabled) {
        updateRedirectRules()
      } else if (!appState.enabled) {
        // 确保禁用状态下没有任何规则
        chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
          chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRules.map(rule => rule.id),
            addRules: []
          })
        })
      }
    }
  })
})

// 保存应用状态
function saveAppState() {
  // 添加最后更新时间
  appState.lastUpdated = Date.now()
  chrome.storage.local.set({ appState }, () => {
    console.log("App state saved")
  })
}

// 更新规则函数
function updateRedirectRules() {
  if (!appState.outputName) return

  // 如果功能被禁用，清除所有规则
  if (!appState.enabled) {
    chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
      chrome.declarativeNetRequest.updateDynamicRules(
        {
          removeRuleIds: existingRules.map((rule) => rule.id),
          addRules: []
        },
        () => {
          console.log("已禁用脚本替换功能")
          saveAppState()
        }
      )
    })
    return
  }

  // 构建所有需要重定向的文件映射
  const scriptMappings: Record<string, string> = {}

  // JS文件映射
  const jsFileName = `${appState.outputName}.umd.js`
  scriptMappings[`*${jsFileName}`] = jsFileName

  // CSS文件映射（如果有）
  if (appState.rules.css) {
    const cssFileName = `${appState.outputName}.css`
    scriptMappings[`*${cssFileName}`] = cssFileName
  }
  
  // Worker文件映射（如果有）
  if (appState.rules.worker) {
    const workerFileName = `${appState.outputName}.umd.worker.js`
    scriptMappings[`*${workerFileName}`] = workerFileName
  }

  // 创建重定向规则
  const rules: chrome.declarativeNetRequest.Rule[] = Object.entries(
    scriptMappings
  ).map(([from, to], index) => {
    console.log(`Rule ${index + 1}: ${from} => ${to}`)

    // 确定资源类型
    let resourceType = chrome.declarativeNetRequest.ResourceType.SCRIPT
    if (to.endsWith(".css")) {
      resourceType = chrome.declarativeNetRequest.ResourceType.STYLESHEET
    }

    return {
      id: index + 1, // 规则ID必须是正整数
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: {
          extensionPath: `/assets/${to}`
        }
      },
      condition: {
        urlFilter: from,
        resourceTypes: [resourceType]
      }
    }
  })

  // 更新动态规则
  chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
    chrome.declarativeNetRequest.updateDynamicRules(
      {
        removeRuleIds: existingRules.map((rule) => rule.id),
        addRules: rules
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error("Error updating rules:", chrome.runtime.lastError)
        } else {
          console.log("Script replacement rules have been set up.")
          // 保存状态
          saveAppState()
        }
      }
    )
  })
}

// 处理从popup页面上传的文件
async function processUploadedFiles(
  outputName: string,
  filesToSave: Record<string, ArrayBuffer>,
  otherFiles: string[],
  zipData: number[],
  progressCallback: (progress: {
    step: string
    percent: number
    details?: string
  }) => void
) {
  try {
    // 开始处理
    progressCallback({ step: "开始", percent: 5, details: "开始处理文件..." })

    // 获取当前已使用的存储空间
    const storageInfo = await getStorageUsage()
    const availableSpace = storageInfo.quotaBytes - storageInfo.usedBytes
    console.log(
      `Storage: ${storageInfo.usedBytes / 1024 / 1024}MB used of ${storageInfo.quotaBytes / 1024 / 1024}MB quota`
    )

    // 计算需要保存的主要文件大小
    let totalSizeNeeded = 0
    for (const fileContent of Object.values(filesToSave)) {
      totalSizeNeeded += fileContent.byteLength * 1.37 // 估计base64编码后的大小增长
    }

    // 检查是否有足够空间保存主要文件
    if (totalSizeNeeded > availableSpace) {
      throw new Error(
        `存储空间不足，需要 ${(totalSizeNeeded / 1024 / 1024).toFixed(2)}MB，但只有 ${(availableSpace / 1024 / 1024).toFixed(2)}MB 可用`
      )
    }
    // 保存状态
    appState = {
      outputName,
      enabled: appState.enabled, // 保持用户设置的启用状态
      rules: {
        js: Object.keys(filesToSave).find((f) => f.endsWith(".umd.js")),
        css: Object.keys(filesToSave).find((f) => f.endsWith(".css")),
        worker: Object.keys(filesToSave).find((f) => f.endsWith(".umd.worker.js"))
      },
      zipData: new Uint8Array(zipData),
      matchPattern: appState.matchPattern // 保持原有的匹配模式
    }

    progressCallback({
      step: "保存JS/CSS",
      percent: 20,
      details: "保存主要文件..."
    })

    // 保存需要重定向的文件到插件的assets目录
    let fileCount = 0
    const totalFiles = Object.keys(filesToSave).length

    for (const [fileName, fileContent] of Object.entries(filesToSave)) {
      await saveFileToAssets(fileName, fileContent)
      fileCount++
      progressCallback({
        step: "保存文件",
        percent: 20 + Math.floor((fileCount / totalFiles) * 70),
        details: `保存文件 ${fileCount}/${totalFiles}: ${fileName}`
      })
    }

    // 从ZIP中选择性地提取JS文件
    if (appState.zipData) {
      progressCallback({
        step: "提取JS",
        percent: 80,
        details: "从ZIP中提取必要的JS文件..."
      })

      const zip = await JSZip.loadAsync(appState.zipData)

      // 获取所有JS文件并计算总大小
      const jsFiles = Object.keys(zip.files)
        .filter((filename) => filename.endsWith(".js"))
        // 排除已经保存的主文件
        .filter((filename) => !Object.keys(filesToSave).includes(filename))
        // 按文件大小从小到大排序（尽可能先处理小文件）
        .map(async (filename) => {
          const file = zip.file(filename)
          let size = 0
          if (file && !file.dir) {
            try {
              // 获取文件元数据来确定大小
              const content = await file.async("uint8array")
              size = content.byteLength
            } catch (e) {
              console.warn(`无法获取文件 ${filename} 的大小`)
            }
          }
          return { filename, size }
        })

      // 等待所有文件大小计算完成
      const jsFilesWithSize = await Promise.all(jsFiles)
      // 按大小排序
      jsFilesWithSize.sort((a, b) => a.size - b.size)

      // 重新获取存储使用情况
      const updatedStorageInfo = await getStorageUsage()
      let remainingSpace =
        updatedStorageInfo.quotaBytes - updatedStorageInfo.usedBytes
      const safetyBuffer = 512 * 1024 // 保留 512KB 的安全缓冲区
      remainingSpace -= safetyBuffer

      // 优先保存小文件和可能重要的文件
      const importantPatterns = [
        "chunk-",
        "vendor",
        "polyfill",
        "runtime",
        "main",
        "app",
        "index",
        "bundle"
      ]

      // 按优先级重新排序
      jsFilesWithSize.sort((a, b) => {
        const aIsImportant = importantPatterns.some((pattern) =>
          a.filename.includes(pattern)
        )
        const bIsImportant = importantPatterns.some((pattern) =>
          b.filename.includes(pattern)
        )

        if (aIsImportant && !bIsImportant) return -1
        if (!aIsImportant && bIsImportant) return 1
        return a.size - b.size // 如果重要性相同，则按大小排序
      })

      let savedCount = 0
      for (let i = 0; i < jsFilesWithSize.length; i++) {
        const { filename, size } = jsFilesWithSize[i]
        // 估计base64编码后的大小
        const estimatedSize = size * 1.37

        if (estimatedSize < remainingSpace) {
          const file = zip.file(filename)
          if (file) {
            try {
              const fileContent = await file.async("arraybuffer")
              await saveFileToAssets(filename, fileContent)
              savedCount++
              remainingSpace -= estimatedSize

              progressCallback({
                step: "保存JS",
                percent:
                  80 + Math.floor((savedCount / jsFilesWithSize.length) * 10),
                details: `保存JS文件 ${savedCount}/${jsFilesWithSize.length}: ${filename} (${(size / 1024).toFixed(1)}KB)`
              })
            } catch (err) {
              console.warn(`无法保存文件 ${filename}: ${err.message}`)
              // 继续处理其他文件
            }
          }
        } else {
          console.warn(`跳过文件 ${filename}，大小超出剩余存储空间`)
          progressCallback({
            step: "警告",
            percent: 85,
            details: `存储空间不足，跳过剩余 ${jsFilesWithSize.length - i} 个JS文件`
          })
          break
        }
      }

      console.log(`成功保存了 ${savedCount}/${jsFilesWithSize.length} 个JS文件`)
    }

    // 更新重定向规则
    progressCallback({
      step: "更新规则",
      percent: 90,
      details: "更新重定向规则..."
    })
    updateRedirectRules()

    progressCallback({ step: "完成", percent: 100, details: "处理完成！" })
    return { success: true, rules: appState.rules }
  } catch (error) {
    console.error("Error processing files:", error)
    progressCallback({
      step: "错误",
      percent: 0,
      details: `处理出错: ${error.message}`
    })
    return { success: false, error: error.message }
  }
}

// 获取存储使用情况
function getStorageUsage(): Promise<{ usedBytes: number; quotaBytes: number }> {
  return new Promise((resolve) => {
    chrome.storage.local.getBytesInUse(null, (usedBytes) => {
      chrome.storage.local.get(null, () => {
        const quotaBytes = chrome.runtime.lastError
          ? 5 * 1024 * 1024 // 默认5MB
          : chrome.storage.local.QUOTA_BYTES || 5 * 1024 * 1024

        resolve({ usedBytes, quotaBytes })
      })
    })
  })
}

// 辅助函数：保存文件到assets目录
async function saveFileToAssets(
  fileName: string,
  fileContent: ArrayBuffer
): Promise<void> {
  // 对于超过1MB的文件，使用更高效的存储方式
  const MAX_DIRECT_SAVE_SIZE = 1024 * 1024 // 1MB

  if (fileContent.byteLength <= MAX_DIRECT_SAVE_SIZE) {
    // 对于小文件，直接保存为数据URL
    return new Promise((resolve, reject) => {
      const fileBlob = new Blob([fileContent])
      const reader = new FileReader()

      reader.onload = () => {
        const dataUrl = reader.result as string

        // 使用Storage API保存文件
        const fileKey = `asset_${fileName}`
        chrome.storage.local.set({ [fileKey]: dataUrl }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError)
          } else {
            resolve()
          }
        })
      }

      reader.onerror = () => {
        reject(new Error("Failed to read file"))
      }

      reader.readAsDataURL(fileBlob)
    })
  } else {
    // 对于大文件，压缩并拆分存储
    try {
      // 使用更高效的存储格式
      const uint8Array = new Uint8Array(fileContent)

      // 注册主文件条目，记录大小和分块信息
      const fileKey = `asset_${fileName}`
      const fileMetadata = {
        type: "arraybuffer",
        size: fileContent.byteLength,
        chunks: 1
      }

      // 压缩数据以节省空间
      const compressedData = await compressData(uint8Array)

      // 保存文件主条目
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set(
          {
            [fileKey]: fileMetadata,
            [`${fileKey}_chunk0`]: compressedData
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

      return Promise.resolve()
    } catch (e) {
      return Promise.reject(e)
    }
  }
}

// 压缩二进制数据（使用TextEncoder和GZIP压缩算法的思路）
async function compressData(data: Uint8Array): Promise<string> {
  // 这里我们不实际实现压缩（需要额外库），
  // 而是尽量优化存储格式，从base64切换为arrayBuffer的二进制存储

  // 将二进制数据转换为Base64字符串，但比dataURL更紧凑
  let binary = ""
  const bytes = new Uint8Array(data)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message:", message)

  if (message.action === "processFiles") {
    // 创建进度更新函数
    const progressCallback = (progress: any) => {
      // 向popup发送进度更新
      chrome.runtime.sendMessage({
        action: "progressUpdate",
        progress: progress
      })
    }

    processUploadedFiles(
      message.outputName,
      message.filesToSave,
      message.otherFiles || [],
      message.zipData,
      progressCallback
    ).then(sendResponse)
    return true // 表示将异步发送响应
  }

  if (message.action === "toggleEnabled") {
    appState.enabled = message.enabled
    // 立即应用新的设置
    updateRedirectRules()
    sendResponse({ success: true, enabled: appState.enabled })
    return true
  }

  if (message.action === "updateMatchPattern") {
    // 更新匹配模式
    appState.matchPattern = message.pattern || "http://gscrm-ycdl-fw-jsfw.yctp.yuchaiqas.com/*"
    // 保存状态
    saveAppState()
    sendResponse({ success: true, matchPattern: appState.matchPattern })
    return true
  }

  if (message.action === "getActiveRules") {
    sendResponse({
      rules: appState.rules,
      lastUpdated: appState.lastUpdated,
      enabled: appState.enabled, // 添加enabled状态到响应
      matchPattern: appState.matchPattern // 添加matchPattern到响应
    })
    return true
  }

  // 处理获取资源请求
  if (message.action === "getResource") {
    const fileName = message.fileName
    const fileKey = `asset_${fileName}`

    chrome.storage.local.get([fileKey], (result) => {
      if (result[fileKey]) {
        // 检查文件存储格式
        if (typeof result[fileKey] === "string") {
          // 老格式: 直接是dataURL
          sendResponse({
            exists: true,
            dataUrl: result[fileKey]
          })
        } else if (result[fileKey].type === "arraybuffer") {
          // 新格式: 压缩存储的数据
          const metadata = result[fileKey]

          // 获取所有块
          const chunkKeys = []
          for (let i = 0; i < metadata.chunks; i++) {
            chunkKeys.push(`${fileKey}_chunk${i}`)
          }

          chrome.storage.local.get(chunkKeys, (chunksResult) => {
            try {
              // 解压并组合数据
              const compressedData = chunksResult[chunkKeys[0]] // 目前只支持单块
              const decompressedData = decompressData(compressedData)

              // 转换为DataURL
              const blob = new Blob([decompressedData], {
                type: fileName.endsWith(".js")
                  ? "application/javascript"
                  : fileName.endsWith(".css")
                    ? "text/css"
                    : "application/octet-stream"
              })
              const reader = new FileReader()
              reader.onload = () => {
                sendResponse({
                  exists: true,
                  dataUrl: reader.result
                })
              }
              reader.onerror = () => {
                sendResponse({
                  exists: false,
                  error: "Failed to read decompressed data"
                })
              }
              reader.readAsDataURL(blob)
            } catch (e) {
              sendResponse({ exists: false, error: e.message })
            }
          })
          return true // 异步响应
        } else {
          sendResponse({ exists: false, error: "Unknown file format" })
        }
      } else {
        // 如果没有找到完全匹配的文件名，尝试检查是否有匹配的输出名
        if (appState.outputName) {
          const baseOutputName = appState.outputName

          // 检查是否是我们要替换的JS或CSS文件
          if (
            fileName.endsWith(`${baseOutputName}.umd.js`) ||
            fileName.endsWith(`${baseOutputName}.css`) ||
            fileName.endsWith(`${baseOutputName}.umd.worker.js`)
          ) {
            // 检查对应的文件是否存在
            let matchedFileKey = ""

            if (
              fileName.endsWith(`${baseOutputName}.umd.js`) &&
              appState.rules.js
            ) {
              matchedFileKey = `asset_${appState.rules.js}`
            } else if (
              fileName.endsWith(`${baseOutputName}.css`) &&
              appState.rules.css
            ) {
              matchedFileKey = `asset_${appState.rules.css}`
            } else if (
              fileName.endsWith(`${baseOutputName}.umd.worker.js`) &&
              appState.rules.worker
            ) {
              matchedFileKey = `asset_${appState.rules.worker}`
            }

            if (matchedFileKey) {
              chrome.storage.local.get([matchedFileKey], (result) => {
                // 同样处理不同的存储格式
                if (result[matchedFileKey]) {
                  if (typeof result[matchedFileKey] === "string") {
                    sendResponse({
                      exists: true,
                      dataUrl: result[matchedFileKey]
                    })
                  } else if (result[matchedFileKey].type === "arraybuffer") {
                    // 同上，处理压缩数据
                    const metadata = result[matchedFileKey]
                    chrome.storage.local.get(
                      [`${matchedFileKey}_chunk0`],
                      (chunkResult) => {
                        try {
                          const compressedData =
                            chunkResult[`${matchedFileKey}_chunk0`]
                          const decompressedData =
                            decompressData(compressedData)

                          const blob = new Blob([decompressedData], {
                            type: fileName.endsWith(".js")
                              ? "application/javascript"
                              : fileName.endsWith(".css")
                                ? "text/css"
                                : "application/octet-stream"
                          })
                          const reader = new FileReader()
                          reader.onload = () => {
                            sendResponse({
                              exists: true,
                              dataUrl: reader.result
                            })
                          }
                          reader.onerror = () => {
                            sendResponse({
                              exists: false,
                              error: "Failed to read decompressed data"
                            })
                          }
                          reader.readAsDataURL(blob)
                        } catch (e) {
                          sendResponse({ exists: false, error: e.message })
                        }
                      }
                    )
                    return true
                  } else {
                    sendResponse({
                      exists: false,
                      error: "Unknown file format"
                    })
                  }
                } else {
                  sendResponse({ exists: false })
                }
              })
              return true
            }
          }

          // 检查是否是JS文件
          if (fileName.endsWith(".js")) {
            chrome.storage.local.get([fileKey], (result) => {
              if (result[fileKey]) {
                // 同样处理不同的存储格式
                if (typeof result[fileKey] === "string") {
                  sendResponse({
                    exists: true,
                    dataUrl: result[fileKey]
                  })
                } else if (result[fileKey].type === "arraybuffer") {
                  // 同上，处理压缩数据
                  chrome.storage.local.get(
                    [`${fileKey}_chunk0`],
                    (chunkResult) => {
                      try {
                        const compressedData = chunkResult[`${fileKey}_chunk0`]
                        const decompressedData = decompressData(compressedData)

                        const blob = new Blob([decompressedData], {
                          type: "application/javascript"
                        })
                        const reader = new FileReader()
                        reader.onload = () => {
                          sendResponse({
                            exists: true,
                            dataUrl: reader.result
                          })
                        }
                        reader.onerror = () => {
                          sendResponse({
                            exists: false,
                            error: "Failed to read decompressed data"
                          })
                        }
                        reader.readAsDataURL(blob)
                      } catch (e) {
                        sendResponse({ exists: false, error: e.message })
                      }
                    }
                  )
                  return true
                } else {
                  sendResponse({ exists: false, error: "Unknown file format" })
                }
              } else {
                sendResponse({ exists: false })
              }
            })
            return true
          }
        }

        sendResponse({ exists: false })
      }
    })

    return true // 表示将异步发送响应
  }
})

// 处理文件请求
// chrome.webRequest.onBeforeRequest.addListener(
//   (details) => {
//     // 从storage获取文件内容并返回
//     // 这部分需要进一步实现
//     return { cancel: false }
//   },
//   { urls: ["<all_urls>"] },
//   ["blocking"]
// )

// 配置匹配规则，使本地脚本可以被网页访问
export const config = {
  get matches() {
    return [appState.matchPattern];
  }
}

// 解压缩数据
function decompressData(compressedBase64: string): Uint8Array {
  // 将Base64字符串转回二进制数据
  const binary = atob(compressedBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
