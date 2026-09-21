const fs = require('fs')
const shell = require('shelljs')
const path = require('path')
const zipper = require('zip-local')

function build(customModule, argv) {
  // 获取指定 custom 目录下的apaas.json
  const customModulePath = path.resolve(`${process.cwd()}`, 'src/custom', customModule)
  const customModuleConfigPath = path.resolve(customModulePath, 'apaas.json')

  if (!fs.existsSync(customModuleConfigPath)) {
    console.log(`Error: 自开发模块 ${customModule} 下不存在需要的 apass.json 文件`['red'])
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

  // 写入 html 文件, 这个文件并没有什么卵用
  // const htmlContent = `<meta charset="utf-8">
  // <title>${customModule} demo</title>
  // <script src="./${customModule}.umd.js"></script>
  // <link rel="stylesheet" href="./${customModule}.css">`
  // const htmlPath = path.resolve(`${process.cwd()}`, `${apaasConfig.outputName}/demo.html`)
  // fs.writeFileSync(htmlPath, htmlContent, 'utf-8')

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
            `构建 ${apaasConfig.outputName} 成功！压缩包大小: ${(buff.length / 1024 / 1024).toFixed(
              2
            )} MB`
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
