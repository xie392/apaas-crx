#!/usr/bin/env node
/**
 * rsbuild monorepo 热更新服务
 * 差异点：模块路径 apps/<模块名>/apaas.json，产物目录 zip/<outputName>/，构建命令 rslib build -w
 * 公共能力（日志/端口探测/静态服务/SSE/防抖监听）见 ../lib/
 */
const fs = require("fs")
const path = require("path")
const { spawn } = require("child_process")

const { log, exitWithError } = require("../lib/utils.cjs")
const { startHotServer, watchBuildOutput } = require("../lib/hot-server.cjs")
const { loadApaasConfig, validateEntry } = require("./common.cjs")
const { buildRslibCommand, extractCustomArgs } = require("../lib/rsbuild.cjs")
const { loadEnvLocal, registerDevServer } = require("../lib/dev-registry.cjs")

// ---- 差异点 1：解析路径 ----
function resolveContext() {
  const [, , customModule, ...argv] = process.argv
  const { filteredArgv, extracted } = extractCustomArgs(argv)

  if (!customModule) exitWithError("请提供自定义模块名称")

  const { customModulePath, apaasConfig } = loadApaasConfig(customModule, extracted?.name ?? "apaas.json")
  const entryPath = validateEntry(customModulePath, apaasConfig.entry)
  const staticDir = path.join(process.cwd(), "zip", apaasConfig.outputName)

  if (!fs.existsSync(staticDir)) fs.mkdirSync(staticDir, { recursive: true })

  return { customModule, filteredArgv, customModulePath, apaasConfig, entryPath, staticDir, extracted }
}

// ---- 差异点 2：打包命令 ----
function startBuild({ filteredArgv, customModulePath, apaasConfig, entryPath, extracted }) {
  const buildCmd = buildRslibCommand(customModulePath, filteredArgv, true)
  log.info(`构建命令: npx ${buildCmd.join(" ")}`)

  const buildProcess = spawn("npx", buildCmd, {
    env: {
      ...process.env,
      // 确保构建缓存生效、跳过压缩，加快热更新重建速度
      NODE_ENV: "development",
      PUBLIC_OUTPUT_NAME: apaasConfig.outputName,
      PUBLIC_ENTRY: entryPath,
      PUBLIC_CUSTOM_ARGS: JSON.stringify(extracted),
    },
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  })

  buildProcess.stdout.on("data", (data) => log.success(`源代码更新: ${data.toString().trim()}`))
  buildProcess.stderr.on("data", (data) => log.error(`构建错误: ${data.toString().trim()}`))
  buildProcess.on("close", (code) => log.warning(`构建进程退出，退出码: ${code}`))

  return buildProcess
}

async function main() {
  const ctx = resolveContext()

  const { port, clients } = await startHotServer({
    staticDir: ctx.staticDir,
    extraPrefixes: [`/app/${ctx.apaasConfig.outputName}/`, `/m/${ctx.apaasConfig.outputName}/`],
  })

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
