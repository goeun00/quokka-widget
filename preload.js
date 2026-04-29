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
};
