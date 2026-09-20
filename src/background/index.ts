import { APP_INIT, DEV_FILE_CHANGED, GET_DEV_CONFIGS } from "~lib/constants"
import { clearRedirectRules } from "~lib/rule-manager"
import { matchApp } from "~lib/utils"
import { reinjectDevResource } from "./injected-helper"
import { updateRedirectRules } from "./url-replacement-worker"

function main() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === APP_INIT) {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        matchApp(sender.url).then((apps) => {
          if (apps.isPattern && apps.app && apps.app?.enabled) {
            updateRedirectRules(tab.id, apps.app)
          } else {
            clearRedirectRules()
          }
        })
      })
    }

    if (request.action === GET_DEV_CONFIGS) {
      matchApp(sender.url).then((apps) => {
        const devConfigs =
          apps.isPattern && apps.app?.enabled ? apps.app.devConfigs : []
        sendResponse({ devConfigs })
      })
      return true
    }

    if (request.action === DEV_FILE_CHANGED && sender.tab?.id) {
      matchApp(sender.url).then((apps) => {
        if (!apps.isPattern || !apps.app?.enabled) return
        const config = apps.app.devConfigs.find(
          (c) => c.packageName === request.packageName
        )
        if (config) reinjectDevResource(sender.tab.id, config)
      })
    }
  })
}

main()
