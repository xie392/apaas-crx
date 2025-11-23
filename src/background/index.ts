import { APP_INIT } from "~lib/constants"
import { clearRedirectRules } from "~lib/rule-manager"
import { matchApp } from "~lib/utils"
import { updateRedirectRules } from "./url-replacement-worker"

function main() {
  chrome.runtime.onMessage.addListener((request, sender) => {
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
  })
}

main()
