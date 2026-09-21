const path = require("path")
const chalk = require("chalk")

// 日志工具
const log = {
  info: (msg) => console.log(chalk.cyan(`【信息】${msg}`)),
  success: (msg) => console.log(chalk.green(`【成功】${msg}`)),
  error: (msg) => console.error(chalk.red(`【错误】${msg}`)),
  warning: (msg) => console.warn(chalk.yellow(`【警告】${msg}`)),
}

// 路径处理辅助函数
const resolvePath = (...args) => path.resolve(process.cwd(), ...args)

// 错误处理函数
const exitWithError = (message) => {
  log.error(message)
  process.exit(0)
}

module.exports = { log, resolvePath, exitWithError }
