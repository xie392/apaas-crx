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
  const blob = new Blob([content], { type: "text/javascript" })
  const url = URL.createObjectURL(blob)
  const script = document.createElement("script")
  script.src = url
  document.body.appendChild(script)

  // 主文件需要手动注册到 Vue 实例
  if (!isWorker) {
    script.onload = () => {
      const plugin = window[fileName]
      if (window?.vue && plugin) {
        plugin?.default?.install(window.vue, {})
        console.info(
          "%c【APaaS扩展】: 插件已成功注册到 Vue 实例",
          "color: #007bff"
        )
      }
    }
  }
}

export async function injectedCssHelper(content: string) {
  const blob = new Blob([content], { type: "text/css" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = url
  document.body.appendChild(link)
}
