const { app, BrowserWindow, ipcMain, screen, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
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
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
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
    ? clampWindowPosition(savedPos.x ?? Math.floor((width - W) / 2), savedPos.y ?? height - H, W, H)
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

  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: "detach" });
  }
  ["index.html", "style.css"].forEach((file) => {
    const target = path.join(__dirname, file);
    if (fs.existsSync(target)) {
      fs.watch(target, () => {
        if (!win.isDestroyed()) win.webContents.reload();
      });
    }
  });
}

// 업데이트 관련 로그를 파일로 남김 (패키징된 앱은 devtools가 없어서 console.log를 볼 수 없음)
// 로그 위치: %APPDATA%/<앱이름>/update.log (Windows) 또는 ~/Library/Application Support/<앱이름>/update.log (macOS)
function logUpdate(...args) {
  try {
    const updateLogPath = path.join(app.getPath("userData"), "update.log");
    const line = `[${new Date().toISOString()}] ${args
      .map((a) => (a instanceof Error ? a.stack || a.message : typeof a === "object" ? JSON.stringify(a) : String(a)))
      .join(" ")}\n`;
    fs.appendFileSync(updateLogPath, line);
  } catch (e) {
    console.warn("[update] failed to write log:", e);
  }
}

function setupAutoUpdater() {
  logUpdate("setupAutoUpdater called. isPackaged =", app.isPackaged, "version =", app.getVersion());

  if (!app.isPackaged) {
    logUpdate("skip: app is not packaged (dev mode)");
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  const prepareUpdateDialog = () => {
    if (!win || win.isDestroyed()) return;

    win.setIgnoreMouseEvents(false);
    win.show();
    win.focus();
  };

  autoUpdater.on("checking-for-update", () => {
    console.log("[update] checking...");
    logUpdate("checking-for-update");
  });

  autoUpdater.on("update-available", async (info) => {
    console.log("[update] available:", info.version);
    logUpdate("update-available", info.version);
    prepareUpdateDialog();

    const { response } = await dialog.showMessageBox(win, {
      type: "info",
      title: "업데이트 발견",
      message: `새 버전 ${info.version}이 있어요.`,
      detail: "지금 다운로드할까요?",
      buttons: ["업데이트", "나중에"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    logUpdate("update-available dialog response:", response);

    if (response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log("[update] not available");
    logUpdate("update-not-available. current version:", app.getVersion(), "info:", info);
  });

  autoUpdater.on("download-progress", (progress) => {
    console.log("[update] progress:", Math.round(progress.percent));
    logUpdate("download-progress", Math.round(progress.percent) + "%");
  });

  autoUpdater.on("update-downloaded", async () => {
    console.log("[update] downloaded. will install on quit.");
    logUpdate("update-downloaded");
    prepareUpdateDialog();

    const { response } = await dialog.showMessageBox(win, {
      type: "info",
      title: "업데이트 준비 완료",
      message: "새 버전이 다운로드됐어요.",
      detail: "지금 재시작하면 업데이트가 바로 적용돼요.",
      buttons: ["지금 재시작", "나중에"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    logUpdate("update-downloaded dialog response:", response);

    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("error", (error) => {
    console.warn("[update] error:", error);
    logUpdate("error event:", error);
    prepareUpdateDialog();

    dialog.showMessageBox(win, {
      type: "error",
      title: "업데이트 오류",
      message: error.message || String(error),
    });
  });

  logUpdate("calling checkForUpdates()");
  autoUpdater.checkForUpdates().catch((e) => {
    logUpdate("checkForUpdates() threw:", e);
  });
}
// 어디서든 안 잡힌 에러가 나면 update.log에 남김 (원인 추적용)
process.on("uncaughtException", (err) => {
  logUpdate("UNCAUGHT EXCEPTION:", err);
  console.error("Uncaught:", err);
});
process.on("unhandledRejection", (err) => {
  logUpdate("UNHANDLED REJECTION:", err);
  console.error("Unhandled rejection:", err);
});

app
  .whenReady()
  .then(() => {
    console.log("main");
    logUpdate("app ready. version =", app.getVersion());
    try {
      createWindow();
    } catch (e) {
      logUpdate("createWindow() threw:", e);
    }
    try {
      setupAutoUpdater();
    } catch (e) {
      logUpdate("setupAutoUpdater() threw (sync):", e);
    }
  })
  .catch((e) => {
    logUpdate("whenReady chain threw:", e);
  });

// 디버깅용: 업데이트 로그 파일이 있는 폴더를 탐색기/Finder로 열기
ipcMain.on("open-update-log-folder", () => {
  shell.showItemInFolder(path.join(app.getPath("userData"), "update.log"));
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("get-settings", () => store.get("settings") || { baseUrl: "", pat: "" });
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
  const next = clampWindowPosition(pos.x ?? win.getPosition()[0], pos.y ?? win.getPosition()[1], winW, winH);
  win.setPosition(next.x, next.y);
  store.set("windowPos", next);
});
ipcMain.on("open-url", (_, url) => shell.openExternal(url));
ipcMain.on("quit-app", () => app.quit());

// GitHub
ipcMain.handle("gh:getSettings", () => store.get("github") || { baseUrl: "", token: "", repos: [] });
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

  const filePath = path.join(os.tmpdir(), `업무보고_${new Date().toISOString().slice(0, 10)}_${Date.now()}.xlsx`);

  XLSX.writeFile(workbook, filePath);

  const errorMessage = await shell.openPath(filePath);
  if (errorMessage) throw new Error(errorMessage);

  return { canceled: false, filePath };
});
