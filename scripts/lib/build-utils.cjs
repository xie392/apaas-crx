const fs = require("fs")
const shell = require("shelljs")
const zipper = require("zip-local")
const chalk = require("chalk")
const { log, resolvePath } = require("./utils.cjs")

/**
 * 清理输出路径（文件或目录）
 */
function cleanPath(target) {
  if (fs.existsSync(target)) {
    fs.lstatSync(target).isDirectory() ? shell.rm("-rf", target) : shell.rm(target)
  }
}

/**
 * 拷贝 apaas.json 配置文件和 public 静态资源到产物目录
 * public/ 前缀的资源会映射为产物目录下的 static/
 */
function copyConfigAndAssets({ configPath, apaasConfig, outputPath }) {
  shell.cp("-R", configPath, `${outputPath}/`)

  ;(apaasConfig.copyAssets || []).forEach((copyAsset) => {
    const assetPath = resolvePath(copyAsset)
    const outputAsset = resolvePath(outputPath, copyAsset.replace("public/", "static/"))
    shell.mkdir("-p", outputAsset)
    shell.cp("-R", `${assetPath}/*`, `${outputAsset}/`)
  })
}

/**
 * 统计 JS 产物体积并告警
 * 超过 1MB 红色警告建议拆包，超过 500KB 黄色提示关注
 */
function reportJsSize(outputPath, { warnKb = 500, errorKb = 1024 } = {}) {
  if (!fs.existsSync(outputPath)) return

  log.info("构建产物大小统计:")
  shell.ls("-R", outputPath).forEach((file) => {
    const filePath = resolvePath(outputPath, file)
    if (!fs.existsSync(filePath) || !fs.lstatSync(filePath).isFile()) return

    const sizeKb = fs.statSync(filePath).size / 1024
    const size = sizeKb.toFixed(2)
    if (file.endsWith(".js") && sizeKb >= errorKb) {
      console.log(chalk.red(`  ${file}: ${size} KB`))
      log.error(`${file} 体积为 ${size} KB，已超过 ${errorKb}KB，建议拆分为新的自开发包，避免影响页面加载性能。`)
    } else if (file.endsWith(".js") && sizeKb >= warnKb) {
      console.log(chalk.yellow(`  ${file}: ${size} KB`))
      log.warning(`${file} 体积为 ${size} KB，已超过 ${warnKb}KB，建议关注或拆分。`)
    } else {
      log.info(`  ${file}: ${size} KB`)
    }
  })
}

/**
 * 打 ZIP 上传包，完成后删除产物目录
 * @returns {Promise<string>} 压缩包大小（MB）
 */
function makeZip({ outputPath, outputZipPath }) {
  return new Promise((resolve, reject) => {
    zipper.zip(outputPath, (error, zipped) => {
      if (error) {
        shell.rm("-r", outputPath)
        reject(new Error(`生成压缩包失败: ${error}`))
        return
      }

      zipped.compress()
      const size = (zipped.memory().length / 1024 / 1024).toFixed(2)

      zipped.save(outputZipPath, (error) => {
        if (error) {
          shell.rm("-r", outputPath)
          reject(new Error(`保存压缩包失败: ${error}`))
          return
        }
        log.success(`压缩包大小: ${size} MB`)
        shell.rm("-r", outputPath)
        resolve(size)
      })
    })
  })
}

module.exports = { cleanPath, copyConfigAndAssets, reportJsSize, makeZip }
