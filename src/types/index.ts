export interface ApaasConfig {
  outputName: string
  [key: string]: any
}

export interface Package {
  id: string
  name: string
  files: {
    [filename: string]:  ArrayBuffer  // filename -> blob URL
  }
  config: ApaasConfig
  uploadedAt: number
}

export interface DevPackage {
  id: string
  name: string
}

export interface Application {
  id: string
  name: string
  enabled: boolean
  urlPatterns: string[]
  packages: Package[]
  createdAt: number
  updatedAt: number
  // +++ 新增开发环境的配置 +++
  devEnabled?: boolean
  devPackages?: DevPackage[]
}

export interface ReplacementInfo {
  originalUrl: string
  replacedUrl: string
  appId: string
  appName: string
}

export interface AppStore extends Omit<Application, "packages"> {}
