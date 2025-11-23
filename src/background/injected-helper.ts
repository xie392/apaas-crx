declare global {
  interface Window {
    vue: any
  }
}

interface injectedScriptOptions {
  name: string
  isWorker?: boolean
  content: string
}

interface injectedStyleOptions
  extends Omit<injectedScriptOptions, "isWorker"> {}

export async function injected({ content, name }: injectedScriptOptions) {
  // 如果已经注入过了就不需要继续注入
  const el = document.getElementById(`injected-${name}`)
  if (el) return

  console.log("injected:", name)

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === "SCRIPT") {
          const script = node as HTMLScriptElement
          console.log("script injected:", script.src, name)
          if (script.src.includes(name)) {
            const blob = new Blob([content], { type: "text/javascript" })
            const scriptUrl = URL.createObjectURL(blob)
            script.src = scriptUrl
            script.id = `injected-${name}`
            console.log(`🔄 将脚本 ${script.src} 替换为 ${scriptUrl}`)
            observer.disconnect()
          }
        }

        console.log("node.nodeName", node)

        if (node.nodeName === "STYLE") {
          const style = node as HTMLLinkElement
          console.log(style.href)
          // if (style.h) {
          //   const blob = new Blob([content], { type: "text/javascript" })
          //   const scriptUrl = URL.createObjectURL(blob)
          //   script.src = scriptUrl
          //   script.id = `injected-${name}`
          //   console.log(`🔄 将脚本 ${script.src} 替换为 ${scriptUrl}`)
          //   observer.disconnect()
          // }
        }
      })
    })
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  })

  window.addEventListener("load", () => {
    observer.disconnect()
  })
}

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
  content,
  name
  // isWorker
}: injectedScriptOptions) {
  // 创建一个 MutationObserver 实例
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // 遍历所有被添加的节点
      mutation.addedNodes.forEach((node) => {
        // 检查节点是否是一个 <script> 标签，并且具有 src 属性
        if (node.nodeName === "SCRIPT") {
          const script = node as HTMLScriptElement

          if (script.src.includes(name)) {
            const blob = new Blob([content], { type: "text/javascript" })
            const scriptUrl = URL.createObjectURL(blob)
            script.src = scriptUrl
            console.log(`🔄 将脚本 ${script.src} 替换为 ${scriptUrl}`)
            observer.disconnect()
          }
        }
      })
    })
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  })
  window.addEventListener("load", () => {
    observer.disconnect()
  })
  // 移除旧的脚本
  const oldScript = document.getElementById(`${name}-script`)
  if (oldScript) oldScript.remove()

  // 创建新的脚本元素
  const blob = new Blob([content], { type: "text/javascript" })
  const scriptUrl = URL.createObjectURL(blob)
  const script = document.createElement("script")
  script.src = scriptUrl
  // script.id = isWorker ? `${name}-script-worker` : `${name}-script`
  document.body.appendChild(script)

  // script.onload = () => {
  //   const plugin = window[name]
  //   if (window?.vue && plugin) {
  //     // 手动安装插件
  //     // TODO: 开发模式下热更新
  //     plugin?.default?.install(window.vue)
  //     console.info(`%c【APaaS扩展】: ${name} 已更新`, "color: #007bff")
  //   }
  // }
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
export async function injectedStyle({ content, name }: injectedStyleOptions) {
  const oldStyle = document.getElementById(`${name}-style`)
  if (oldStyle) oldStyle.remove()

  const blob = new Blob([content], { type: "text/css" })
  const styleUrl = URL.createObjectURL(blob)
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = styleUrl
  link.id = `${name}-style`
  document.head.appendChild(link)

  console.info(`%c【APaaS扩展】: ${name} 样式已更新`, "color: #28a745")
}
