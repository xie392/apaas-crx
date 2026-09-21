const express = require("express")
const cors = require("cors")
const chokidar = require("chokidar")
const net = require("net")
const { log } = require("./utils.cjs")

// 配置相关常量
const DEFAULT_PORT = 3000
const PORT_RANGE = { from: 3000, to: 3100 }

// 端口被占用时依次向后尝试
function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        if (startPort < PORT_RANGE.to) {
          resolve(findAvailablePort(startPort + 1))
        } else {
          reject(new Error("端口范围内无可用端口"))
        }
      } else {
        reject(err)
      }
    })
    server.listen(startPort, "127.0.0.1", () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

/**
 * 启动热更新静态资源服务（CORS + 静态托管 + SSE 端点）
 * @param {object} options
 * @param {string} options.staticDir      构建产物目录
 * @param {string[]} [options.extraPrefixes] 额外静态路由前缀，如 ["/app/xxx/", "/m/xxx/"]
 * @returns {Promise<{ port: number, clients: Set<any> }>}
 */
async function startHotServer({ staticDir, extraPrefixes = [] }) {
  const app = express()
  const clients = new Set()

  app.use(cors())
  app.use(express.static(staticDir))
  extraPrefixes.forEach((prefix) => {
    app.use(prefix, express.static(staticDir))
  })

  // SSE路由
  app.get("/sse", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    })
    req.on("close", () => {
      clients.delete(res)
      log.info("客户端断开SSE连接")
    })
    clients.add(res)
    log.info("新的SSE客户端连接")
  })

  const port = await findAvailablePort(DEFAULT_PORT)
  await new Promise((resolve) => app.listen(port, "127.0.0.1", resolve))

  log.success(`静态资源服务器启动: http://127.0.0.1:${port}/`)
  if (port !== DEFAULT_PORT) {
    log.warning(`端口 ${DEFAULT_PORT} 被占用，已自动切换到端口 ${port}`)
  }
  log.info(`静态资源目录: ${staticDir}`)

  return { port, clients }
}

/**
 * 监听构建产物目录，300ms 防抖合并后推送 SSE
 * @param {object} options
 * @param {string} options.staticDir 构建产物目录
 * @param {Set<any>} options.clients SSE 客户端集合（来自 startHotServer）
 */
function watchBuildOutput({ staticDir, clients }) {
  const watcher = chokidar.watch(staticDir, {
    ignored: /(^|[/\\])\../,
    persistent: true,
    ignoreInitial: true,
  })

  log.info(`正在监听构建产物目录: ${staticDir}`)

  // 防抖：一次构建会同时产出多个文件，合并为一次 SSE 推送
  const DEBOUNCE_MS = 300
  let debounceTimer = null
  let pendingFiles = new Set()

  watcher.on("all", (event, filePath) => {
    if (event !== "change" && event !== "add") return

    pendingFiles.add(path.basename(filePath))

    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const files = [...pendingFiles]
      pendingFiles = new Set()
      log.info(`构建产物变化: ${files.join(", ")}`)

      clients.forEach((client) => {
        log.info("发送SSE刷新通知")
        client.write(
          `data: ${JSON.stringify({
            event: "change",
            filePath: files.join(","),
          })}\n\n`,
        )
      })
    }, DEBOUNCE_MS)
  })

  watcher.on("error", (error) => {
    log.error(`文件监听错误: ${error}`)
  })

  return watcher
}

module.exports = { DEFAULT_PORT, findAvailablePort, startHotServer, watchBuildOutput }
