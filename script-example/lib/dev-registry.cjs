/**
 * 本地开发注册中心
 * 固定端口 9876，第一个启动的进程成为 leader 并持有注册表，
 * 后续进程通过 HTTP POST 注册。客户端定时心跳，停止心跳（如 kill -9）即被 leader 剔除。
 */
const http = require("http")
const fs = require("fs")
const path = require("path")

const { log } = require("./utils.cjs")

const REGISTRY_HOST = "127.0.0.1"
const REGISTRY_PORT = 9876
const HEARTBEAT_INTERVAL = 5000
const STALE_TTL = 15000

function post(action, payload) {
  return fetch(`http://${REGISTRY_HOST}:${REGISTRY_PORT}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((res) => res.ok).catch(() => false)
}

function startRegistryServer() {
  const apps = new Map()

  const sweepStale = () => {
    const now = Date.now()
    for (const [key, entry] of apps) {
      if (now - entry.lastHeartbeat > STALE_TTL) {
        apps.delete(key)
        log.warning(`[dev-registry] 心跳超时，移除: ${key}`)
      }
    }
  }

  const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    if (req.method === "OPTIONS") {
      res.writeHead(204)
      return res.end()
    }

    if (req.method === "GET" && req.url === "/apps") {
      res.writeHead(200, { "Content-Type": "application/json" })
      return res.end(JSON.stringify([...apps.values()].map(({ lastHeartbeat, ...rest }) => rest)))
    }

    if (req.method === "POST") {
      let body = ""
      req.on("data", (chunk) => (body += chunk))
      req.on("end", () => {
        try {
          const data = JSON.parse(body || "{}")
          const key = data.packageName
          if (!key) {
            res.writeHead(400)
            return res.end()
          }
          if (req.url === "/register") {
            apps.set(key, { ...data, lastHeartbeat: Date.now() })
            log.info(`[dev-registry] 注册: ${key} -> ${data.devUrl}`)
          } else if (req.url === "/unregister") {
            if (apps.delete(key)) log.info(`[dev-registry] 注销: ${key}`)
          } else if (req.url === "/heartbeat") {
            if (apps.has(key)) apps.get(key).lastHeartbeat = Date.now()
          }
          res.writeHead(200)
          res.end()
        } catch {
          res.writeHead(400)
          res.end()
        }
      })
      return
    }

    res.writeHead(404)
    res.end()
  })

  return new Promise((resolve) => {
    server.once("error", () => resolve(false))
    server.listen(REGISTRY_PORT, REGISTRY_HOST, () => {
      log.success(`[dev-registry] 注册中心启动: http://${REGISTRY_HOST}:${REGISTRY_PORT}/apps`)
      setInterval(sweepStale, HEARTBEAT_INTERVAL)
      resolve(true)
    })
  })
}

/**
 * 读取项目根目录 .env.local（KEY=VALUE 格式）
 */
function loadEnvLocal(root = process.cwd()) {
  const envPath = path.join(root, ".env.local")
  if (!fs.existsSync(envPath)) return {}
  const env = {}
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

/**
 * 注册当前 dev server 到注册中心
 * @param {{ packageName: string, devUrl: string, env?: object }} entry
 * @returns {Promise<Function|null>} unregister 函数，注册失败返回 null
 */
async function registerDevServer(entry) {
  let ok = await post("register", entry)
  if (!ok) {
    const started = await startRegistryServer()
    ok = started && (await post("register", entry))
  }
  if (!ok) {
    log.warning("[dev-registry] 注册失败，插件将无法自动注入该包")
    return null
  }

  const timer = setInterval(async () => {
    const ok = await post("heartbeat", { packageName: entry.packageName })
    // 心跳失败说明 leader 已死（可能被其他项目 Ctrl+C 带走），尝试重建注册中心并重新注册
    if (!ok) {
      const started = await startRegistryServer()
      if (started) await post("register", entry)
    }
  }, HEARTBEAT_INTERVAL)
  timer.unref()

  return async () => {
    clearInterval(timer)
    await post("unregister", { packageName: entry.packageName })
  }
}

module.exports = { loadEnvLocal, registerDevServer, REGISTRY_PORT }
