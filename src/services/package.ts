import JSZip from "jszip"
import { v4 as uuidv4 } from "uuid"

import type { ApaasConfig, Package } from "~types"

/**
 * 处理上传的zip文件
 * @param file 上传的zip文件对象
 * @returns 返回解析后的包对象
 */
export const processZipFile = async (file: File): Promise<Package | null> => {
  try {
    const zip = new JSZip()
    const contents = await zip.loadAsync(file)

    // 检查apaas.json配置文件是否存在
    const apaasJsonFile = contents.file("apaas.json")
    if (!apaasJsonFile) {
      throw new Error("ZIP包中缺少apaas.json配置文件")
    }

    // 解析apaas.json配置
    const apaasJsonContent = await apaasJsonFile.async("text")
    const config: ApaasConfig = JSON.parse(apaasJsonContent)

    if (!config.outputName) {
      throw new Error("apaas.json中缺少outputName配置")
    }

    // 处理zip包中的所有文件
    const files: Record<string, ArrayBuffer> = {}
    const promises: Promise<void>[] = []


    contents.forEach((path, fileEntry) => {
      if (!fileEntry.dir) {

        // console.log("处理zip包中的所有文件", path, fileEntry)
        const type = fileEntry.name?.split(".").pop()
        // const name = fileEntry.name?.split(".").shift()
        // && name === config.outputName
        // if (["js", "css"].includes(type)) {
        const promise = fileEntry.async("arraybuffer").then((buffer) => {
          files[path] = buffer
        })
        promises.push(promise)
        // }
      }
    })

    await Promise.all(promises)

    return {
      id: uuidv4(),
      name: file.name,
      files,
      config,
      uploadedAt: Date.now()
    }
  } catch (error) {
    console.error("处理ZIP文件出错:", error)
    return null
  }
}
