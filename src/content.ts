import type { PlasmoCSConfig } from "plasmo";

// 配置内容脚本的匹配规则
export const config: PlasmoCSConfig = {
  matches: ["http://gscrm-ycdl-fw-jsfw.yctp.yuchaiqas.com/*"]
};

// 在页面加载时将URL处理函数注入到页面中
function injectURLHandlerScript() {
  const script = document.createElement('script');
  script.textContent = `
    // 拦截所有的资源请求，并尝试检查是否需要从扩展资源中获取
    (function() {
      // 保存原始的fetch方法
      const originalFetch = window.fetch;
      
      // 重写fetch方法
      window.fetch = async function(resource, options) {
        const url = resource instanceof Request ? resource.url : resource;
        
        // 检查URL是否匹配我们要替换的资源
        if (typeof url === 'string' && 
            (url.includes('.umd.js') || 
             url.includes('.css') || 
             url.includes('.worker.js') ||
             url.includes('static/') || 
             url.includes('public/'))) {
          
          console.log('[APaaS Injector] Intercepted fetch request:', url);
          
          // 告诉扩展后台我们请求了这个URL，看它是否需要被替换
          try {
            const message = { type: 'CHECK_RESOURCE', url };
            const response = await new Promise(resolve => {
              window.postMessage(message, '*');
              
              // 设置一个监听器来等待扩展的响应
              const listener = event => {
                if (event.data && event.data.type === 'RESOURCE_RESPONSE' && event.data.forUrl === url) {
                  window.removeEventListener('message', listener);
                  resolve(event.data);
                }
              };
              
              window.addEventListener('message', listener);
              
              // 5秒超时后继续原始请求
              setTimeout(() => {
                window.removeEventListener('message', listener);
                resolve({ replace: false });
              }, 5000);
            });
            
            if (response.replace && response.dataUrl) {
              console.log('[APaaS Injector] Using replaced resource for:', url);
              // 从扩展返回的DataURL创建一个响应
              const blob = await fetch(response.dataUrl).then(r => r.blob());
              return new Response(blob);
            }
          } catch (e) {
            console.error('[APaaS Injector] Error checking resource:', e);
          }
        }
        
        // 默认使用原始fetch
        return originalFetch.apply(this, arguments);
      };
      
      // 保存原始的XMLHttpRequest.prototype.open方法
      const originalXHROpen = XMLHttpRequest.prototype.open;
      const originalXHRSend = XMLHttpRequest.prototype.send;
      
      // 重写XMLHttpRequest.prototype.open
      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (typeof url === 'string' && 
            (url.includes('.umd.js') || 
             url.includes('.css') || 
             url.includes('.worker.js') ||
             url.includes('static/') || 
             url.includes('public/'))) {
          
          console.log('[APaaS Injector] Intercepted XHR request:', url);
          this._apaasUrl = url;
        }
        
        return originalXHROpen.apply(this, [method, url, ...args]);
      };
      
      // 重写XMLHttpRequest.prototype.send
      XMLHttpRequest.prototype.send = function(...args) {
        if (this._apaasUrl) {
          // 这里可以检查是否需要替换，但实现比较复杂，
          // 因为XHR是同步的，而我们的消息传递是异步的
          // 在真实实现中，你可能需要使用更复杂的方法
        }
        
        return originalXHRSend.apply(this, args);
      };
      
      console.log('[APaaS Injector] Resource interception initialized');
    })();
  `;
  
  document.documentElement.appendChild(script);
  script.remove();
  
  console.log("Injected URL handler script");
}

// 处理从页面发来的消息
window.addEventListener('message', async (event) => {
  // 我们只处理来自当前页面的消息
  if (event.source !== window) return;
  
  const data = event.data;
  if (!data || data.type !== 'CHECK_RESOURCE') return;
  
  // 检查URL是否匹配我们保存的资源
  const url = data.url;
  const fileName = getFileNameFromUrl(url);
  
  // 向扩展背景页发送消息，查询是否有缓存的资源
  chrome.runtime.sendMessage({ action: "getResource", fileName }, (response) => {
    if (response && response.exists) {
      // 如果资源存在，我们向页面发送消息
      window.postMessage({
        type: 'RESOURCE_RESPONSE',
        forUrl: url,
        replace: true,
        dataUrl: response.dataUrl
      }, '*');
    } else {
      // 如果资源不存在，我们通知页面继续原始请求
      window.postMessage({
        type: 'RESOURCE_RESPONSE',
        forUrl: url,
        replace: false
      }, '*');
    }
  });
});

// 从URL中提取文件名
function getFileNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const fileName = pathParts[pathParts.length - 1];
    return fileName;
  } catch (e) {
    // 如果URL解析失败，我们尝试使用正则表达式提取最后一部分
    const matches = url.match(/([^/]+)$/);
    return matches ? matches[1] : url;
  }
}

// 当DOM加载完成后执行脚本注入
document.addEventListener('DOMContentLoaded', injectURLHandlerScript);

// 立即执行脚本注入，以防DOMContentLoaded已经触发
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  injectURLHandlerScript();
} 