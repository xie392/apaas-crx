import JSZip from "jszip"
import { useEffect, useState } from "react"

import "./style.css"

// 进度信息类型
interface ProgressInfo {
  step: string
  percent: number
  details?: string
}

// 活动规则类型
interface ActiveRules {
  js?: string
  css?: string
  worker?: string
  other?: string[]
}

// 样式
const styles = {
  container: {
    width: "400px",
    padding: "20px",
    fontFamily: "Arial, sans-serif"
  },
  title: {
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "15px"
  },
  uploadSection: {
    border: "2px dashed #ccc",
    padding: "20px",
    textAlign: "center" as const,
    marginBottom: "15px",
    borderRadius: "4px",
    cursor: "pointer"
  },
  button: {
    backgroundColor: "#4285f4",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px"
  },
  fileInfo: {
    marginTop: "10px",
    padding: "10px",
    backgroundColor: "#f5f5f5",
    borderRadius: "4px"
  },
  status: {
    marginTop: "15px",
    padding: "10px",
    borderRadius: "4px"
  },
  success: {
    backgroundColor: "#d4edda",
    color: "#155724"
  },
  error: {
    backgroundColor: "#f8d7da",
    color: "#721c24"
  }
}

function Popup() {
  // 状态管理
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<{
    type: "success" | "error" | "info" | "processing" | null
    message: string
  }>({
    type: null,
    message: ""
  })
  const [activeRules, setActiveRules] = useState<ActiveRules>({})
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [progress, setProgress] = useState<ProgressInfo | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)

  // 加载当前规则状态
  useEffect(() => {
    chrome.runtime.sendMessage({ action: "getActiveRules" }, (response) => {
      if (response && response.rules) {
        setActiveRules(response.rules)
        if (response.lastUpdated) {
          setLastUpdated(response.lastUpdated)
        }
        setIsEnabled(response.enabled || false)
      }
    })

    // 监听进度更新消息
    const progressListener = (message: any) => {
      if (message.action === "progressUpdate" && message.progress) {
        setProgress(message.progress)

        // 根据进度更新状态
        if (message.progress.percent === 100) {
          setStatus({
            type: "success",
            message: "处理完成！"
          })
        } else if (message.progress.step === "错误") {
          setStatus({
            type: "error",
            message: message.progress.details || "处理出错"
          })
        } else {
          setStatus({
            type: "processing",
            message: `处理中 (${message.progress.percent}%)...`
          })
        }
      }
    }

    chrome.runtime.onMessage.addListener(progressListener)

    return () => {
      chrome.runtime.onMessage.removeListener(progressListener)
    }
  }, [])

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      if (selectedFile.name.endsWith(".zip")) {
        setFile(selectedFile)
        setStatus({ type: "info", message: "文件已选择，点击上传按钮进行处理" })
      } else {
        setStatus({ type: "error", message: "请选择.zip格式的文件" })
        setFile(null)
      }
    }
  }

  // 处理拖放事件
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true)
    } else if (e.type === "dragleave") {
      setIsDragging(false)
    }
  }

  // 处理拖放释放
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.name.endsWith(".zip")) {
        setFile(droppedFile)
        setStatus({ type: "info", message: "文件已选择，点击处理按钮进行应用" })
      } else {
        setStatus({ type: "error", message: "请选择.zip格式的文件" })
      }
    }
  }

  // 处理文件上传和解压
  const handleUpload = async () => {
    if (!file) {
      setStatus({ type: "error", message: "请先选择一个压缩包" })
      return
    }

    setStatus({ type: "processing", message: "正在处理文件..." })
    setProgress({ step: "准备", percent: 0, details: "准备处理文件..." })

    try {
      // 读取并解压zip文件
      const zipData = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(zipData)

      // 查找并读取apaas.json文件
      const apaasJsonFile = zip.file("apaas.json")
      if (!apaasJsonFile) {
        setStatus({ type: "error", message: "压缩包中缺少apaas.json文件" })
        return
      }

      // 解析json文件
      const jsonContent = await apaasJsonFile.async("text")
      const config = JSON.parse(jsonContent)

      if (!config.outputName) {
        setStatus({ type: "error", message: "apaas.json中缺少outputName字段" })
        return
      }

      const outputName = config.outputName

      // 检查必要文件
      const jsFileName = `${outputName}.umd.js`
      const cssFileName = `${outputName}.css`
      const workerFileName = `${outputName}.umd.worker.js`

      const jsFile = zip.file(jsFileName)
      if (!jsFile) {
        setStatus({
          type: "error",
          message: `压缩包中缺少主JS文件: ${jsFileName}`
        })
        return
      }

      // 准备要保存的文件
      const filesToSave: { [key: string]: ArrayBuffer } = {}

      // 保存主JS文件
      filesToSave[jsFileName] = await jsFile.async("arraybuffer")

      // 如果有CSS文件，也保存
      const cssFile = zip.file(cssFileName)
      if (cssFile) {
        filesToSave[cssFileName] = await cssFile.async("arraybuffer")
      }

      // 如果有Worker文件，也保存
      const workerFile = zip.file(workerFileName)
      if (workerFile) {
        filesToSave[workerFileName] = await workerFile.async("arraybuffer")
      }

      // 保存static和public目录下的所有文件
      const otherFiles: string[] = []
      zip.forEach((relativePath, zipEntry) => {
        if (
          !zipEntry.dir &&
          (relativePath.startsWith("static/") ||
            relativePath.startsWith("public/"))
        ) {
          otherFiles.push(relativePath)
        }
      })

      // 发送到后台进行处理
      chrome.runtime.sendMessage(
        {
          action: "processFiles",
          outputName: outputName,
          filesToSave: filesToSave,
          otherFiles: otherFiles,
          zipData: Array.from(new Uint8Array(zipData))
        },
        (response) => {
          if (response && response.success) {
            // 成功后的处理已经通过进度消息更新
            setActiveRules(response.rules)
          } else if (response) {
            setStatus({ type: "error", message: `处理失败: ${response.error}` })
          }
        }
      )
    } catch (error) {
      console.error("处理文件时出错:", error)
      setStatus({ type: "error", message: `处理文件时出错: ${error.message}` })
    }
  }

  // 格式化日期
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`
  }

  // 进度指示器组件
  const ProgressIndicator = ({ progress }: { progress: ProgressInfo }) => (
    <div className="tw-mt-4">
      <div className="tw-flex tw-justify-between tw-mb-1">
        <span className="tw-text-sm tw-font-medium tw-text-gray-700">
          {progress.step}
        </span>
        <span className="tw-text-sm tw-font-medium tw-text-gray-700">
          {progress.percent}%
        </span>
      </div>
      <div className="tw-w-full tw-bg-gray-200 tw-rounded-full tw-h-2.5">
        <div
          className="tw-bg-primary-500 tw-h-2.5 tw-rounded-full tw-transition-all tw-duration-300"
          style={{ width: `${progress.percent}%` }}></div>
      </div>
      {progress.details && (
        <p className="tw-mt-1 tw-text-sm tw-text-gray-600">
          {progress.details}
        </p>
      )}
    </div>
  )

  // 处理开关切换
  const handleToggleEnabled = () => {
    const newEnabledState = !isEnabled
    setIsEnabled(newEnabledState)
    
    // 发送消息到后台更新状态
    chrome.runtime.sendMessage({
      action: "toggleEnabled",
      enabled: newEnabledState
    })
  }

  return (
    <div className="tw-w-[450px] tw-p-6 tw-font-sans tw-bg-gray-50">
      <h1 className="tw-text-xl tw-font-bold tw-text-gray-800 tw-mb-4">
        APaaS 脚本替换工具
      </h1>

      {/* 添加启用/禁用开关 */}
      <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-py-3 tw-mb-4 tw-bg-white tw-rounded-md tw-shadow-sm">
        <span className="tw-text-sm tw-font-medium tw-text-gray-700">启用脚本替换</span>
        <button 
          className={`tw-relative tw-inline-flex tw-h-6 tw-w-11 tw-items-center tw-rounded-full tw-transition-colors ${isEnabled ? 'tw-bg-primary-500' : 'tw-bg-gray-300'}`}
          onClick={handleToggleEnabled}
        >
          <span className="tw-sr-only">启用脚本替换</span>
          <span 
            className={`tw-inline-block tw-h-4 tw-w-4 tw-transform tw-rounded-full tw-bg-white tw-transition-transform ${isEnabled ? 'tw-translate-x-6' : 'tw-translate-x-1'}`}
          />
        </button>
      </div>
      
      {/* 当脚本替换禁用时显示提示 */}
      {!isEnabled && Object.keys(activeRules).length > 0 && (
        <div className="tw-mb-4 tw-p-3 tw-rounded-md tw-bg-yellow-50 tw-text-yellow-800 tw-border tw-border-yellow-200">
          <div className="tw-flex">
            <svg className="tw-h-5 tw-w-5 tw-text-yellow-500 tw-mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <span>脚本替换功能已禁用，启用后才会替换文件</span>
          </div>
        </div>
      )}

      {/* 文件上传区域 */}
      <div
        className={`tw-border-2 ${isDragging ? "tw-border-primary-500 tw-bg-primary-50" : "tw-border-dashed tw-border-gray-300"} 
                   tw-rounded-lg tw-p-6 tw-text-center tw-cursor-pointer tw-transition-all tw-hover:bg-gray-50`}
        onClick={() => document.getElementById("fileInput")?.click()}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}>
        <div className="tw-flex tw-flex-col tw-items-center tw-justify-center tw-space-y-2">
          <svg
            className="tw-w-12 tw-h-12 tw-text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
          </svg>
          <p className="tw-text-sm tw-text-gray-600">
            {file ? "选择其他文件" : "点击或拖放 APaaS ZIP 压缩包"}
          </p>
        </div>
        <input
          id="fileInput"
          type="file"
          accept=".zip"
          onChange={handleFileSelect}
          className="tw-hidden"
        />
        {file && (
          <div className="tw-mt-3 tw-p-3 tw-bg-white tw-rounded-md tw-shadow-sm">
            <div className="tw-flex tw-items-center">
              <svg
                className="tw-w-6 tw-h-6 tw-text-primary-500 tw-mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <div className="tw-flex-1 tw-truncate">
                <span className="tw-font-medium">{file.name}</span>
                <span className="tw-ml-2 tw-text-sm tw-text-gray-500">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 处理按钮 */}
      <button
        className={`tw-mt-4 tw-w-full btn ${status.type === "processing" ? "tw-bg-gray-400 tw-cursor-not-allowed" : "btn-primary"}`}
        onClick={handleUpload}
        disabled={!file || status.type === "processing"}>
        {status.type === "processing" ? (
          <div className="tw-flex tw-items-center tw-justify-center">
            <svg
              className="tw-animate-spin tw--ml-1 tw-mr-3 tw-h-5 tw-w-5 tw-text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24">
              <circle
                className="tw-opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"></circle>
              <path
                className="tw-opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            处理中...
          </div>
        ) : (
          "处理并应用"
        )}
      </button>

      {/* 状态信息 */}
      {status.type && (
        <div
          className={`tw-mt-4 tw-p-3 tw-rounded-md ${
            status.type === "success"
              ? "tw-bg-success-50 tw-text-success-800 tw-border tw-border-success-200"
              : status.type === "error"
                ? "tw-bg-error-50 tw-text-error-800 tw-border tw-border-error-200"
                : status.type === "info"
                  ? "tw-bg-blue-50 tw-text-blue-800 tw-border tw-border-blue-200"
                  : "tw-bg-gray-50 tw-text-gray-800 tw-border tw-border-gray-200"
          }`}>
          <div className="tw-flex">
            {status.type === "success" && (
              <svg
                className="tw-h-5 tw-w-5 tw-text-success-500 tw-mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"></path>
              </svg>
            )}
            {status.type === "error" && (
              <svg
                className="tw-h-5 tw-w-5 tw-text-error-500 tw-mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            )}
            {status.type === "info" && (
              <svg
                className="tw-h-5 tw-w-5 tw-text-blue-500 tw-mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            )}
            {status.type === "processing" && !progress && (
              <svg
                className="tw-animate-spin tw-h-5 tw-w-5 tw-text-gray-500 tw-mr-2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24">
                <circle
                  className="tw-opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"></circle>
                <path
                  className="tw-opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span>{status.message}</span>
          </div>
        </div>
      )}

      {/* 进度指示器 */}
      {progress && (status.type === "processing" || progress.percent < 100) && (
        <ProgressIndicator progress={progress} />
      )}

      {/* 当前活动规则 */}
      {Object.keys(activeRules).length > 0 && (
        <div className="tw-mt-6 tw-bg-white tw-p-4 tw-rounded-md tw-shadow-sm">
          <h2 className="tw-text-sm tw-font-semibold tw-text-gray-700 tw-mb-2 tw-flex tw-items-center tw-justify-between">
            <div className="tw-flex tw-items-center">
              <svg
                className="tw-w-4 tw-h-4 tw-mr-1 tw-text-primary-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
              当前活动规则
            </div>
            <span className={`tw-text-xs tw-px-2 tw-py-1 tw-rounded ${isEnabled ? 'tw-bg-success-100 tw-text-success-800' : 'tw-bg-gray-100 tw-text-gray-600'}`}>
              {isEnabled ? '已启用' : '已禁用'}
            </span>
          </h2>
          {lastUpdated && (
            <p className="tw-text-xs tw-text-gray-500 tw-mb-2">
              上次更新: {formatDate(lastUpdated)}
            </p>
          )}
          <div className="tw-space-y-2">
            {activeRules.js && (
              <div className="tw-flex tw-items-start tw-justify-between">
                <span className="tw-text-xs tw-text-gray-800 tw-break-all">
                  {activeRules.js}
                </span>
                <span className="tw-inline-block tw-w-14 tw-text-xs tw-font-medium tw-text-gray-600 tw-text-right">
                  js
                </span>
              </div>
            )}
            {activeRules.css && (
              <div className="tw-flex tw-items-start tw-justify-between">
                <span className="tw-text-xs tw-text-gray-800 tw-break-all">
                  {activeRules.css}
                </span>
                <span className="tw-inline-block tw-w-14 tw-text-xs tw-font-medium tw-text-gray-600 tw-text-right">
                  css
                </span>
              </div>
            )}
            {activeRules.worker && (
              <div className="tw-flex tw-items-start tw-justify-between">
                <span className="tw-text-xs tw-text-gray-800 tw-break-all">
                  {activeRules.worker}
                </span>
                <span className="tw-inline-block tw-w-14 tw-text-xs tw-font-medium tw-text-gray-600 tw-text-right">
                  worker.js
                </span>
              </div>
            )}
            {activeRules.other && activeRules.other.length > 0 && (
              <div className="tw-flex tw-items-start">
                <span className="tw-text-xs tw-text-gray-800 tw-justify-between">
                  {activeRules.other.length} 个文件
                </span>
                <span className="tw-inline-block tw-w-14 tw-text-xs tw-font-medium tw-text-gray-600 tw-text-right">
                  其他:
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 底部信息 */}
      <div className="tw-mt-6 tw-text-center">
        <p className="tw-text-xs tw-text-gray-500">
          APaaS 脚本替换工具 v0.0.2 |{/* TODO：获取自己企业微信 userId */}
          <a
            href="wxwork://message?username=yc90112885"
            target="_blank"
            rel="noopener noreferrer"
            className="tw-text-primary-500 tw-hover:text-primary-700 tw-ml-1">
            帮助
          </a>
        </p>
      </div>
    </div>
  )
}

export default Popup
