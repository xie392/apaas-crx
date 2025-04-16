// 拦截所有的资源请求，并尝试检查是否需要从扩展资源中获取
(function() {
  // 定义常量
  const LOG_PREFIX = '[APaaS Injector]';
  const RESOURCE_PATTERNS = [
    '.umd.js',
    '.css',
    '.worker.js',
    'static/',
    'public/'
  ];
  const MESSAGE_TYPES = {
    CHECK_RESOURCE: 'CHECK_RESOURCE',
    RESOURCE_RESPONSE: 'RESOURCE_RESPONSE'
  };
  const TIMEOUT_SETTINGS = {
    FETCH_TIMEOUT: 5000,
    XHR_TIMEOUT: 2000
  };
  
  // 保存原始的fetch方法
  const originalFetch = window.fetch;
  
  // 重写fetch方法
  window.fetch = async function(resource, options) {
    const url = resource instanceof Request ? resource.url : resource;
    
    // 检查URL是否匹配我们要替换的资源
    if (typeof url === 'string' && 
        RESOURCE_PATTERNS.some(pattern => url.includes(pattern))) {
      
      console.log(`${LOG_PREFIX} Intercepted fetch request:`, url);
      
      // 告诉扩展后台我们请求了这个URL，看它是否需要被替换
      try {
        const message = { type: MESSAGE_TYPES.CHECK_RESOURCE, url };
        const response = await new Promise(resolve => {
          window.postMessage(message, '*');
          
          // 设置一个监听器来等待扩展的响应
          const listener = event => {
            if (event.data && event.data.type === MESSAGE_TYPES.RESOURCE_RESPONSE && event.data.forUrl === url) {
              window.removeEventListener('message', listener);
              resolve(event.data);
            }
          };
          
          window.addEventListener('message', listener);
          
          // 设置超时后继续原始请求
          setTimeout(() => {
            window.removeEventListener('message', listener);
            resolve({ replace: false });
          }, TIMEOUT_SETTINGS.FETCH_TIMEOUT);
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
        RESOURCE_PATTERNS.some(pattern => url.includes(pattern))) {
      
      console.log(`${LOG_PREFIX} Intercepted XHR request:`, url);
      this._apaasUrl = url;
    }
    
    return originalXHROpen.apply(this, [method, url, ...args]);
  };
  
  // 重写XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function(...args) {
    if (this._apaasUrl) {
      // 实现XHR请求的资源替换
      const url = this._apaasUrl;
      const xhr = this;
      
      // 创建一个Promise来检查资源
      const checkResource = new Promise(resolve => {
        const message = { type: MESSAGE_TYPES.CHECK_RESOURCE, url };
        window.postMessage(message, '*');
        
        // 设置一个监听器来等待扩展的响应
        const listener = event => {
          if (event.data && event.data.type === MESSAGE_TYPES.RESOURCE_RESPONSE && event.data.forUrl === url) {
            window.removeEventListener('message', listener);
            resolve(event.data);
          }
        };
        
        window.addEventListener('message', listener);
        
        // 设置超时后继续原始请求
        setTimeout(() => {
          window.removeEventListener('message', listener);
          resolve({ replace: false });
        }, TIMEOUT_SETTINGS.XHR_TIMEOUT);
      });
      
      // 检查是否需要替换资源
      checkResource.then(response => {
        if (response.replace && response.dataUrl) {
          console.log('[APaaS Injector] Using replaced resource for XHR:', url);
          
          // 获取替换的资源
          fetch(response.dataUrl)
            .then(r => r.blob())
            .then(blob => {
              // 创建一个FileReader来读取blob内容
              const reader = new FileReader();
              reader.onload = function() {
                // 模拟XHR响应
                Object.defineProperty(xhr, 'response', { value: reader.result });
                Object.defineProperty(xhr, 'responseText', { value: reader.result });
                Object.defineProperty(xhr, 'status', { value: 200 });
                Object.defineProperty(xhr, 'readyState', { value: 4 });
                
                // 触发readystatechange事件
                const event = new Event('readystatechange');
                xhr.dispatchEvent(event);
                
                // 触发load事件
                const loadEvent = new Event('load');
                xhr.dispatchEvent(loadEvent);
              };
              
              // 根据资源类型决定如何读取
              if (url.includes('.js')) {
                reader.readAsText(blob);
              } else {
                reader.readAsArrayBuffer(blob);
              }
            });
        }
      });
    }
    
    // 无论如何都调用原始的send方法
    return originalXHRSend.apply(this, args);
  };
  
  console.log('[APaaS Injector] Resource interception initialized');
})();