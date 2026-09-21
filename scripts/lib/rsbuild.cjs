/**
 * rslib/RSBuild 构建相关公共工具
 */
const fs = require("fs")
const { resolvePath } = require("./utils.cjs")

// 动态配置：需要提取的自定义属性列表（可扩展）
const CUSTOM_ARGS = ["name"]

/**
 * 提取并过滤命令行参数（如 --name=xxx / -name xxx）
 */
function extractCustomArgs(args, customArgs = CUSTOM_ARGS) {
  const result = { filteredArgv: [], extracted: {} }
  const excluded = new Set(customArgs.map((arg) => [`-${arg}`, `--${arg}`]).flat())

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const eqMatch = arg.match(/^--?([a-zA-Z-]+)=(.+)$/)
    const simpleMatch = arg.match(/^--?([a-zA-Z-]+)$/)

    // 处理 -name=value 或 --name=value 格式
    if (eqMatch) {
      const key = eqMatch[1]
      const value = eqMatch[2]
      if (customArgs.includes(key)) {
        result.extracted[key] = value
        continue
      }
      result.filteredArgv.push(arg)
      continue
    }

    // 处理 -name value 格式
    if (simpleMatch) {
      const key = simpleMatch[1]
      if (customArgs.includes(key)) {
        const nextArg = args[i + 1]
        if (nextArg && !nextArg.startsWith("-")) {
          result.extracted[key] = nextArg
          i++ // 跳过下一个参数
          continue
        }
        result.extracted[key] = "" // 没有值时设为空字符串
        continue
      }
    }

    result.filteredArgv.push(arg)
  }

  return result
}

/**
 * 拼装 rslib 构建命令
 * @param {string} customModulePath 模块路径（用于探测其下的 rslib.config.ts）
 * @param {string[]} argv 透传的额外参数
 * @param {boolean} isWatch 是否 watch 模式
 */
function buildRslibCommand(customModulePath, argv = [], isWatch = false) {
  const rslibConfigPath = resolvePath(customModulePath, "rslib.config.ts")
  const hasConfig = fs.existsSync(rslibConfigPath)
  const baseCmd = ["rslib", "build"]
  if (isWatch) baseCmd.push("-w")
  if (hasConfig) baseCmd.push("-c", rslibConfigPath)

  if (argv.length > 0) baseCmd.push(...argv)

  return baseCmd
}

module.exports = { extractCustomArgs, buildRslibCommand }
