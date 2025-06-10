declare global {
  interface Window {
    vue: any
  }
}

interface injectedScriptOptions {
  url: string
  name: string
  isWorker?: boolean
  isContent?: boolean
  isDev?: boolean
}

interface injectedStyleOptions
  extends Omit<injectedScriptOptions, "isWorker"> {}

/**
 * 插入脚本到页面
 * @param {injectedScriptOptions} injectedScriptOptions
 * @param {string}    injectedScriptOptions.url       脚本URL或内容
 * @param {string}    injectedScriptOptions.name      包名称
 * @param {boolean}   injectedScriptOptions.isWorker  是否为Web Worker脚本
 * @param {boolean}   injectedScriptOptions.isContent 是否直接传入内容而非URL
 * @param {boolean}   injectedScriptOptions.isDev     是否为开发环境
 * @returns {Promise<void>}
 */
export async function injectedScript({
  url,
  name,
  isWorker,
  isContent,
  isDev
}: injectedScriptOptions) {
  // 移除旧的脚本
  const oldScript = document.getElementById(`${name}-script`)
  if (oldScript) oldScript.remove()

  let scriptUrl = url
  let content = url

  // 开发环境下总是需要获取内容
  if (isDev && !isContent) {
    content = await fetch(url).then((res) => res.text())
  }

  // 创建新的脚本元素
  const blob = new Blob([content], { type: "text/javascript" })
  scriptUrl = URL.createObjectURL(blob)
  const script = document.createElement("script")
  script.src = scriptUrl
  script.id = `${name}-script`
  document.body.appendChild(script)

  script.onload = () => {
    const plugin = window[name]
    if (window?.vue && plugin && !isWorker) {
      // 手动安装插件
      // TODO: 开发模式下热更新
      plugin?.default?.install(window.vue)
      console.info(`%c【APaaS扩展】: ${name} 已更新`, "color: #007bff")
    }
  }
}

/**
 * 插入样式到页面
 * @param {injectedStyleOptions} injectedStyleOptions
 * @param {string}    injectedStyleOptions.url       脚本URL或内容
 * @param {string}    injectedStyleOptions.name      包名称
 * @param {boolean}   injectedStyleOptions.isContent 是否直接传入内容而非URL
 * @param {boolean}   injectedStyleOptions.isDev     是否为开发环境
 * @returns {Promise<void>}
 */
export async function injectedStyle({
  url,
  name,
  isContent,
  isDev
}: injectedStyleOptions) {
  const oldStyle = document.getElementById(`${name}-style`)
  if (oldStyle) oldStyle.remove()

  let styleUrl = url
  let content = url

  // 开发环境下总是需要获取内容
  if (isDev && !isContent) {
    content = await fetch(url).then((res) => res.text())
    if (!content) return
  }

  const blob = new Blob([content], { type: "text/css" })
  styleUrl = URL.createObjectURL(blob)
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = styleUrl
  link.id = `${name}-style`
  document.head.appendChild(link)

  console.info(`%c【APaaS扩展】: ${name} 样式已更新`, "color: #28a745")
}
