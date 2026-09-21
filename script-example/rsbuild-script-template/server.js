#!/usr/bin/env node
const express = require('express')
const path = require('path')
const { spawn } = require('child_process')
const chokidar = require('chokidar')
const cors = require('cors')
const fs = require('fs')
const chalk = require('chalk')
const { log, loadApaasConfig, validateEntry, buildRslibCommand } = require('./common.cjs')

process.env.RSBUILD_ENV_HOT = 'true'

// 配置相关常量
const DEFAULT_PORT = 3000
const PORT_RANGE = { from: 3000, to: 3100 }

// 端口被占用时依次向后尝试，无需额外依赖
function listenWithRetry(server, port) {
  return new Promise((resolve, reject) => {
    const handle = server.listen(port, '127.0.0.1')
    handle.once('listening', () => resolve(port))
    handle.once('error', (err) => {
      handle.close()
      if (err.code === 'EADDRINUSE' && port < PORT_RANGE.to) {
        resolve(listenWithRetry(server, port + 1))
      } else {
        reject(err)
      }
    })
  })
}

function initialize() {
  const [, , customModule, ...argv] = process.argv

  if (!customModule) {
    log.error('请提供自定义模块名称')
    process.exit(1)
  }

  // 加载配置
  const { customModulePath, configPath, apaasConfig } = loadApaasConfig(customModule)

  log.info(`配置文件路径: ${configPath}`)

  const staticDir = path.join(process.cwd(), apaasConfig.outputName)

  if (!fs.existsSync(staticDir)) {
    fs.mkdirSync(staticDir, { recursive: true })
  }

  return { customModule, argv, customModulePath, apaasConfig, staticDir }
}

async function startServer({ customModule, argv, customModulePath, apaasConfig, staticDir }) {
  const app = express()
  const clients = new Set()

  app.use(cors())
  // 旧写法，为了兼容旧插件
  app.use(express.static(staticDir))
  // 新写法，需要升级到 v0.0.7 版本插件
  app.use(`/app/${apaasConfig.outputName}/`, express.static(staticDir))

  // SSE路由
  app.get('/sse', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    req.on('close', () => {
      clients.delete(res)
      log.info('客户端断开SSE连接')
    })
    clients.add(res)
    log.info('新的SSE客户端连接')
  })

  // 启动服务器
  try {
    const availablePort = await listenWithRetry(app, PORT_RANGE.from)
    log.success(`静态资源服务器启动: http://127.0.0.1:${availablePort}/`)

    if (availablePort !== DEFAULT_PORT) {
      log.warning(`端口 ${DEFAULT_PORT} 被占用，已自动切换到端口 ${availablePort}`)
    }

    log.info(`静态资源目录: ${staticDir}`)

    const buildProcess = startBuild({
      customModule,
      argv,
      customModulePath,
      apaasConfig
    })
    const watcher = watchBuildOutput({ staticDir, clients })

    // 统一的清理函数
    const cleanup = () => {
      log.warning('接收到终止信号，正在关闭服务...')

      // 关闭 watcher
      if (watcher) {
        watcher.close()
      }

      // 杀死构建进程及其子进程
      if (buildProcess && !buildProcess.killed) {
        try {
          // 在 Unix 系统上杀死整个进程组
          process.kill(-buildProcess.pid, 'SIGTERM')
        } catch (e) {
          // 如果进程组杀死失败，尝试杀死单个进程
          buildProcess.kill('SIGTERM')
        }
      }

      // 删除临时目录
      try {
        if (fs.existsSync(staticDir)) {
          fs.rmSync(staticDir, { recursive: true, force: true })
        }
      } catch (e) {
        log.warning(`清理临时目录失败: ${e.message}`)
      }

      process.exit(0)
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  } catch (err) {
    log.error(`服务器启动失败: ${err.message}`)
    process.exit(1)
  }
}

function startBuild({ argv, customModulePath, apaasConfig }) {
  // 验证入口文件
  const entryPath = validateEntry(customModulePath, apaasConfig.entry)
  log.info(`入口文件: ${entryPath}`)

  const env = {
    ...process.env,
    NODE_ENV: 'development',
    PUBLIC_OUTPUT_NAME: apaasConfig.outputName,
    PUBLIC_ENTRY: entryPath
  }

  // 构建命令
  const buildCmd = buildRslibCommand(customModulePath, argv, true)
  log.info(`构建命令: npx ${buildCmd.join(' ')}`)

  // 在 Unix 系统上创建新的进程组，方便后续清理
  const buildProcess = spawn('npx', buildCmd, {
    env,
    detached: process.platform !== 'win32'
  })

  buildProcess.stdout.on('data', (data) => {
    const result = data.toString().trim()
    log.success(`源代码更新: ${result}`)
  })

  buildProcess.stderr.on('data', (data) => {
    log.error(`构建错误: ${data.toString().trim()}`)
  })

  buildProcess.on('close', (code) => {
    log.warning(`构建进程退出，退出码: ${code}`)
  })

  return buildProcess
}

// 监听构建输出
function watchBuildOutput({ staticDir, clients }) {
  const watcher = chokidar.watch(staticDir, {
    ignored: /(^|[/\\])\../,
    persistent: true,
    ignoreInitial: true
  })

  log.info(`正在监听构建产物目录: ${staticDir}`)

  // 防抖：一次构建会同时产出多个文件，合并为一次 SSE 推送
  const DEBOUNCE_MS = 300
  let debounceTimer = null
  let pendingFiles = new Set()

  watcher.on('all', (event, filePath) => {
    if (event !== 'change' && event !== 'add') return

    const relativePath = path.relative(process.cwd(), filePath)
    pendingFiles.add(path.basename(relativePath))

    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const files = [...pendingFiles]
      pendingFiles = new Set()
      log.info(`构建产物变化: ${files.join(', ')}`)

      clients.forEach((client) => {
        log.info('发送SSE刷新通知')
        client.write(
          `data: ${JSON.stringify({
            event: 'change',
            filePath: files.join(',')
          })}\n\n`
        )
      })
    }, DEBOUNCE_MS)
  })

  watcher.on('error', (error) => {
    log.error(`文件监听错误: ${error}`)
  })

  return watcher
}

async function main() {
  try {
    const config = initialize()
    await startServer(config)
  } catch (err) {
    console.error(chalk.red(`启动失败: ${err.message}`))
    process.exit(1)
  }
}

main()
