import { del, get, set } from "idb-keyval"

import { APPS_STORAGE_KEY, REPLACEMENTS_STORAGE_KEY } from "~lib/constants"

import type { Application } from "../types"

export const getApps = async (): Promise<Application[]> => {
  try {
    console.log("正在从存储中获取应用数据...")
    const apps = await get(APPS_STORAGE_KEY)

    if (!apps) {
      console.log("未找到应用数据，返回空数组")
      return []
    }

    if (!Array.isArray(apps)) {
      console.error("存储中的应用数据格式不正确:", apps)
      return []
    }

    console.log(`成功获取 ${apps.length} 个应用数据`)
    apps.forEach((app, index) => {
      console.log(
        `应用 #${index + 1}: ${app.name}, 启用: ${app.enabled}, URL规则: ${app.urlPatterns.join(", ")}, 包数量: ${app.packages.length}`
      )
    })

    return apps
  } catch (error) {
    console.error("获取应用数据失败:", error)
    return []
  }
}

export const saveApps = async (apps: Application[]): Promise<void> => {
  try {
    await set(APPS_STORAGE_KEY, apps)
  } catch (error) {
    console.error("Failed to save apps:", error)
  }
}

export const getApp = async (id: string): Promise<Application | undefined> => {
  const apps = await getApps()
  return apps.find((app) => app.id === id)
}

export const saveApp = async (app: Application): Promise<void> => {
  const apps = await getApps()
  const index = apps.findIndex((a) => a.id === app.id)

  if (index >= 0) {
    apps[index] = app
  } else {
    apps.push(app)
  }

  await saveApps(apps)
}

export const deleteApp = async (id: string): Promise<void> => {
  const apps = await getApps()
  const filteredApps = apps.filter((app) => app.id !== id)
  await saveApps(filteredApps)
}

export const toggleAppEnabled = async (
  id: string
): Promise<Application | undefined> => {
  const apps = await getApps()
  const index = apps.findIndex((app) => app.id === id)

  if (index >= 0) {
    apps[index].enabled = !apps[index].enabled
    await saveApps(apps)
    return apps[index]
  }

  return undefined
}

// Store file blob URLs for replacements
export const storeReplacements = async (
  tabId: number,
  replacements: Record<string, string>
): Promise<void> => {
  try {
    await set(`${REPLACEMENTS_STORAGE_KEY}-${tabId}`, replacements)
  } catch (error) {
    console.error("Failed to store replacements:", error)
  }
}

export const getReplacements = async (
  tabId: number
): Promise<Record<string, string>> => {
  try {
    const replacements = await get(`${REPLACEMENTS_STORAGE_KEY}-${tabId}`)
    return replacements || {}
  } catch (error) {
    console.error("Failed to get replacements:", error)
    return {}
  }
}

export const clearReplacements = async (tabId: number): Promise<void> => {
  try {
    await del(`${REPLACEMENTS_STORAGE_KEY}-${tabId}`)
  } catch (error) {
    console.error("Failed to clear replacements:", error)
  }
}
