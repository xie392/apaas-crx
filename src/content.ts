import { type PlasmoCSConfig } from "plasmo"

import { APP_INIT } from "~lib/constants"
import { base64ToBlob } from "~lib/utils"
import type { Application } from "~types"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
  // run_at: "document_start"
}

// 发送消息判断是否需要开启替换资源
chrome.runtime.sendMessage(
  { action: APP_INIT },
  (response: { isPattern: boolean; app: Application }) => {
    if (response?.isPattern) {
      console.log(
        "%c=============================开启替换资源=============================",
        "color: #4285f4; font-size: 20px; padding: 10px;"
      )
      checkAndReplaceResources(response?.app)
    }
  }
)

/**
 * 检查并替换页面中的资源引用
 * 遍历页面中的 script 和 stylesheet 标签,查找并替换其中的资源路径
 * @param app Application 实例
 */
function checkAndReplaceResources(app: Application) {
  console.log("开始检查和替换资源...")
  const elements = document.querySelectorAll(
    'script[src], link[rel="stylesheet"]'
  )
  elements.forEach(async (el) => {
    const url = el.getAttribute("src") ?? el.getAttribute("href")
    if (url) {
      console.log(`检查资源: ${url}`)
      const { fileType, blob } = await findReplacement(url, app)
      if (blob) {
        console.log(`找到替换资源 (${fileType}): ${url}`)
        // 先从DOM中移除原始元素
        el.remove()

        // 使用不同方法处理不同类型资源
        if (fileType === "js") {
          try {
            // 将Blob转换为文本内容
            const jsContent = await blobToText(blob);
            console.log(`JS内容长度: ${jsContent.length} 字节`);
            
            // 使用消息传递给background脚本，请求注入脚本
            chrome.runtime.sendMessage({
              type: "INJECT_SCRIPT",
              jsContent: jsContent,
              originalUrl: url
            }, response => {
              if (response && response.success) {
                console.log(`脚本已通过扩展API注入: ${url}`);
              } else {
                console.error(`脚本注入失败: ${url}`, response?.error);
              }
            });
          } catch (error) {
            console.error("处理JS内容时出错:", error);
          }
        } else if (fileType === "css") {
          // CSS内容可以通过创建<style>标签注入
          try {
            const cssContent = await blobToText(blob);
            // 创建style标签
            const style = document.createElement("style");
            style.textContent = cssContent;
            style.setAttribute("data-apaas-replaced", "true");
            style.setAttribute("data-original-href", url);
            // 添加到文档中
            document.head.appendChild(style);
            console.log(`样式表已通过style标签注入: ${url}`);
          } catch (error) {
            console.error("处理CSS内容时出错:", error);
          }
        }
      } else {
        console.log(`没有找到替换资源: ${url}`)
      }
    }
  })
}

/**
 * 将Blob对象转换为文本
 * @param blob - Blob对象
 * @returns 返回文本内容的Promise
 */
function blobToText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error("无法读取Blob内容"));
    };
    reader.readAsText(blob);
  });
}

/**
 * 查找并返回指定 URL 对应的替换文件内容
 * @param url - 需要查找替换的文件 URL
 * @param app - 应用配置对象
 * @returns 返回包含文件类型和文件内容的对象
 *          fileType - 文件类型('js' | 'css')
 *          blob - 文件内容的 Blob 对象
 * @description
 * 该函数会解析传入的 URL,判断是否为 js 或 css 文件
 * 根据文件名在应用配置中查找对应的替换文件
 * 如果找到匹配的文件则返回转换后的 Blob 对象
 */
async function findReplacement(
  url: string,
  app: Application
): Promise<{
  fileType?: "js" | "css"
  blob?: Blob
}> {
  try {
    // 处理相对路径 URL
    let pathname: string
    let filename: string

    try {
      // 尝试解析完整 URL
      const urlObj = new URL(url)
      pathname = urlObj.pathname
      filename = pathname.split("/").pop() || ""
    } catch (error) {
      pathname = url
      // 移除查询参数
      const withoutQuery = url.split("?")[0]
      // 获取最后一部分作为文件名
      filename = withoutQuery.split("/").pop() || ""
    }

    // 检查是否是 JS 或 CSS 文件
    let fileType: "js" | "css" | undefined
    let blob: Blob | undefined

    if (filename.endsWith(".js")) {
      fileType = "js"
      const result = filename.replace(/.*\/([^\/]+)\.umd\.js$/, "$1")
      const file = app.packages.find(
        (item) => item.config.outputName + ".umd.js" === result
      )
      if (file && file?.files?.[result]) {
        console.log(
          `找到匹配包: ${file.name}, outputName: ${file.config.outputName}`
        )
        blob = base64ToBlob(file.files[result] as string)
      }
    } else if (filename.endsWith(".css")) {
      fileType = "css"
      const result = filename.replace(/.*\/([^\/]+)\.css$/, "$1")
      const file = app.packages.find(
        (item) => item.config.outputName + "css" === result
      )
      if (file && file?.files?.[result]) {
        console.log(
          `找到匹配包: ${file.name}, outputName: ${file.config.outputName}`
        )
        blob = base64ToBlob(file.files[result] as string)
      }
    }
    return {
      fileType,
      blob
    }
  } catch (error) {
    console.error("寻找替换时出错:", error)
    return {}
  }
}
