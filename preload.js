const { ipcRenderer } = require("electron");
window.api = {
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (s) => ipcRenderer.invoke("save-settings", s),
  fetchIssues: () => ipcRenderer.invoke("fetch-issues"),
  getMemos: () => ipcRenderer.invoke("get-memos"),
  saveMemos: (m) => ipcRenderer.invoke("save-memos", m),
  getLinks: () => ipcRenderer.invoke("get-links"),
  saveLinks: (l) => ipcRenderer.invoke("save-links", l),
  getPins: () => ipcRenderer.invoke("get-pins"),
  savePins: (p) => ipcRenderer.invoke("save-pins", p),
  openUrl: (u) => ipcRenderer.send("open-url", u),
  quit: () => ipcRenderer.send("quit-app"),
  setIgnoreMouse: (v) => ipcRenderer.send("set-ignore-mouse", v),
};
