#!/usr/bin/env node
/**
 * vue-cli 旧工程热更新服务
 * 差异点：模块路径 src/custom/<模块名>/apaas.json，产物目录 <outputName>/，构建命令 vue-cli-service build --target lib --watch
 * 公共能力（日志/端口探测/静态服务/SSE/防抖监听）见 ../lib/
 */
const fs = require("fs")
const path = require("path")
const { spawn } = require("child_process")

const { log, exitWithError } = require("../lib/utils.cjs")
const { startHotServer, watchBuildOutput } = require("../lib/hot-server.cjs")
const { loadEnvLocal, registerDevServer } = require("../lib/dev-registry.cjs")

// ---- 差异点 1：解析路径 ----
function resolveContext() {
  const [, , customModule, ...argv] = process.argv

  if (!customModule) exitWithError("请提供自定义模块名称")

  const customModulePath = path.resolve(process.cwd(), "src/custom", customModule)
  const configPath = path.resolve(customModulePath, "apaas.json")

  if (!fs.existsSync(configPath)) exitWithError(`找不到配置文件: ${configPath}`)

  const apaasConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"))
  const entryPath = path.resolve(customModulePath, apaasConfig.entry)
  const staticDir = path.join(process.cwd(), apaasConfig.outputName)

  if (!fs.existsSync(staticDir)) fs.mkdirSync(staticDir, { recursive: true })

  return { customModule, argv, apaasConfig, entryPath, staticDir }
}

// ---- 差异点 2：打包命令 ----
function startBuild({ argv, apaasConfig, entryPath, staticDir }) {
  const buildProcess = spawn(
    "npx",
    [
      "vue-cli-service",
      "build",
      "--target",
      "lib",
      "--name",
      apaasConfig.outputName,
      "--dest",
      staticDir,
      entryPath,
      "--watch",
      ...argv
    ],
    {
      detached: process.platform !== "win32",
      shell: process.platform === "win32",
    }
  )

  buildProcess.stdout.on("data", (data) => log.success(`源代码更新: ${data.toString().trim()}`))
  buildProcess.stderr.on("data", (data) => log.error(`构建错误: ${data.toString().trim()}`))
  buildProcess.on("close", (code) => log.warning(`构建进程退出，退出码: ${code}`))

  return buildProcess
}

async function main() {
  const ctx = resolveContext()

  const { port, clients } = await startHotServer({ staticDir: ctx.staticDir })

  const buildProcess = startBuild(ctx)
  const watcher = watchBuildOutput({ staticDir: ctx.staticDir, clients })

  const unregister = await registerDevServer({
    packageName: ctx.apaasConfig.outputName,
    devUrl: `http://127.0.0.1:${port}`,
    env: loadEnvLocal(),
  })

  const cleanup = async () => {
    log.warning("接收到终止信号，正在关闭服务...")
    if (unregister) await unregister()
    if (watcher) watcher.close()
    if (buildProcess && !buildProcess.killed) {
      try {
        process.kill(-buildProcess.pid, "SIGTERM")
      } catch (e) {
        buildProcess.kill("SIGTERM")
      }
    }
    try {
      if (fs.existsSync(ctx.staticDir)) fs.rmSync(ctx.staticDir, { recursive: true, force: true })
    } catch (e) {
      log.warning(`清理临时目录失败: ${e.message}`)
    }
    process.exit(0)
  }

  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)
}

main()
