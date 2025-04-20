// import JSZip from "jszip"
// import { v4 as uuidv4 } from "uuid"

// export const processZipFile = async (file: File): Promise<Package | null> => {
//   try {
//     const zip = new JSZip()
//     const contents = await zip.loadAsync(file)

//     // Check for apaas.json file
//     const apaasJsonFile = contents.file("apaas.json")
//     if (!apaasJsonFile) {
//       throw new Error("Missing apaas.json file in the zip package")
//     }

//     // Parse apaas.json to get configuration
//     const apaasJsonContent = await apaasJsonFile.async("text")
//     const config: ApaasConfig = JSON.parse(apaasJsonContent)

//     if (!config.outputName) {
//       throw new Error("Missing outputName in apaas.json")
//     }

//     // Process all files in the zip
//     const files: Record<string, ArrayBuffer> = {}
//     const promises: Promise<void>[] = []

//     contents.forEach((path, file) => {
//       if (!file.dir) {
//         // const promise = file.async("blob").then((blob) => {
//         //   const url = URL.createObjectURL(blob)
//         //   files[path] = url
//         // })
//         const promise = file.async("arraybuffer").then((buffer) => {
//           files[path] = buffer
//         })

//         console.log("Processing file:", path, promise)
//         promises.push(promise)
//       }
//     })

//     await Promise.all(promises)

//     return {
//       id: uuidv4(),
//       name: file.name.replace(".zip", ""),
//       files,
//       config,
//       uploadedAt: Date.now()
//     }
//   } catch (error) {
//     console.error("Error processing zip file:", error)
//     return null
//   }
// }

// export const extractCssJsFiles = (
//   pkg: Package
// ): { cssFile?: string; jsFile?: string } => {
//   const { outputName } = pkg.config
//   const jsPattern = new RegExp(`${outputName}\\.(umd|esm|cjs)\\.js$`)
//   const cssPattern = new RegExp(`${outputName}\\.css$`)

//   let cssFile: string | undefined
//   let jsFile: string | undefined

//   Object.entries(pkg.files).forEach(([filename, url]) => {
//     if (cssPattern.test(filename)) {
//       cssFile = url
//     } else if (jsPattern.test(filename)) {
//       jsFile = url
//     }
//   })

//   return { cssFile, jsFile }
// }

// export const revokePackageUrls = (pkg: Package): void => {
//   Object.values(pkg.files).forEach((url) => {
//     URL.revokeObjectURL(url)
//   })
// }

import JSZip from "jszip"
import { v4 as uuidv4 } from "uuid"

import type { ApaasConfig, Package } from "../types"

declare global {
  interface Window {
    __virtualFSPackages?: Map<string, Record<string, Blob>>
  }
}

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
    const files: Record<string, ArrayBuffer | string> = {}
    const promises: Promise<void>[] = []

    contents.forEach((path, fileEntry) => {
      if (!fileEntry.dir) {
        console.log("fileEntry", fileEntry)
        // const promise = fileEntry.async("arraybuffer").then((buffer) => {
        //   files[path] = buffer
        // })
        const promise = fileEntry.async("base64").then((f) => {
          files[path] = f
        })
        promises.push(promise)
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



// export const extractCssJsFiles = (
//   pkg: Package
// ): { cssFile?: string; jsFile?: string } => {
//   const { outputName } = pkg.config
//   const jsPattern = new RegExp(`${outputName}\\.(umd|esm|cjs)\\.js$`)
//   const cssPattern = new RegExp(`${outputName}\\.css$`)

//   let cssFile: string | undefined
//   let jsFile: string | undefined

//   Object.entries(pkg.files).forEach(([filename, url]) => {

//     if (cssPattern.test(filename)) {
//       const blob = new Blob([arrayBuffer], {type: 'image/png'});
// const blobUrl = URL.createObjectURL(blob);
//       cssFile =
//     } else if (jsPattern.test(filename)) {
//       jsFile = url
//     }
//   })

//   return { cssFile, jsFile }
// }

// export const revokePackageUrls = (pkg: Package): void => {
//   Object.values(pkg.files).forEach((url) => {
//     URL.revokeObjectURL(url)
//   })
// }

/**
 * 创建虚拟文件系统Blob URL
 * @param pkg 包对象
 * @returns 返回虚拟文件系统的根URL
 */
export const createVirtualFSBlobUrl = (pkg: Package): string => {
  // 转换ArrayBuffer为Blob并设置正确的MIME类型
  const virtualFS: Record<string, Blob> = {}

  Object.entries(pkg.files).forEach(([path, buffer]) => {
    const mimeType = getMimeTypeFromPath(path)
    virtualFS[path] = new Blob([buffer], { type: mimeType })
  })

  // 创建文件系统清单
  const manifest = {
    version: "1.0",
    packageName: pkg.name,
    files: Object.keys(virtualFS),
    createdAt: new Date().toISOString()
  }

  // 将清单添加到虚拟文件系统
  virtualFS["/__manifest.json"] = new Blob([JSON.stringify(manifest)], {
    type: "application/json"
  })

  // 初始化全局注册表
  if (!window.__virtualFSPackages) {
    window.__virtualFSPackages = new Map()
  }

  // 生成唯一ID作为虚拟文件系统标识
  const fsId = `virtualfs-${uuidv4()}`
  const rootUrl = `blob:${fsId}`

  // 将虚拟文件系统存入注册表
  window.__virtualFSPackages.set(rootUrl, virtualFS)

  return rootUrl
}

/**
 * 从虚拟文件系统中获取文件Blob URL
 * @param rootUrl 虚拟文件系统根URL
 * @param filePath 文件路径
 * @returns 返回文件的Blob URL
 */
export const getFileFromVirtualFS = (
  rootUrl: string,
  filePath: string
): string => {
  if (!window.__virtualFSPackages?.has(rootUrl)) {
    throw new Error("虚拟文件系统未找到")
  }

  const virtualFS = window.__virtualFSPackages.get(rootUrl)!

  // 标准化路径（移除开头斜杠）
  const normalizedPath = filePath.startsWith("/") ? filePath.slice(1) : filePath

  if (!virtualFS[normalizedPath]) {
    throw new Error(`文件 ${filePath} 在虚拟文件系统中不存在`)
  }

  return URL.createObjectURL(virtualFS[normalizedPath])
}

/**
 * 释放虚拟文件系统资源
 * @param rootUrl 虚拟文件系统根URL
 */
export const revokeVirtualFS = (rootUrl: string): void => {
  if (!window.__virtualFSPackages?.has(rootUrl)) return

  // 释放所有文件的Blob URL
  const virtualFS = window.__virtualFSPackages.get(rootUrl)!
  Object.values(virtualFS).forEach((blob) => {
    URL.revokeObjectURL(URL.createObjectURL(blob))
  })

  // 从注册表中移除
  window.__virtualFSPackages.delete(rootUrl)
}

/**
 * 根据文件路径获取MIME类型
 * @param path 文件路径
 * @returns 返回对应的MIME类型
 */
function getMimeTypeFromPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() || ""

  const mimeTypes: Record<string, string> = {
    js: "application/javascript",
    json: "application/json",
    css: "text/css",
    html: "text/html",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    txt: "text/plain",
    md: "text/markdown"
  }

  return mimeTypes[extension] || "application/octet-stream"
}

// 使用示例：
// 1. 处理上传的zip文件
// const pkg = await processZipFile(zipFile)
//
// 2. 创建虚拟文件系统
// const rootUrl = createVirtualFSBlobUrl(pkg)
// console.log(rootUrl) // 输出: blob:virtualfs-xxxxxx
//
// 3. 访问具体文件
// const jsFileUrl = getFileFromVirtualFS(rootUrl, "apaas-custom-shipboard-electricity.umd.js")
// const imageUrl = getFileFromVirtualFS(rootUrl, "static/custom/apaas-custom-shipboard-electricity/a.png")
//
// 4. 使用完成后释放资源
// revokeVirtualFS(rootUrl)
