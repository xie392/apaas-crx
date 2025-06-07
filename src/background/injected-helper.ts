import { injectScript, injectStyle } from "~lib/resource-injector"

declare global {
  interface Window {
    vue: any
  }
}

export async function injectedScriptHelper(
  fileName: string,
  isWorker: boolean,
  content: string
) {
  // 如果不是worker文件，使用封装的注入函数
  if (!isWorker) {
    await injectScript(content, fileName, true)
    return
  }
  
  // worker文件特殊处理
  const blob = new Blob([content], { type: "text/javascript" })
  const url = URL.createObjectURL(blob)
  const script = document.createElement("script")
  script.src = url
  document.body.appendChild(script)
}

export async function injectedCssHelper(content: string) {
  // 使用封装的样式注入函数，传入一个通用名称
  await injectStyle(content, "injected-css", true, true)
}
