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
  getBranches: () => ipcRenderer.invoke("get-branches"),
  saveBranches: (b) => ipcRenderer.invoke("save-branches", b),
  getGHHistory: () => ipcRenderer.invoke("gh:getHistory"),
  saveGHHistory: (items) => ipcRenderer.invoke("gh:saveHistory", items),
  openUrl: (u) => ipcRenderer.send("open-url", u),
  quit: () => ipcRenderer.send("quit-app"),
  setIgnoreMouse: (v) => ipcRenderer.send("set-ignore-mouse", v),
  moveWindow: (pos) => ipcRenderer.send("move-window", pos),
  getGHSettings: () => ipcRenderer.invoke("gh:getSettings"),
  // GitHub 설정
  saveGHSettings: (data) => ipcRenderer.invoke("gh:saveSettings", data),
  // PR 조회
  fetchGHPRs: (baseUrl, token, repos) =>
    ipcRenderer.invoke("gh:fetchPRs", baseUrl, token, repos),
  // Diff
  fetchGHDiff: (token, owner, repo, num) =>
    ipcRenderer.invoke("gh:fetchDiff", token, owner, repo, num),
  fetchGHCompareDiff: (token, owner, repo, base, head) =>
    ipcRenderer.invoke("gh:fetchCompareDiff", token, owner, repo, base, head),
  // PR 생성
  createGHPR: (token, owner, repo, data) =>
    ipcRenderer.invoke("gh:createPR", token, owner, repo, data),
  // 브랜치
  fetchGHBranches: (token, owner, repo) =>
    ipcRenderer.invoke("gh:fetchBranches", token, owner, repo),
};
