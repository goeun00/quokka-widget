const { app, BrowserWindow, ipcMain, screen, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { fetchMyIssues } = require("./jira");
const { fetchMyPRs } = require("./github");
const Store = require("./store");

let win;
const store = new Store();

function clampWindowPosition(x, y, width, height) {
  const { width: screenW, height: screenH } =
    screen.getPrimaryDisplay().workAreaSize;
  return {
    x: Math.max(0, Math.min(Math.round(x), screenW - width)),
    y: Math.max(0, Math.min(Math.round(y), screenH - height)),
  };
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const W = 370;
  const H = 680;
  const savedPos = store.get("windowPos");
  const initialPos = savedPos
    ? clampWindowPosition(
        savedPos.x ?? Math.floor((width - W) / 2),
        savedPos.y ?? height - H,
        W,
        H,
      )
    : { x: Math.floor((width - W) / 2), y: height - H };

  win = new BrowserWindow({
    width: W,
    height: H,
    x: initialPos.x,
    y: initialPos.y,
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

  win.loadFile(path.join(__dirname, "index.html"));
  win.webContents.openDevTools({ mode: "detach" });

  win.setIgnoreMouseEvents(true, { forward: true });

  [("index.html", "style.css")].forEach((file) => {
    const target = path.join(__dirname, file);
    if (fs.existsSync(target)) {
      fs.watch(target, () => {
        if (!win.isDestroyed()) win.webContents.reload();
      });
    }
  });
}

app.whenReady().then(() => {
  console.log("main");
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle(
  "get-settings",
  () => store.get("settings") || { baseUrl: "", pat: "" },
);
ipcMain.handle("save-settings", (_, s) => {
  store.set("settings", s);
  return true;
});
ipcMain.handle("get-memos", () => store.get("memos") || {});
ipcMain.handle("save-memos", (_, m) => {
  store.set("memos", m);
  return true;
});
ipcMain.handle("get-links", () => store.get("links") || {});
ipcMain.handle("save-links", (_, l) => {
  store.set("links", l);
  return true;
});
ipcMain.handle("get-pins", () => store.get("pins") || []);
ipcMain.handle("save-pins", (_, p) => {
  store.set("pins", p);
  return true;
});
ipcMain.handle("fetch-issues", async () => {
  const s = store.get("settings") || {};
  if (!s.baseUrl || !s.pat) throw new Error("설정을 먼저 입력해주세요!");
  return await fetchMyIssues(s.baseUrl, s.pat, s.doneDays || 60);
});
ipcMain.on("set-ignore-mouse", (_, v) => {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(v, { forward: true });
});
ipcMain.on("move-window", (_, pos = {}) => {
  if (!win || win.isDestroyed()) return;
  const [winW, winH] = win.getSize();
  const next = clampWindowPosition(
    pos.x ?? win.getPosition()[0],
    pos.y ?? win.getPosition()[1],
    winW,
    winH,
  );
  win.setPosition(next.x, next.y);
  store.set("windowPos", next);
});
ipcMain.on("open-url", (_, url) => shell.openExternal(url));
ipcMain.on("quit-app", () => app.quit());

// GitHub
ipcMain.handle(
  "gh:getSettings",
  () => store.get("github") || { baseUrl: "", token: "", repos: [] },
);
ipcMain.handle("gh:saveSettings", (_, data) => {
  store.set("github", data);
  return true;
});
ipcMain.handle("gh:fetchPRs", async (_, baseUrl, token, repos) => {
  return await fetchMyPRs(baseUrl, token, repos);
});
ipcMain.handle("gh:getHistory", () => store.get("ghHistory") || []);
ipcMain.handle("gh:saveHistory", (_, items) => {
  store.set("ghHistory", items);
  return true;
});
