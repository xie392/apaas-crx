// 存储工具
export const MAX_CHUNK_SIZE = 1024 * 1024; // 1MB (原来是500KB)

// 分块保存大文件
export async function saveChunkedFile(key: string, data: ArrayBuffer): Promise<void> {
  const size = data.byteLength;
  const chunks = Math.ceil(size / MAX_CHUNK_SIZE);
  
  // 保存元数据
  await new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [`${key}_meta`]: { chunks, size } }, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
  
  // 保存每个分块
  for (let i = 0; i < chunks; i++) {
    const start = i * MAX_CHUNK_SIZE;
    const end = Math.min(start + MAX_CHUNK_SIZE, size);
    const chunk = data.slice(start, end);
    
    await new Promise<void>((resolve, reject) => {
      const blob = new Blob([chunk]);
      const reader = new FileReader();
      reader.onload = () => {
        chrome.storage.local.set({ [`${key}_${i}`]: reader.result }, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      };
      reader.onerror = () => reject(new Error("Failed to read chunk"));
      reader.readAsDataURL(blob);
    });
  }
}