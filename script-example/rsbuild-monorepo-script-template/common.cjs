/**
 * rsbuild monorepo 模板专属配置（差异点 1：apaas.json 解析路径）
 * 模块位于 apps/<模块名>/，产物在 zip/<outputName>/
 */
const fs = require("fs")
const path = require("path")

const { resolvePath, exitWithError } = require("../lib/utils.cjs")

/**
 * 加载并验证 apps/<模块名>/ 下的 apaas.json
 * @param {string} customModule 模块名
 * @param {string} [apaasJson] 自定义配置文件名（默认 apaas.json）
 */
function loadApaasConfig(customModule, apaasJson = "apaas.json") {
  const customModulePath = resolvePath("apps", customModule)
  const configPath = resolvePath(customModulePath, apaasJson)

  if (!fs.existsSync(configPath)) {
    exitWithError(`自开发模块 ${customModule} 下不存在需要的 ${apaasJson} 文件`)
  }

  let apaasConfig
  try {
    apaasConfig = JSON.parse(fs.readFileSync(configPath))
  } catch (err) {
    exitWithError(`配置文件解析失败: ${err.message}`)
  }

  return { customModulePath, configPath, apaasConfig }
}

/**
 * 验证 apaas.json 指定的入口文件
 */
function validateEntry(customModulePath, entry) {
  const entryPath = resolvePath(customModulePath, entry)

  if (!fs.existsSync(entryPath)) {
    exitWithError(`apaas.json 指定的 entry: ${entry} 的路径错误\nerror path is ${entryPath}`)
  }

  return entryPath
}

module.exports = { loadApaasConfig, validateEntry, path }
