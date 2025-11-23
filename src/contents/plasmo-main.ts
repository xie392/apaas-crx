import type { PlasmoCSConfig } from "plasmo"

import { APP_INIT } from "~lib/constants"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start"
}

chrome.runtime.sendMessage({ action: APP_INIT })
