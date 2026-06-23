const { ipcRenderer } = require("electron");
window.api = {
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (s) => ipcRenderer.invoke("save-settings", s),
  fetchIssues: () => ipcRenderer.invoke("fetch-issues"),
  fetchWorklogs: (monthOffset) =>
    ipcRenderer.invoke("fetch-worklogs", monthOffset),
  fetchIssuesByKeys: (keys) => ipcRenderer.invoke("fetch-issues-by-keys", keys),
  getMemos: () => ipcRenderer.invoke("get-memos"),
  saveMemos: (m) => ipcRenderer.invoke("save-memos", m),
  getLinks: () => ipcRenderer.invoke("get-links"),
  saveLinks: (l) => ipcRenderer.invoke("save-links", l),
  getPins: () => ipcRenderer.invoke("get-pins"),
  savePins: (p) => ipcRenderer.invoke("save-pins", p),
  getBranches: () => ipcRenderer.invoke("get-branches"),
  saveBranches: (b) => ipcRenderer.invoke("save-branches", b),
  getGHHistory: () => ipcRenderer.invoke("gh:getHistory"),
  saveGHHistory: (items) => ipcRenderer.invoke("gh:saveHistory", items),
  openUrl: (u) => ipcRenderer.send("open-url", u),
  quit: () => ipcRenderer.send("quit-app"),
  setIgnoreMouse: (v) => ipcRenderer.send("set-ignore-mouse", v),
  moveWindow: (pos) => ipcRenderer.send("move-window", pos),
  getGHSettings: () => ipcRenderer.invoke("gh:getSettings"),
  saveGHSettings: (data) => ipcRenderer.invoke("gh:saveSettings", data),
  fetchGHPRs: (baseUrl, token, repos) =>
    ipcRenderer.invoke("gh:fetchPRs", baseUrl, token, repos),
  exportWorkReport: (rows) => ipcRenderer.invoke("export-work-report", rows),

  // 커스텀 업데이트 모달용
  onUpdateAvailable: (cb) =>
    ipcRenderer.on("update:available", (_e, info) => cb(info)),
  onUpdateProgress: (cb) =>
    ipcRenderer.on("update:progress", (_e, info) => cb(info)),
  onUpdateDownloaded: (cb) =>
    ipcRenderer.on("update:downloaded", (_e, info) => cb(info)),
  onUpdateError: (cb) =>
    ipcRenderer.on("update:error", (_e, info) => cb(info)),
  respondUpdate: (action) => ipcRenderer.send("update:respond", action),
};
