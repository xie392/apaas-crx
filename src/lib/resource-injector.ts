declare global {
  interface Window {
    vue: any
    [key: string]: any
  }
}

/**
 * 注入脚本到页面
 * @param url 脚本URL或内容
 * @param name 包名称
 * @param isContent 是否直接传入内容而非URL
 * @param isDev 是否为开发环境
 */
export async function injectScript(
  url: string,
  name: string,
  isContent = false,
  isDev = false
) {
  const oldScript = document.getElementById(`${name}-script`)
  if (oldScript) oldScript.remove()

  let scriptUrl = url
  let content = url

  // 开发环境下需要先fetch获取内容
  if (isDev && !isContent) {
    content = await fetch(url).then((res) => res.text())
    isContent = true
  }

  if (isContent) {
    const blob = new Blob([content], { type: "text/javascript" })
    scriptUrl = URL.createObjectURL(blob)
  }

  const script = document.createElement("script")
  script.src = scriptUrl
  script.id = `${name}-script`
  document.body.appendChild(script)

  script.onload = () => {
    const plugin = window[name]
    if (window?.vue && plugin) {
      plugin?.default?.install(window.vue, {})
      console.info(`%c【APaaS扩展】: ${name} 已更新`, "color: #007bff")
    }
  }
}

/**
 * 注入样式到页面
 * @param url 样式URL或内容
 * @param name 包名称
 * @param isContent 是否直接传入内容而非URL
 * @param useLink 是否使用link标签而非style标签
 * @param isDev 是否为开发环境
 */
export async function injectStyle(
  url: string,
  name: string,
  isContent = false,
  useLink = false,
  isDev = false
) {
  const oldStyle = document.getElementById(`${name}-style`)
  if (oldStyle) oldStyle.remove()

  // 开发环境下总是需要获取内容
  if (isDev && !isContent) {
    const content = await fetch(url).then((res) => res.text())

    const style = document.createElement("style")
    style.id = `${name}-style`
    style.textContent = content
    document.head.appendChild(style)

    console.info(`%c【APaaS扩展】: ${name} 样式已更新`, "color: #28a745")
    return
  }

  if (useLink && !isDev) {
    let styleUrl = url
    if (isContent) {
      const blob = new Blob([url], { type: "text/css" })
      styleUrl = URL.createObjectURL(blob)
    }

    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = styleUrl
    link.id = `${name}-style`
    document.head.appendChild(link)
  } else {
    let content = url
    if (!isContent) {
      content = await fetch(url).then((res) => res.text())
    }

    const style = document.createElement("style")
    style.id = `${name}-style`
    style.textContent = content
    document.head.appendChild(style)
  }

  console.info(`%c【APaaS扩展】: ${name} 样式已更新`, "color: #28a745")
}

/**
 * 在标签页中执行脚本注入
 * @param tabId 标签页ID
 * @param args 参数数组 [url, name]
 * @param isContent 是否直接传入内容而非URL
 * @param isDev 是否为开发环境
 */
export function executeScript(
  tabId: number,
  args: any[],
  isContent = false,
  isDev = false
) {
  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: injectScript,
    args: [...args, isContent, isDev]
  })
}

/**
 * 在标签页中执行样式注入
 * @param tabId 标签页ID
 * @param args 参数数组 [url, name]
 * @param isContent 是否直接传入内容而非URL
 * @param useLink 是否使用link标签而非style标签
 * @param isDev 是否为开发环境
 */
export function executeStyle(
  tabId: number,
  args: any[],
  isContent = false,
  useLink = false,
  isDev = false
) {
  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: injectStyle,
    args: [...args, isContent, useLink, isDev]
  })
}
