import type { PlasmoCSConfig } from "plasmo"

import { APP_INIT, GET_FILE_LIST } from "~lib/constants"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start"
}

chrome.runtime.sendMessage({ action: APP_INIT })

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === GET_FILE_LIST) {
    // TODO: 为这些文件转换成 blob url
    console.log("GET_FILE_LIST", request.data)
  }
})
