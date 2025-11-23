import { get, set } from "idb-keyval"

import { APPS_STORAGE_KEY } from "~lib/constants"
import type { Application } from "~types"

/**
 * 从存储中获取应用列表
 *
 * @returns Promise<Application[]> 返回应用列表数组，如果获取失败则返回空数组
 *
 * @description
 * - 从存储中读取 APPS_STORAGE_KEY 对应的数据
 * - 如果数据不存在，返回空数组
 * - 如果数据格式不正确（非数组），返回空数组
 * - 如果获取过程发生错误，返回空数组
 */
export const getApps = async (): Promise<Application[]> => {
  try {
    const apps = await get(APPS_STORAGE_KEY)

    if (!apps) {
      return []
    }

    if (!Array.isArray(apps)) {
      console.error("存储中的应用数据格式不正确:", apps)
      return []
    }

    return apps
  } catch (error) {
    console.error("获取应用数据失败:", error)
    return []
  }
}

/**
 * 将应用列表保存到存储中
 * @param apps - 需要保存的应用列表
 * @returns Promise<void> 保存操作的 Promise
 * @throws 保存失败时会在控制台打印错误信息
 */
export const saveApps = async (apps: Application[]): Promise<void> => {
  try {
    await set(APPS_STORAGE_KEY, apps)
  } catch (error) {
    console.error("Failed to save apps:", error)
  }
}

/**
 * 根据应用ID获取应用详情
 * @param id 应用ID
 * @returns 返回匹配的应用信息，如果未找到则返回 undefined
 */
export const getApp = async (id: string): Promise<Application | undefined> => {
  const apps = await getApps()
  return apps.find((app) => app.id === id)
}

/**
 * 保存应用程序信息到存储中
 * 如果应用已存在则更新，不存在则添加新应用
 *
 * @param app - 需要保存的应用程序对象
 * @returns Promise<void> - 保存操作的异步结果
 */
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

/**
 * 删除指定 ID 的应用
 * @param id 要删除的应用 ID
 * @returns Promise<void> 删除完成的 Promise
 */
export const deleteApp = async (id: string): Promise<void> => {
  const apps = await getApps()
  const filteredApps = apps.filter((app) => app.id !== id)
  await saveApps(filteredApps)
}

/**
 * 切换应用的启用状态
 * @param id 应用ID
 * @returns 返回更新后的应用信息，如果应用不存在则返回 undefined
 */
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
