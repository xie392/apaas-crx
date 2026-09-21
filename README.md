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

采用三脚本结构：`common.cjs`（公共工具）+ `run.cjs`（热更新开发服务）+ `build.cjs`（单次构建打 ZIP 上传包）。

依赖：`express`、`cors`、`chokidar`、`shelljs`、`zip-local`、`chalk`、`get-port`。

#### common.cjs（公共工具）

```js
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

// 日志工具
const log = {
  info: (msg) => console.log(chalk.cyan(`【信息】${msg}`)),
  success: (msg) => console.log(chalk.green(`【成功】${msg}`)),
  error: (msg) => console.error(chalk.red(`【错误】${msg}`)),
  warning: (msg) => console.warn(chalk.yellow(`【警告】${msg}`)),
};

// 路径处理辅助函数
const resolvePath = (...args) => path.resolve(process.cwd(), ...args);

// 错误处理函数
const exitWithError = (message) => {
  log.error(message);
  process.exit(0);
};

// 加载并验证配置
function loadApaasConfig(customModule, apaasJson = 'apaas.json') {
  const customModulePath = resolvePath("apps", customModule);
  const configPath = resolvePath(customModulePath, apaasJson);

  if (!fs.existsSync(configPath)) {
    exitWithError(`自开发模块 ${customModule} 下不存在需要的 ${apaasJson} 文件`);
  }

  let apaasConfig;
  try {
    apaasConfig = JSON.parse(fs.readFileSync(configPath));
  } catch (err) {
    exitWithError(`配置文件解析失败: ${err.message}`);
  }

  return { customModulePath, configPath, apaasConfig };
}

// 验证入口文件
function validateEntry(customModulePath, entry) {
  const entryPath = resolvePath(customModulePath, entry);

  if (!fs.existsSync(entryPath)) {
    exitWithError(
      `apaas.json 指定的 entry: ${entry} 的路径错误\nerror path is ${entryPath}`,
    );
  }

  return entryPath;
}

// 动态配置：需要提取的自定义属性列表（可扩展）
const CUSTOM_ARGS = ["name"];

/**
 * 提取并过滤参数
 */
function extractCustomArgs(args, customArgs = CUSTOM_ARGS) {
  const result = { filteredArgv: [], extracted: {} };
  const excluded = new Set(
    customArgs.map((arg) => [`-${arg}`, `--${arg}`]).flat(),
  );

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const eqMatch = arg.match(/^--?([a-zA-Z-]+)=(.+)$/);
    const simpleMatch = arg.match(/^--?([a-zA-Z-]+)$/);

    // 处理 -name=value 或 --name=value 格式
    if (eqMatch) {
      const key = eqMatch[1];
      const value = eqMatch[2];
      if (customArgs.includes(key)) {
        result.extracted[key] = value;
        continue;
      }
      result.filteredArgv.push(arg);
      continue;
    }

    // 处理 -name value 格式
    if (simpleMatch) {
      const key = simpleMatch[1];
      if (customArgs.includes(key)) {
        const nextArg = args[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          result.extracted[key] = nextArg;
          i++; // 跳过下一个参数
          continue;
        }
        result.extracted[key] = ""; // 没有值时设为空字符串
        continue;
      }
    }

    result.filteredArgv.push(arg);
  }

  return result;
}

// 构建 rslib 命令
function buildRslibCommand(customModulePath, argv = [], isWatch = false) {
  const rslibConfigPath = resolvePath(customModulePath, "rslib.config.ts");
  const hasConfig = fs.existsSync(rslibConfigPath);
  const baseCmd = ["rslib", "build"];
  if (isWatch) baseCmd.push("-w");
  if (hasConfig) baseCmd.push("-c", rslibConfigPath);

  if (argv.length > 0) baseCmd.push(...argv);

  return baseCmd;
}

module.exports = {
  log,
  resolvePath,
  exitWithError,
  loadApaasConfig,
  validateEntry,
  buildRslibCommand,
  extractCustomArgs
};
```

#### run.cjs（热更新开发服务）

用法：`node scripts/run.cjs <模块名>`。启动静态资源服务（3000~3100 自动探测端口）+ `/sse` 通知端点 + rslib watch 持续构建；产物变化后 300ms 防抖合并推送。已设置 `NODE_ENV=development`，确保 rslib `buildCache` 生效、跳过压缩，重建更快。

```js
#!/usr/bin/env node
const express = require("express");
const path = require("path");
const { spawn } = require("child_process");
const chokidar = require("chokidar");
const cors = require("cors");
const fs = require("fs");
const chalk = require("chalk");
const {
  log,
  resolvePath,
  loadApaasConfig,
  validateEntry,
  buildRslibCommand,
  extractCustomArgs,
} = require("./common.cjs");

// 配置相关常量
const DEFAULT_PORT = 3000;
const PORT_RANGE = { from: 3000, to: 3100 };

function initialize() {
  const [, , customModule, ...argv] = process.argv;

  const { filteredArgv, extracted } = extractCustomArgs(argv);

  if (!customModule) {
    log.error("请提供自定义模块名称");
    process.exit(1);
  }

  // 加载配置
  const { customModulePath, configPath, apaasConfig } =
    loadApaasConfig(customModule, extracted?.name ?? 'apaas.json');

  log.info(`配置文件路径: ${configPath}`);

  const staticDir = path.join(process.cwd(), "zip", apaasConfig.outputName);

  if (!fs.existsSync(staticDir)) {
    fs.mkdirSync(staticDir, { recursive: true });
  }

  return { customModule, filteredArgv, customModulePath, apaasConfig, staticDir, extracted };
}

async function startServer({
  customModule,
  argv,
  customModulePath,
  apaasConfig,
  staticDir,
  extracted
}) {
  const app = express();
  const clients = new Set();

  app.use(cors());
  // 旧写法，为了兼容旧插件
  app.use(express.static(staticDir));
  // 新写法，需要升级到 v0.0.7 版本插件
  app.use(`/app/${apaasConfig.outputName}/`, express.static(staticDir));
  app.use(`/m/${apaasConfig.outputName}/`, express.static(staticDir));
  // 如果有其他路径的话可自行根据自己的路径添加

  // SSE路由
  app.get("/sse", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    req.on("close", () => {
      clients.delete(res);
      log.info("客户端断开SSE连接");
    });
    clients.add(res);
    log.info("新的SSE客户端连接");
  });

  // 启动服务器
  try {
    // 动态导入 get-port ES 模块
    const { default: getPort } = await import("get-port");

    // 自动获取可用端口
    // 注意：不要传 host，让 get-port 校验所有本地地址（含 IPv6 通配 :: 与 0.0.0.0）。
    const availablePort = await getPort({
      port: Array.from(
        { length: PORT_RANGE.to - PORT_RANGE.from + 1 },
        (_, i) => PORT_RANGE.from + i,
      ),
    });

    app.listen(availablePort, "127.0.0.1", () => {
      log.success(`静态资源服务器启动: http://127.0.0.1:${availablePort}/`);

      if (availablePort !== DEFAULT_PORT) {
        log.warning(
          `端口 ${DEFAULT_PORT} 被占用，已自动切换到端口 ${availablePort}`,
        );
      }

      log.info(`静态资源目录: ${staticDir}`);

      const buildProcess = startBuild({
        customModule,
        argv,
        customModulePath,
        apaasConfig,
        extracted
      });
      const watcher = watchBuildOutput({ staticDir, clients });

      // 统一的清理函数
      const cleanup = () => {
        log.warning("接收到终止信号，正在关闭服务...");

        if (watcher) {
          watcher.close();
        }

        if (buildProcess && !buildProcess.killed) {
          try {
            // 在 Unix 系统上杀死整个进程组
            process.kill(-buildProcess.pid, "SIGTERM");
          } catch (e) {
            buildProcess.kill("SIGTERM");
          }
        }

        try {
          if (fs.existsSync(staticDir)) {
            fs.rmSync(staticDir, { recursive: true, force: true });
          }
        } catch (e) {
          log.warning(`清理临时目录失败: ${e.message}`);
        }

        process.exit(0);
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);
    });
  } catch (err) {
    log.error(`服务器启动失败: ${err.message}`);
    process.exit(1);
  }
}

function startBuild({ argv, customModulePath, apaasConfig, extracted = {} }) {
  // 验证入口文件
  const entryPath = validateEntry(customModulePath, apaasConfig.entry);
  log.info(`入口文件: ${entryPath}`);

  const env = {
    ...process.env,
    // 确保构建缓存生效、跳过压缩，加快热更新重建速度
    NODE_ENV: "development",
    PUBLIC_OUTPUT_NAME: apaasConfig.outputName,
    PUBLIC_ENTRY: entryPath,
    // 传递自定义参数（转为 JSON 字符串）
    PUBLIC_CUSTOM_ARGS: JSON.stringify(extracted),
  };

  // 构建命令
  const buildCmd = buildRslibCommand(customModulePath, argv, true);
  log.info(`构建命令: npx ${buildCmd.join(" ")}`);

  // 在 Unix 系统上创建新的进程组，方便后续清理
  const buildProcess = spawn("npx", buildCmd, {
    env,
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
  });

  buildProcess.stdout.on("data", (data) => {
    const result = data.toString().trim();
    log.success(`源代码更新: ${result}`);
  });

  buildProcess.stderr.on("data", (data) => {
    log.error(`构建错误: ${data.toString().trim()}`);
  });

  buildProcess.on("close", (code) => {
    log.warning(`构建进程退出，退出码: ${code}`);
  });

  return buildProcess;
}

// 监听构建输出，防抖合并后推送 SSE
function watchBuildOutput({ staticDir, clients }) {
  const watcher = chokidar.watch(staticDir, {
    ignored: /(^|[/\\])\../,
    persistent: true,
    ignoreInitial: true,
  });

  log.info(`正在监听构建产物目录: ${staticDir}`);

  // 防抖：一次构建会同时产出多个文件，合并为一次 SSE 推送
  const DEBOUNCE_MS = 300;
  let debounceTimer = null;
  let pendingFiles = new Set();

  watcher.on("all", (event, filePath) => {
    if (event !== "change" && event !== "add") return;

    const relativePath = path.relative(process.cwd(), filePath);
    pendingFiles.add(path.basename(relativePath));

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const files = [...pendingFiles];
      pendingFiles = new Set();
      log.info(`构建产物变化: ${files.join(", ")}`);

      clients.forEach((client) => {
        log.info("发送SSE刷新通知");
        client.write(
          `data: ${JSON.stringify({
            event: "change",
            filePath: files.join(","),
          })}\n\n`,
        );
      });
    }, DEBOUNCE_MS);
  });

  watcher.on("error", (error) => {
    log.error(`文件监听错误: ${error}`);
  });

  return watcher;
}

async function main() {
  try {
    const config = initialize();
    await startServer(config);
  } catch (err) {
    console.error(chalk.red(`启动失败: ${err.message}`));
    process.exit(1);
  }
}

main();
```

#### build.cjs（单次构建并打 ZIP 包，用于上传替换）

用法：`node scripts/build.cjs <模块名>`，构建产物、统计体积并生成 `zip/{outputName}.zip` 上传包。

```js
#!/usr/bin/env node
const fs = require("fs");
const shell = require("shelljs");
const zipper = require("zip-local");
const chalk = require("chalk");
const {
  log,
  resolvePath,
  exitWithError,
  loadApaasConfig,
  validateEntry,
  buildRslibCommand,
  extractCustomArgs
} = require("./common.cjs");

function build(customModule, argv) {
  const { filteredArgv, extracted } = extractCustomArgs(argv);

  // 加载配置
  const { customModulePath, configPath, apaasConfig } =
    loadApaasConfig(customModule, extracted?.name ?? 'apaas.json');

  // 验证入口文件
  const entry = apaasConfig.entry
  const customModuleEntryPath = validateEntry(customModulePath, entry);
  const outputName = apaasConfig.outputName;
  const outputPath = resolvePath("zip", outputName);
  const outputZipPath = resolvePath(`zip/${outputName}.zip`);

  // 清理目标路径
  if (fs.existsSync(outputPath)) {
    fs.lstatSync(outputPath).isDirectory()
      ? shell.rm("-rf", outputPath)
      : shell.rm(outputPath);
  }

  // 设置环境变量并执行构建
  process.env.PUBLIC_ENTRY = customModuleEntryPath;
  process.env.PUBLIC_OUTPUT_NAME = outputName;
  process.env.PUBLIC_CUSTOM_ARGS = JSON.stringify(extracted);

  // 构建命令
  const buildCmdArray = buildRslibCommand(
    customModulePath,
    filteredArgv
  );
  const buildCmd = `npx ${buildCmdArray.join(" ")}`;
  log.info(`构建命令: ${buildCmd}`);

  // 执行构建并检查结果
  const buildResult = shell.exec(buildCmd);
  if (buildResult.code !== 0) {
    exitWithError("构建失败，无法生成压缩包。请检查构建日志获取更多信息。");
  }
  log.success(`构建 ${customModule} 模块成功！`);

  // 统计构建产物大小
  // JS 体积阈值（KB）：超过 500KB 提示警告，超过 1MB 红色警告并建议拆分新的自开发包
  const JS_WARN_KB = 500;
  const JS_ERROR_KB = 1024;
  const oversizeJsFiles = [];

  if (fs.existsSync(outputPath)) {
    log.info("构建产物大小统计:");
    const files = shell.ls("-R", outputPath);
    files.forEach((file) => {
      const filePath = resolvePath(outputPath, file);
      if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
        const stats = fs.statSync(filePath);
        const sizeKb = stats.size / 1024;
        const size = sizeKb.toFixed(2);
        const isJs = file.endsWith(".js");

        if (isJs && sizeKb >= JS_ERROR_KB) {
          console.log(chalk.red(`  ${file}: ${size} KB`));
          oversizeJsFiles.push({ file, size, level: "error" });
        } else if (isJs && sizeKb >= JS_WARN_KB) {
          console.log(chalk.yellow(`  ${file}: ${size} KB`));
          oversizeJsFiles.push({ file, size, level: "warn" });
        } else {
          log.info(`  ${file}: ${size} KB`);
        }
      }
    });

    oversizeJsFiles.forEach(({ file, size, level }) => {
      if (level === "error") {
        log.error(
          `${file} 体积为 ${size} KB，已超过 ${JS_ERROR_KB}KB，建议拆分为新的自开发包，避免影响页面加载性能。`,
        );
      } else {
        log.warning(`${file} 体积为 ${size} KB，已超过 ${JS_WARN_KB}KB，建议关注或拆分。`);
      }
    });
  }

  // 拷贝配置文件
  shell.cp("-R", configPath, `${outputPath}/`);

  // 拷贝资源文件
  apaasConfig.copyAssets.forEach((copyAsset) => {
    const assetPath = resolvePath(copyAsset);
    const outputAsset = resolvePath(
      outputPath,
      copyAsset.replace("public/", "static/"),
    );
    shell.mkdir("-p", outputAsset);
    shell.cp("-R", `${assetPath}/*`, `${outputAsset}/`);
  });

  // 清理已有压缩包
  fs.existsSync(outputZipPath) && shell.rm(outputZipPath);

  // 生成并压缩
  zipper.zip(outputPath, (error, zipped) => {
    if (error) {
      shell.rm("-r", outputPath);
      exitWithError(`生成压缩包失败: ${error}`);
      return;
    }

    zipped.compress();
    const size = (zipped.memory().length / 1024 / 1024).toFixed(2);

    zipped.save(outputZipPath, (error) => {
      if (error) {
        shell.rm("-r", outputPath);
        exitWithError(`保存压缩包失败: ${error}`);
        return;
      }

      log.success(`构建 ${outputName} 成功！压缩包大小: ${size} MB`);
      shell.rm("-r", outputPath);
    });
  });
}

// 直接使用解构赋值处理参数
const [, , customModule, ...argv] = process.argv;
build(customModule, argv);
```

> 说明：两个脚本均假定模块位于 `apps/<模块名>/`（可在 `common.cjs` 的 `loadApaasConfig` 中调整路径）；`build.cjs` 只构建一次、用于打上传包，热更新场景请使用 `run.cjs`。npm scripts 建议：`"dev": "node scripts/run.cjs"`、`"build": "node scripts/build.cjs"`。
