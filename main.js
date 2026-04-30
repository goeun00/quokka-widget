const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  shell,
  dialog,
} = require("electron");
const XLSX = require("xlsx");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { fetchMyIssues, fetchIssuesByKeys, fetchMyWorklogs } = require("./jira");
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
  const W = 490;
  const H = 860;
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

  ["index.html", "style.css"].forEach((file) => {
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
ipcMain.handle("get-branches", () => store.get("branches") || {});
ipcMain.handle("save-branches", (_, b) => {
  store.set("branches", b);
  return true;
});
ipcMain.handle("fetch-issues", async () => {
  const s = store.get("settings") || {};
  if (!s.baseUrl || !s.pat) throw new Error("설정을 먼저 입력해주세요!");
  return await fetchMyIssues(s.baseUrl, s.pat, s.doneDays || 60, s.email || "");
});

ipcMain.handle("fetch-worklogs", async (_, monthOffset = 0) => {
  const s = store.get("settings") || {};
  if (!s.baseUrl || !s.pat) throw new Error("설정을 먼저 입력해주세요!");
  return await fetchMyWorklogs(s.baseUrl, s.pat, monthOffset, s.email || "");
});

ipcMain.handle("fetch-issues-by-keys", async (_, keys) => {
  const s = store.get("settings") || {};
  if (!s.baseUrl || !s.pat) throw new Error("설정을 먼저 입력해주세요!");
  return await fetchIssuesByKeys(s.baseUrl, s.pat, keys, s.email || "");
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

ipcMain.handle("export-work-report", async (_event, rows = []) => {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "업무보고");

  const filePath = path.join(
    os.tmpdir(),
    `업무보고_${new Date().toISOString().slice(0, 10)}_${Date.now()}.xlsx`,
  );

  XLSX.writeFile(workbook, filePath);

  const errorMessage = await shell.openPath(filePath);
  if (errorMessage) throw new Error(errorMessage);

  return { canceled: false, filePath };
});
