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
 * @param {*} args
 * @param {*} customArgs
 * @returns { filteredArgv: 过滤后的参数数组, extracted: 提取的自定义属性对象 }
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

  // 提取并排除自定义的属性
//   const { filteredArgv, extracted } = extractCustomArgs(argv);
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
