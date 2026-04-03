const { app, BrowserWindow, ipcMain, screen, shell } = require("electron");
const path = require("path");
const { fetchMyIssues } = require("./jira");
const Store = require("./store");

let win;
const store = new Store();

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const W = 370,
    H = 680;
  win = new BrowserWindow({
    width: W,
    height: H,
    x: Math.floor((width - W) / 2),
    y: height - H,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.loadFile("index.html");
  win.webContents.openDevTools({ mode: "detach" });

  // 저장 시 자동 리로딩
  const fs = require("fs");
  const files = ["index.html", "style.css"];
  files.forEach((f) => {
    fs.watch(path.join(__dirname, f), () => win.webContents.reload());
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle(
  "get-settings",
  () => store.get("settings") || { baseUrl: "", pat: "" },
);
ipcMain.handle("save-settings", (e, s) => {
  store.set("settings", s);
  return true;
});
ipcMain.handle("get-memos", () => store.get("memos") || {});
ipcMain.handle("save-memos", (e, m) => {
  store.set("memos", m);
  return true;
});
ipcMain.handle("get-links", () => store.get("links") || {});
ipcMain.handle("save-links", (e, l) => {
  store.set("links", l);
  return true;
});
ipcMain.handle("get-pins", () => store.get("pins") || []);
ipcMain.handle("save-pins", (e, p) => {
  store.set("pins", p);
  return true;
});
ipcMain.handle("fetch-issues", async () => {
  const s = store.get("settings") || {};
  if (!s.baseUrl || !s.pat) throw new Error("설정을 먼저 입력해주세요!");
  return await fetchMyIssues(s.baseUrl, s.pat, s.doneDays || 60);
});
ipcMain.on("set-ignore-mouse", (e, v) =>
  win.setIgnoreMouseEvents(v, { forward: true }),
);
ipcMain.on("open-url", (e, url) => shell.openExternal(url));
ipcMain.on("quit-app", () => app.quit());
