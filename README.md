## 介绍

**APaaS 脚本替换工具** 是一个 Chrome 浏览器扩展程序，主要用于在网页中动态替换 JavaScript 和 CSS 文件。这个工具特别适用于 APaaS（应用程序平台即服务）平台的开发和测试场景。

### 🎯 核心功能

1. **脚本文件替换**：将网页中的原始 JS/CSS 文件替换为本地开发的自定义文件
2. **多应用管理**：支持创建、编辑和删除多个替换应用配置
3. **URL 匹配规则**：通过配置 URL 模式来精确控制何时触发文件替换
4. **包文件管理**：每个应用可以上传多个压缩包，包含不同的脚本文件
5. **热更新**（v0.0.7+）：配合本地开发服务，保存代码后自动更新页面，无需刷新

### 💡 使用场景

1. **前端开发调试**：在生产环境中调试本地开发的脚本，改动即时生效
2. **APaaS 平台定制**：为 APaaS 平台注入自定义的业务逻辑
3. **热修复**：临时修复生产环境中的脚本问题

## 插件原理

**一句话总结：**页面本来要加载官方服务器上的代码文件，插件偷偷把它换成你电脑上的；你一保存代码，本地立刻重新打包，插件收到"改好了"的信号，就把页面里那份旧代码扔掉、换上新的，让页面重画一遍，全程不用刷新。

**代价：**界面会整体重画一遍（一般看不出来），大部分改动都能生效；但如果改动涉及"新增/删除组件"这种大动作，还是得手动刷新一次页面才保险。

### **完整链路的原理：**

### 1. 静态资源劫持（让页面用上你本地的包）

插件用 `chrome.declarativeNetRequest` 动态规则，把页面对 `xxx.umd.js` 的请求拦截，重定向到本地 node 服务（`http://127.0.0.1:3000/...`）。所以页面首次加载时，拿到的就已经是本地构建的产物。

### 2. 变更通知（SSE）

本地 `server.js` 用 `rslib` watch（没迁移的就用 vue cli 构建也是一样的）模式持续构建，chokidar 监听产物目录，文件变化后通过 SSE（`/sse` 端点）推一条 `{event: "change"}` 消息。插件的 content script 里跑着一个 `EventSource` 长连接收到通知。收到后还有 300ms 防抖，一次构建只触发一次。

### 3. 重新注入（绕过"已 use 过"的问题）

content script 发 `DEV_FILE_CHANGED` 消息给 background，background 重新 fetch 本地最新的 UMD 内容，然后 `chrome.scripting.executeScript` 以 MAIN world 往页面注入一段脚本：把旧的 `<script id="包名-script">` 删掉，用新内容生成 Blob URL 插回去重新执行。

### 4. 局部生效（不刷新页面的关键）

脚本执行完 UMD 会覆盖 `window[包名]`，然后手动调 `plugin.default.install(window.vue)` 重新安装——这一步相当于重新调用 `Vue.component()`，把组件定义重新注册到全局 Vue。

关键点在这里：**Vue 2 渲染时是通过注册表按名字解析组件的**，重注册后注册表里就是新定义。再配合 `forceRerender()`——遍历 DOM 上的 `el.__vue__` 找到所有 Vue 根实例，递归 `$forceUpdate()`，强制整棵树重新执行 render 函数。重渲染时解析到新组件定义，界面就更新了，而已挂载实例的 data/props 状态都保留。

## 使用教程

### 1. 安装插件

在 Chrome 中打开 `chrome://extensions/`，开启「开发者模式」，加载已解压的扩展程序（或加载构建产物）。

### 2. 方式一：上传压缩包替换（静态替换）

1. 点击插件图标，创建应用配置，填写目标页面的 URL 匹配规则
2. 上传按上述格式打好的 ZIP 包
3. 打开目标页面，插件会自动拦截原始请求并替换为你上传的文件

### 3. 方式二：本地开发服务（推荐，支持热更新）

1. 在业务项目里启动本地开发服务（如 `node scripts/server.js <模块名> (server.js 例子在下面提供)`），它会在本地（默认 3000 端口）托管构建产物，并提供 `/sse` 变更通知端点
2. 在插件中为应用添加开发配置（devUrl 填本地服务地址，如 `http://127.0.0.1:3000`）
3. 打开目标页面，页面加载的即是本地构建产物
4. 之后修改代码并保存 → 本地自动重新构建 → 页面自动热更新，无需手动刷新

### 4. 注意事项

- 目标页面的域名必须包含在应用的 URL 匹配规则中，否则不会触发替换
- 如果本地服务端口不是 3000，devUrl 需要对应修改
- 涉及新增/删除组件等大改动时，建议手动刷新一次页面

### 5. 本地服务脚本参考实现

以下两个脚本可直接复制到业务项目的 `scripts/` 目录使用。依赖：`express`、`cors`、`chokidar`、`shelljs`、`zip-local`、`chalk`。

#### server.js（本地开发服务 + SSE 热更新通知）

用法：`node scripts/server.js <模块名>`，从 3000 起自动尝试可用端口，托管构建产物并提供 `/sse` 端点；内置 rslib watch 持续构建，产物变化后合并推送（300ms 防抖）。

```js
#!/usr/bin/env node
const express = require('express')
const path = require('path')
const { spawn } = require('child_process')
const chokidar = require('chokidar')
const cors = require('cors')
const fs = require('fs')
const chalk = require('chalk')

const log = {
  info: (msg) => console.log(chalk.cyan(`【信息】${msg}`)),
  success: (msg) => console.log(chalk.green(`【成功】${msg}`)),
  error: (msg) => console.error(chalk.red(`【错误】${msg}`)),
  warning: (msg) => console.warn(chalk.yellow(`【警告】${msg}`))
}

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

function loadApaasConfig(customModule) {
  const customModulePath = path.resolve(process.cwd(), 'src/custom', customModule)
  const configPath = path.resolve(customModulePath, 'apaas.json')

  if (!fs.existsSync(configPath)) {
    log.error(`自开发模块 ${customModule} 下不存在需要的 apaas.json 文件`)
    process.exit(1)
  }

  const apaasConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  return { customModulePath, configPath, apaasConfig }
}

function validateEntry(customModulePath, entry) {
  const entryPath = path.resolve(customModulePath, entry)
  if (!fs.existsSync(entryPath)) {
    log.error(`apaas.json 指定的 entry: ${entry} 路径错误: ${entryPath}`)
    process.exit(1)
  }
  return entryPath
}

async function main() {
  const [, , customModule, ...argv] = process.argv

  if (!customModule) {
    log.error('请提供自定义模块名称')
    process.exit(1)
  }

  const { customModulePath, apaasConfig } = loadApaasConfig(customModule)
  const staticDir = path.join(process.cwd(), apaasConfig.outputName)

  if (!fs.existsSync(staticDir)) {
    fs.mkdirSync(staticDir, { recursive: true })
  }

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

  try {
    const availablePort = await listenWithRetry(app, PORT_RANGE.from)
    log.success(`静态资源服务器启动: http://127.0.0.1:${availablePort}/`)

    if (availablePort !== DEFAULT_PORT) {
      log.warning(`端口 ${DEFAULT_PORT} 被占用，已自动切换到端口 ${availablePort}`)
    }

    log.info(`静态资源目录: ${staticDir}`)

    // 启动 rslib watch 构建
    const entryPath = validateEntry(customModulePath, apaasConfig.entry)
    log.info(`入口文件: ${entryPath}`)

    const buildCmd = ['rslib', 'build', '-w']
    log.info(`构建命令: npx ${buildCmd.join(' ')}`)

    const buildProcess = spawn('npx', buildCmd, {
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PUBLIC_OUTPUT_NAME: apaasConfig.outputName,
        PUBLIC_ENTRY: entryPath
      },
      detached: process.platform !== 'win32'
    })

    buildProcess.stdout.on('data', (data) => {
      log.success(`源代码更新: ${data.toString().trim()}`)
    })

    buildProcess.stderr.on('data', (data) => {
      log.error(`构建错误: ${data.toString().trim()}`)
    })

    buildProcess.on('close', (code) => {
      log.warning(`构建进程退出，退出码: ${code}`)
    })

    // 监听构建产物，防抖合并后推送 SSE
    const watcher = chokidar.watch(staticDir, {
      ignored: /(^|[/\\])\../,
      persistent: true,
      ignoreInitial: true
    })

    log.info(`正在监听构建产物目录: ${staticDir}`)

    const DEBOUNCE_MS = 300
    let debounceTimer = null
    let pendingFiles = new Set()

    watcher.on('all', (event, filePath) => {
      if (event !== 'change' && event !== 'add') return

      pendingFiles.add(path.basename(filePath))

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

    // 统一的清理函数
    const cleanup = () => {
      log.warning('接收到终止信号，正在关闭服务...')
      if (watcher) watcher.close()

      if (buildProcess && !buildProcess.killed) {
        try {
          process.kill(-buildProcess.pid, 'SIGTERM')
        } catch (e) {
          buildProcess.kill('SIGTERM')
        }
      }

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

main()
```

#### build.js（单次构建并打 ZIP 包，用于上传替换）

用法：`node scripts/build.js <模块名>`，构建产物并生成 `{outputName}.zip` 上传包。

```js
const fs = require('fs')
const shell = require('shelljs')
const path = require('path')
const zipper = require('zip-local')

function build(customModule, argv) {
  // 获取指定 custom 目录下的apaas.json
  const customModulePath = path.resolve(`${process.cwd()}`, 'src/custom', customModule)
  const customModuleConfigPath = path.resolve(customModulePath, 'apaas.json')

  if (!fs.existsSync(customModuleConfigPath)) {
    console.log(`Error: 自开发模块 ${customModule} 下不存在需要的 apaas.json 文件`['red'])
    console.log(`exit`['red'])
    process.exit(0)
  }

  const apaasConfig = JSON.parse(fs.readFileSync(customModuleConfigPath))
  const customModuleEntryPath = path.resolve(customModulePath, apaasConfig.entry)

  if (!fs.existsSync(customModuleEntryPath)) {
    console.log(`Error: apaas.json 指定的entry: ${apaasConfig.entry} 的路径错误 `['red'])
    console.log(`error path is ${customModuleEntryPath}`['red'])
    console.log(`exit`['red'])
    process.exit(0)
  }

  const outputPath = path.resolve(`${process.cwd()}`, `${apaasConfig.outputName}`)
  const outputZipPath = path.resolve(`${process.cwd()}`, `${apaasConfig.outputName}.zip`)

  // 清理目标路径
  if (fs.existsSync(outputPath)) {
    if (fs.lstatSync(outputPath).isDirectory()) {
      shell.rm('-rf', outputPath)
    } else {
      shell.rm(outputPath)
    }
  }

  // 添加环境变量
  const env = process.env
  env.PUBLIC_ENTRY = customModuleEntryPath
  env.PUBLIC_OUTPUT_NAME = customModule

  shell.exec(`npx rslib build ${argv}`)
  // 拷贝自定义模块的apaas.json到指定目录
  shell.cp('-R', customModuleConfigPath, `${outputPath}/`)

  // 拷贝public文件中的到指定目录
  apaasConfig.copyAssets.forEach((copyAsset) => {
    const assetPath = path.resolve(`${process.cwd()}`, copyAsset)
    const outputAsset = path.resolve(outputPath, copyAsset.replace('public/', 'static/'))
    shell.mkdir('-p', outputAsset)
    shell.cp('-R', `${assetPath}/*`, `${outputAsset}/`)
  })

  if (fs.existsSync(outputZipPath)) {
    shell.rm(outputZipPath)
  }
  // 生成zip并压缩
  zipper.zip(outputPath, function(error, zipped) {
    if (!error) {
      zipped.compress()
      const buff = zipped.memory()
      zipped.save(`${outputZipPath}`, function(error) {
        if (!error) {
          console.log(
            `构建 ${apaasConfig.outputName} 成功！压缩包大小: ${(buff.length / 1024 / 1024).toFixed(2)} MB`
          )

          // 删除指定生成目录
          shell.rm('-r', outputPath)
        }
      })
    }
  })
}

const [, , customModule, ...argv] = process.argv
build(customModule, argv?.join(' '))
```

> 注意：`build.js` 只构建一次、用于打上传包；热更新场景请使用 `server.js`。两个脚本均假定模块位于 `src/custom/<模块名>/`，如果你的项目结构不同，请调整路径。
