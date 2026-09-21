#!/usr/bin/env node
console.log('Starting server script...')
const express = require('express')
const path = require('path')
const { spawn } = require('child_process')
const chokidar = require('chokidar')
const cors = require('cors')
const fs = require('fs')
const net = require('net')
const chalk = require('chalk')

// 配置相关常量和工具函数
const DEFAULT_PORT = 3000
const PORT_RANGE = { from: 3000, to: 3100 }

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        if (startPort < PORT_RANGE.to) {
          resolve(findAvailablePort(startPort + 1))
        } else {
          reject(new Error('端口范围内无可用端口'))
        }
      } else {
        reject(err)
      }
    })
    server.listen(startPort, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

const log = {
  info: (msg) => console.log(chalk.cyan(`【信息】${msg}`)),
  success: (msg) => console.log(chalk.green(`【成功】${msg}`)),
  error: (msg) => console.error(chalk.red(`【错误】${msg}`)),
  warning: (msg) => console.warn(chalk.yellow(`【警告】${msg}`))
}

function initialize() {
  const [, , customModule, ...argv] = process.argv

  if (!customModule) {
    log.error('请提供自定义模块名称')
    process.exit(1)
  }

  const customModulePath = path.resolve(process.cwd(), 'src/custom', customModule)
  const configPath = path.resolve(customModulePath, 'apaas.json')

  if (!fs.existsSync(configPath)) {
    log.error(`找不到配置文件: ${configPath}`)
    process.exit(1)
  }

  let apaasConfig
  try {
    apaasConfig = JSON.parse(fs.readFileSync(configPath))
  } catch (err) {
    log.error(`配置文件解析失败: ${err.message}`)
    process.exit(1)
  }

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
  app.use(express.static(staticDir))

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
    // 自动获取可用端口
    const availablePort = await findAvailablePort(DEFAULT_PORT)

    app.listen(availablePort, '127.0.0.1', () => {
      log.success(`静态资源服务器启动: http://127.0.0.1:${availablePort}/`)

      // 如果使用的端口不是默认端口，显示警告信息
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
      watchBuildOutput({ staticDir, clients })

      process.on('SIGINT', () => {
        // 删除临时目录
        fs.rmdirSync(staticDir, { recursive: true })
        log.warning('接收到终止信号，正在关闭服务...')
        buildProcess.kill()
        process.exit(0)
      })
    })
  } catch (err) {
    log.error(`服务器启动失败: ${err.message}`)
    process.exit(1)
  }
}

function startBuild({ argv, customModulePath, apaasConfig }) {
  const entryPath = path.resolve(customModulePath, apaasConfig.entry)

  if (!fs.existsSync(entryPath)) {
    log.error(`找不到入口文件: ${entryPath}`)
    process.exit(1)
  }

  // const customCliPath = path.resolve(`${process.cwd()}`, './node_modules/.bin/vue-cli-service')
  const outputPath = path.resolve(`${process.cwd()}`, `${apaasConfig.outputName}`)

  // 使用vue build 打包，并生成文件
  // shell.exec(
  //   `node ${customCliPath} build --target lib --name ${apaasConfig.outputName} --dest ${apaasConfig.outputName} ${entryPath}`
  // )

  const buildProcess = spawn('npx', [
    'vue-cli-service',
    'build',
    '--target',
    'lib',
    '--name',
    apaasConfig.outputName,
    '--dest',
    outputPath,
    entryPath,
    '--watch',
    ...argv
  ])

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

  process.on('SIGINT', () => {
    watcher.close()
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
