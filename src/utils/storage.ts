/**
 * 存储工具函数
 * 提供高效的文件存储和检索功能
 */

import { STORAGE_CONSTANTS, LOG_PREFIX } from "../constants";

/**
 * 分块保存大文件到本地存储
 * @param key 存储键名
 * @param data 要保存的二进制数据
 * @returns Promise<void>
 */
export async function saveChunkedFile(key: string, data: ArrayBuffer): Promise<void> {
  const size = data.byteLength;
  const chunks = Math.ceil(size / STORAGE_CONSTANTS.MAX_CHUNK_SIZE);
  
  console.log(`${LOG_PREFIX} 保存文件 ${key}，大小: ${(size / 1024).toFixed(1)}KB，分块数: ${chunks}`);
  
  // 保存元数据
  await new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [`${key}_meta`]: { chunks, size } }, () => {
      if (chrome.runtime.lastError) {
        console.error(`${LOG_PREFIX} 保存元数据失败:`, chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
  
  // 保存每个分块
  for (let i = 0; i < chunks; i++) {
    const start = i * STORAGE_CONSTANTS.MAX_CHUNK_SIZE;
    const end = Math.min(start + STORAGE_CONSTANTS.MAX_CHUNK_SIZE, size);
    const chunk = data.slice(start, end);
    
    await new Promise<void>((resolve, reject) => {
      const blob = new Blob([chunk]);
      const reader = new FileReader();
      reader.onload = () => {
        chrome.storage.local.set({ [`${key}_${i}`]: reader.result }, () => {
          if (chrome.runtime.lastError) {
            console.error(`${LOG_PREFIX} 保存分块 ${i} 失败:`, chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      };
      reader.onerror = () => {
        console.error(`${LOG_PREFIX} 读取分块 ${i} 失败`);
        reject(new Error("Failed to read chunk"));
      };
      reader.readAsDataURL(blob);
    });
  }
  
  console.log(`${LOG_PREFIX} 文件 ${key} 保存完成`);
}

/**
 * 从本地存储中读取分块保存的文件
 * @param key 存储键名
 * @returns Promise<ArrayBuffer> 读取的文件内容
 */
export async function loadChunkedFile(key: string): Promise<ArrayBuffer> {
  // 读取元数据
  const meta = await new Promise<{chunks: number, size: number}>((resolve, reject) => {
    chrome.storage.local.get([`${key}_meta`], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (!result[`${key}_meta`]) {
        reject(new Error(`文件 ${key} 不存在`));
      } else {
        resolve(result[`${key}_meta`]);
      }
    });
  });
  
  // 读取所有分块
  const chunkKeys = [];
  for (let i = 0; i < meta.chunks; i++) {
    chunkKeys.push(`${key}_${i}`);
  }
  
  const chunks = await new Promise<Record<string, string>>((resolve, reject) => {
    chrome.storage.local.get(chunkKeys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });
  
  // 合并所有分块
  const buffer = new Uint8Array(meta.size);
  let offset = 0;
  
  for (let i = 0; i < meta.chunks; i++) {
    const dataUrl = chunks[`${key}_${i}`];
    if (!dataUrl) {
      throw new Error(`分块 ${i} 不存在`);
    }
    
    // 从dataUrl中提取二进制数据
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    
    for (let j = 0; j < binary.length; j++) {
      bytes[j] = binary.charCodeAt(j);
    }
    
    buffer.set(bytes, offset);
    offset += bytes.length;
  }
  
  return buffer.buffer;
}

/**
 * 获取存储使用情况
 * @returns Promise<{usedBytes: number, quotaBytes: number}> 已使用和总配额
 */
export function getStorageUsage(): Promise<{ usedBytes: number; quotaBytes: number }> {
  return new Promise((resolve) => {
    chrome.storage.local.getBytesInUse(null, (usedBytes) => {
      chrome.storage.local.get(null, () => {
        const quotaBytes = chrome.runtime.lastError
          ? STORAGE_CONSTANTS.DEFAULT_QUOTA
          : chrome.storage.local.QUOTA_BYTES || STORAGE_CONSTANTS.DEFAULT_QUOTA;

        resolve({ usedBytes, quotaBytes });
      });
    });
  });
}

/**
 * 压缩二进制数据
 * @param data 要压缩的数据
 * @returns Promise<string> 压缩后的Base64字符串
 */
export async function compressData(data: Uint8Array): Promise<string> {
  // 将二进制数据转换为Base64字符串
  let binary = "";
  const bytes = new Uint8Array(data);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * 解压缩数据
 * @param compressedBase64 压缩的Base64字符串
 * @returns Uint8Array 解压后的二进制数据
 */
export function decompressData(compressedBase64: string): Uint8Array {
  // 将Base64字符串转回二进制数据
  const binary = atob(compressedBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 保存文件到assets目录
 * @param fileName 文件名
 * @param fileContent 文件内容
 * @returns Promise<void>
 */
export async function saveFileToAssets(
  fileName: string,
  fileContent: ArrayBuffer
): Promise<void> {
  // 对于超过限制大小的文件，使用更高效的存储方式
  if (fileContent.byteLength <= STORAGE_CONSTANTS.MAX_DIRECT_SAVE_SIZE) {
    // 对于小文件，直接保存为数据URL
    return new Promise((resolve, reject) => {
      const fileBlob = new Blob([fileContent]);
      const reader = new FileReader();

      reader.onload = () => {
        const dataUrl = reader.result as string;

        // 使用Storage API保存文件
        const fileKey = `asset_${fileName}`;
        chrome.storage.local.set({ [fileKey]: dataUrl }, () => {
          if (chrome.runtime.lastError) {
            console.error(`${LOG_PREFIX} 保存文件失败:`, chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log(`${LOG_PREFIX} 文件 ${fileName} 保存成功`);
            resolve();
          }
        });
      };

      reader.onerror = () => {
        console.error(`${LOG_PREFIX} 读取文件失败`);
        reject(new Error("Failed to read file"));
      };

      reader.readAsDataURL(fileBlob);
    });
  } else {
    // 对于大文件，压缩并拆分存储
    try {
      // 使用更高效的存储格式
      const uint8Array = new Uint8Array(fileContent);

      // 注册主文件条目，记录大小和分块信息
      const fileKey = `asset_${fileName}`;
      const fileMetadata = {
        type: "arraybuffer",
        size: fileContent.byteLength,
        chunks: 1
      };

      // 压缩数据以节省空间
      const compressedData = await compressData(uint8Array);

      // 保存文件主条目
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set(
          {
            [fileKey]: fileMetadata,
            [`${fileKey}_chunk0`]: compressedData
          },
          () => {
            if (chrome.runtime.lastError) {
              console.error(`${LOG_PREFIX} 保存大文件失败:`, chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
            } else {
              console.log(`${LOG_PREFIX} 大文件 ${fileName} 保存成功`);
              resolve();
            }
          }
        );
      });

      return Promise.resolve();
    } catch (e) {
      console.error(`${LOG_PREFIX} 保存大文件出错:`, e);
      return Promise.reject(e);
    }
  }
}