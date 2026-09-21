#!/usr/bin/env node
/**
 * rsbuild monorepo 单次构建打 ZIP 上传包
 * 差异点：模块路径 apps/<模块名>/apaas.json，产物目录 zip/<outputName>/
 * 公共能力（日志/清理/资源拷贝/体积告警/打 ZIP）见 ../lib/
 */
const { log, exitWithError, resolvePath } = require("../lib/utils.cjs")
const { cleanPath, copyConfigAndAssets, reportJsSize, makeZip } = require("../lib/build-utils.cjs")
const { loadApaasConfig, validateEntry, buildRslibCommand, extractCustomArgs } = require("./common.cjs")

async function build() {
  const [, , customModule, ...argv] = process.argv
  const { filteredArgv, extracted } = extractCustomArgs(argv)

  if (!customModule) exitWithError("请提供自定义模块名称")

  const { customModulePath, configPath, apaasConfig } =
    loadApaasConfig(customModule, extracted?.name ?? "apaas.json")
  const entryPath = validateEntry(customModulePath, apaasConfig.entry)
  const outputPath = resolvePath("zip", apaasConfig.outputName)
  const outputZipPath = resolvePath(`zip/${apaasConfig.outputName}.zip`)

  cleanPath(outputPath)

  process.env.PUBLIC_ENTRY = entryPath
  process.env.PUBLIC_OUTPUT_NAME = apaasConfig.outputName
  process.env.PUBLIC_CUSTOM_ARGS = JSON.stringify(extracted)

  const buildCmd = `npx ${buildRslibCommand(customModulePath, filteredArgv).join(" ")}`
  log.info(`构建命令: ${buildCmd}`)

  const buildResult = require("shelljs").exec(buildCmd)
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
