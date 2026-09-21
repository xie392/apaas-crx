#!/usr/bin/env node
/**
 * rsbuild 单仓单次构建打 ZIP 上传包
 * 差异点：模块路径 src/custom/<模块名>/apaas.json，产物目录 <outputName>/
 * 公共能力（日志/清理/资源拷贝/体积告警/打 ZIP）见 ../lib/
 */
const fs = require("fs")
const path = require("path")
const shell = require("shelljs")

const { log, exitWithError, resolvePath } = require("../lib/utils.cjs")
const { cleanPath, copyConfigAndAssets, reportJsSize, makeZip } = require("../lib/build-utils.cjs")

async function build() {
  const [, , customModule, ...argv] = process.argv

  if (!customModule) exitWithError("请提供自定义模块名称")

  const customModulePath = resolvePath("src/custom", customModule)
  const configPath = path.resolve(customModulePath, "apaas.json")

  if (!fs.existsSync(configPath)) exitWithError(`自开发模块 ${customModule} 下不存在需要的 apaas.json 文件`)

  const apaasConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"))
  const entryPath = path.resolve(customModulePath, apaasConfig.entry)

  if (!fs.existsSync(entryPath)) exitWithError(`apaas.json 指定的 entry: ${apaasConfig.entry} 的路径错误: ${entryPath}`)

  const outputPath = resolvePath(apaasConfig.outputName)
  const outputZipPath = resolvePath(`${apaasConfig.outputName}.zip`)

  cleanPath(outputPath)

  process.env.PUBLIC_ENTRY = entryPath
  process.env.PUBLIC_OUTPUT_NAME = customModule

  const buildCmd = `npx rslib build ${argv?.join(" ") ?? ""}`
  log.info(`构建命令: ${buildCmd}`)

  const buildResult = shell.exec(buildCmd)
  if (buildResult.code !== 0) {
    exitWithError("构建失败，无法生成压缩包。请检查构建日志获取更多信息。")
  }
  log.success(`构建 ${customModule} 模块成功！`)

  reportJsSize(outputPath)
  copyConfigAndAssets({ configPath, apaasConfig, outputPath })
  await makeZip({ outputPath, outputZipPath })
  log.success(`构建 ${apaasConfig.outputName} 成功！`)
}

build()
