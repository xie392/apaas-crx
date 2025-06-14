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

export interface DevConfig {
  packageName: string
  devUrl: string
}

export interface Application {
  id: string
  name: string
  enabled: boolean
  urlPatterns: string[]
  packages: Package[]
  devConfigs?: DevConfig[]
  createdAt: number
  updatedAt: number
}

export interface ReplacementInfo {
  originalUrl: string
  replacedUrl: string
  appId: string
  appName: string
}

export interface AppStore extends Omit<Application, "packages"> {}
