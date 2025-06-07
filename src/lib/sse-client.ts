export interface SSEMessage {
  event: string
  filePath: string
}

type SSEErrorCallback = (error: Event) => void
type SSEMessageCallback = (data: SSEMessage) => void

/**
 * @description sse 客户端
 * @example
 * const sseClient = new SSEClient("http://127.0.0.1:3000/sse")
 * // 消息监听
 * sseClient.onMessage((data: SSEMessage) => {
 *   console.log(`[SSE消息] ${data.event}: ${data.filePath}`)
 * })
 * // 错误监听
 * sseClient.onError((error: Event) => {
 *   console.error(`[SSE错误] ${error.message}`)
 * })
 */
export class SSEClient {
  private eventSource: EventSource | null = null
  private url: string
  private messageCallbacks: SSEMessageCallback[] = []
  private errorCallbacks: SSEErrorCallback[] = []
  private retryInterval: number = 5000
  private maxRetries: number = 10
  private retryCount: number = 0

  constructor(url: string) {
    this.url = url
    this.initEventSource()
  }

  /**
   * 注册消息回调函数
   * @param callback - 处理 SSE 消息的函数
   */
  public onMessage(callback: SSEMessageCallback): this {
    this.messageCallbacks.push(callback)
    return this
  }

  /**
   * 注册错误回调函数
   * @param callback - 处理 SSE 错误的函数
   */
  public onError(callback: SSEErrorCallback): this {
    this.errorCallbacks.push(callback)
    return this
  }

  /**
   * 触发消息回调
   * @param data - 解析后的 SSE 消息数据
   */
  private dispatchMessage(data: SSEMessage): void {
    this.messageCallbacks.forEach((callback) => callback(data))
  }

  /**
   * 触发错误回调
   * @param error - 错误事件对象
   */
  private dispatchError(error: Event): void {
    this.errorCallbacks.forEach((callback) => callback(error))
  }

  /**
   * 初始化 EventSource 连接
   */
  private initEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close()
    }

    this.eventSource = new EventSource(this.url)

    this.eventSource.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as SSEMessage
        this.dispatchMessage(data)
      } catch (err) {
        const parseError = new ErrorEvent("SSE_PARSE_ERROR", {
          message: `消息解析失败: ${err.message}`,
          error: err as Error
        })
        this.dispatchError(parseError)
      }
    }

    // 处理错误事件（兼容 DOM 错误类型）
    this.eventSource.onerror = (error: Event) => {
      this.dispatchError(error)
      this.handleReconnection()
    }
  }

  /**
   * 处理重连逻辑
   */
  private handleReconnection(): void {
    if (
      this.eventSource?.readyState === EventSource.CLOSED &&
      this.retryCount < this.maxRetries
    ) {
      this.retryCount++
      console.log(`[SSE] 连接关闭，第 ${this.retryCount} 次重试...`)
      setTimeout(() => this.initEventSource(), this.retryInterval)
    } else if (this.retryCount >= this.maxRetries) {
      console.error(`[SSE] 达到最大重试次数（${this.maxRetries}次），停止连接`)
    }
  }

  /**
   * 断开连接
   */
  public disconnect(): void {
    this.eventSource?.close()
    this.eventSource = null
    this.retryCount = 0 
  }
}
