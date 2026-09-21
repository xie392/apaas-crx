import { DEV_REGISTRY_URL } from "~lib/constants"
import { getApps, saveApps } from "~services/storage"
import { urlMatchesPatterns } from "~lib/utils"
import type { Application, DevConfig } from "~types"

interface RegistryEntry {
  packageName: string
  devUrl: string
  env?: Record<string, string>
}

const POLL_INTERVAL = 5000

function findHostApp(apps: Application[], entry: RegistryEntry): Application | undefined {
  const byId = entry.env?.DEV_APP_ID
    ? apps.find((app) => app.id === entry.env.DEV_APP_ID)
    : undefined
  const byName = entry.env?.DEV_APP_NAME
    ? apps.find((app) => app.name === entry.env.DEV_APP_NAME)
    : undefined
  return (
    byId ??
    byName ??
    apps.find((app) => app.packages?.some((p) => p.config?.outputName === entry.packageName)) ??
    apps.find((app) => app.devConfigs?.some((c) => c.packageName === entry.packageName)) ??
    // .env.local 中配置了 DEV_TARGET_HOST 时按应用 URL 规则匹配（补尾斜杠以兼容 *​/* 形式的规则）
    (entry.env?.DEV_TARGET_HOST
      ? apps.find((app) =>
          urlMatchesPatterns(entry.env.DEV_TARGET_HOST.replace(/\/?$/, "/"), app.urlPatterns)
        )
      : undefined) ??
    (apps.length === 1 ? apps[0] : undefined)
  )
}

function upsertAppDevConfig(app: Application, entry: RegistryEntry): boolean {
  const devConfigs = app.devConfigs ?? []
  const next: DevConfig[] = devConfigs.filter((c) => c.packageName !== entry.packageName)
  next.push({
    packageName: entry.packageName,
    devUrl: entry.devUrl,
    auto: true,
    env: entry.env
  })

  if (JSON.stringify(devConfigs) === JSON.stringify(next)) return false
  app.devConfigs = next
  return true
}

function removeStaleAutoConfigs(apps: Application[], livePackageNames: Set<string>): boolean {
  let changed = false
  for (const app of apps) {
    const devConfigs = app.devConfigs ?? []
    const next = devConfigs.filter((c) => !c.auto || livePackageNames.has(c.packageName))
    if (next.length !== devConfigs.length) {
      app.devConfigs = next
      changed = true
    }
  }
  return changed
}

async function syncOnce() {
  let entries: RegistryEntry[]
  try {
    const res = await fetch(`${DEV_REGISTRY_URL}/apps`)
    if (!res.ok) {
      console.warn("[dev-registry-sync] 注册中心响应异常:", res.status)
      return
    }
    entries = await res.json()
    if (!Array.isArray(entries)) return
  } catch (e) {
    // 注册中心未启动 = 没有 dev server 在跑，清掉所有自动注入的配置
    const apps = await getApps()
    let changed = false
    for (const app of apps) {
      const devConfigs = app.devConfigs ?? []
      if (devConfigs.some((c) => c.auto)) {
        app.devConfigs = devConfigs.filter((c) => !c.auto)
        changed = true
      }
    }
    if (changed) {
      await saveApps(apps)
      console.info("[dev-registry-sync] 注册中心已下线，自动配置已全部移除")
    }
    return
  }
  console.info("[dev-registry-sync] 拉取到注册信息:", entries)

  const apps = await getApps()
  let changed = false

  changed = removeStaleAutoConfigs(apps, new Set(entries.map((e) => e.packageName))) || changed

  for (const entry of entries) {
    const app = findHostApp(apps, entry)
    if (!app) {
      console.warn(
        `[dev-registry-sync] 未找到 ${entry.packageName} 的宿主应用。当前应用列表:`,
        apps.map((a) => ({ id: a.id, name: a.name }))
      )
      continue
    }
    if (upsertAppDevConfig(app, entry)) changed = true
  }

  if (changed) {
    await saveApps(apps)
    console.info("[dev-registry-sync] devConfigs 已更新并写入存储")
  }
}

export function startDevRegistrySync() {
  // SW 唤醒时立即同步一次；SW 空闲休眠后 setInterval 会停，用 alarms 周期唤醒兜底
  chrome.alarms.create("dev-registry-sync", { periodInMinutes: 0.5 })
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "dev-registry-sync") syncOnce()
  })
  syncOnce()
  setInterval(syncOnce, POLL_INTERVAL)
}
