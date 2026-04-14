"use strict";

/* ══════════════════════════════════════════════
  WebGL 캐릭터
══════════════════════════════════════════════ */
function initQuokka(canvasId, videoId, speed = 1.0) {
  const vid = document.getElementById(videoId);
  const c = document.getElementById(canvasId);
  const gl = c.getContext("webgl", { premultipliedAlpha: false, alpha: true });
  c.width = 180;
  c.height = 245;
  const vsrc = `attribute vec2 p;attribute vec2 u;varying vec2 v;void main(){gl_Position=vec4(p,0,1);v=u;}`;
  const fsrc = `precision highp float;uniform sampler2D t;varying vec2 v;void main(){vec4 c=texture2D(t,v);float r=c.r,g=c.g,b=c.b;float cb=g-max(r,b);float spill=max(0.,cb-0.05);vec3 col=vec3(r+spill*0.5,g-spill,b+spill*0.5);float alpha=1.-smoothstep(0.14,0.42,cb);alpha=clamp(alpha,0.,1.);if(alpha<0.01){gl_FragColor=vec4(0.);}else{gl_FragColor=vec4(col*alpha,alpha);}}`;
  function mkSh(tp, src) {
    const s = gl.createShader(tp);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  const pr = gl.createProgram();
  gl.attachShader(pr, mkSh(gl.VERTEX_SHADER, vsrc));
  gl.attachShader(pr, mkSh(gl.FRAGMENT_SHADER, fsrc));
  gl.linkProgram(pr);
  gl.useProgram(pr);
  function vbuf(d) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
    return b;
  }
  const pb = vbuf(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
  const ub = vbuf(new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]));
  gl.bindBuffer(gl.ARRAY_BUFFER, pb);
  const pl = gl.getAttribLocation(pr, "p");
  gl.enableVertexAttribArray(pl);
  gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, ub);
  const ul = gl.getAttribLocation(pr, "u");
  gl.enableVertexAttribArray(ul);
  gl.vertexAttribPointer(ul, 2, gl.FLOAT, false, 0, 0);
  const tx = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tx);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  function updateVideoRatio() {
    if (!vid.videoWidth || !vid.videoHeight) return;
    const ca = c.width / c.height,
      va = vid.videoWidth / vid.videoHeight;
    let u0 = 0,
      u1 = 1,
      v0 = 0,
      v1 = 1;
    if (va > ca) {
      const s = ca / va;
      u0 = (1 - s) / 2;
      u1 = 1 - u0;
    } else {
      const s = va / ca;
      v0 = (1 - s) / 2;
      v1 = 1 - v0;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, ub);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([u0, v1, u1, v1, u0, v0, u1, v0]),
      gl.STATIC_DRAW,
    );
  }
  vid.addEventListener("loadedmetadata", updateVideoRatio);
  if (vid.readyState >= 1) updateVideoRatio();
  function draw() {
    if (vid.readyState >= 2) {
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, vid);
      gl.viewport(0, 0, c.width, c.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    if ("requestVideoFrameCallback" in vid) vid.requestVideoFrameCallback(draw);
    else requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  vid.addEventListener("playing", () => {
    if ("requestVideoFrameCallback" in vid) vid.requestVideoFrameCallback(draw);
  });
  vid.playbackRate = speed;
  vid.play().catch(() => {});
}
// initQuokka("c",  "vid",  0.95);
// initQuokka("c2", "vid2", 0.8);

/* ══════════════════════════════════════════════
  템플릿 팩토리
══════════════════════════════════════════════ */
function getTpl(id) {
  return document.getElementById(id).content.firstElementChild.cloneNode(true);
}
const mkProjTag = () => getTpl("projTagTemplate");
const mkGroupEl = () => getTpl("issueGroupTemplate");
const mkIssueEl = () => getTpl("issueCardTemplate");
const mkMemoDrop = () => getTpl("memoDropTemplate");
const mkLinkItem = () => getTpl("linkItemTemplate");
const mkIconOption = () => getTpl("iconOptionTemplate");
const mkBranchItem = () => getTpl("branchItemTemplate");
const mkChipBranch = () => getTpl("chipBranchTemplate");
const mkChipLink = () => getTpl("chipLinkTemplate");
const mkGhRepoRowItem = () => getTpl("ghRepoRowItemTemplate");
const mkGhHistItem = () => getTpl("ghHistItemTemplate");
const mkGhGroupHeader = () => getTpl("ghGroupHeaderTemplate");
const mkGhPRRow = () => getTpl("ghPRRowTemplate");
const mkNoResult = () => getTpl("noResultTemplate");

/* ══════════════════════════════════════════════
  아이콘 헬퍼
══════════════════════════════════════════════ */
const LINK_ICONS = [
  { id: "icoFigma", cls: "i-ico-figma", match: ["figma"] },
  {
    id: "icoDoc",
    cls: "i-ico-doc",
    match: ["notion", "docs.google", "confluence", "atlassian", "drive.google"],
  },
  { id: "icoGithub", cls: "i-ico-github", match: ["github", "gitlab"] },
  { id: "icoDesktop", cls: "i-ico-desktop", match: ["desktop", "pc"] },
  { id: "icoMobile", cls: "i-ico-mobile", match: ["mobile"] },
  { id: "icoFile", cls: "i-ico-file", match: ["file://"] },
  { id: "icoLink", cls: "i-ico-link", match: [] },
];
function detectIcon(url) {
  const u = (url || "").toLowerCase();
  return (
    LINK_ICONS.find((i) => i.match.some((m) => u.includes(m))) || LINK_ICONS[6]
  );
}
function linkLabel(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "file:") {
      const parts = u.pathname.split("/");
      return decodeURIComponent(parts[parts.length - 1]) || url;
    }
    return u.hostname.replace("www.", "");
  } catch {
    return url;
  }
}

/** 아이콘 피커 (LINK_ICONS 순회 → 동적 생성 불가피) */
function mkPicker(selectedId, onPick) {
  const wrap = document.createElement("div");
  wrap.className = "ico-picker";
  LINK_ICONS.forEach((ico) => {
    const opt = mkIconOption();
    if (ico.id === selectedId) opt.classList.add("selected");
    opt.querySelector(".ico").classList.add(ico.cls);
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      onPick(ico.id);
      wrap.classList.remove("show");
    });
    wrap.appendChild(opt);
  });
  return wrap;
}

/* ══════════════════════════════════════════════
  확인 팝업
══════════════════════════════════════════════ */
function showConfirm(msg, onOk) {
  const overlay = document.getElementById("confirmOverlay");
  document.getElementById("confirmMsg").textContent = msg;
  overlay.classList.add("show");
  const ok = document.getElementById("confirmOk");
  const cancel = document.getElementById("confirmCancel");
  function cleanup() {
    overlay.classList.remove("show");
    ok.onclick = null;
    cancel.onclick = null;
  }
  ok.onclick = (e) => {
    e.stopPropagation();
    cleanup();
    onOk();
  };
  cancel.onclick = (e) => {
    e.stopPropagation();
    cleanup();
  };
  overlay.onclick = (e) => {
    if (e.target === overlay) cleanup();
  };
}

/* ══════════════════════════════════════════════
  Dock 우클릭 메뉴 / 드래그
══════════════════════════════════════════════ */
const ctxMenu = document.getElementById("ctxMenu");
const ctxTheme = document.getElementById("ctxTheme");
const ctxQuit = document.getElementById("ctxQuit");
const dock = document.getElementById("dock");
const dockHandle = document.getElementById("dockHandle");

function updateCtxThemeLabel() {
  ctxTheme.textContent = document.body.classList.contains("light-mode")
    ? "🌙 다크 모드"
    : "☀ 라이트 모드";
}
function openCtxMenuByDock() {
  const rect = dock.getBoundingClientRect();
  const menuWidth = 140,
    menuHeight = 76,
    gap = 8;
  let left = rect.left + rect.width / 2 - menuWidth / 2;
  let top = rect.top - menuHeight - gap;
  left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
  top = Math.max(8, top);
  ctxMenu.style.left = left + "px";
  ctxMenu.style.top = top + "px";
  updateCtxThemeLabel();
  ctxMenu.classList.add("show");
}
dock.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  openCtxMenuByDock();
});
document.addEventListener("click", (e) => {
  if (!ctxMenu.contains(e.target)) ctxMenu.classList.remove("show");
});
ctxTheme.addEventListener("click", () => {
  ctxMenu.classList.remove("show");
  toggleTheme();
  updateCtxThemeLabel();
});
ctxQuit.addEventListener("click", () => window.api?.quit());

let dockDragging = false,
  dockOffsetX = 0,
  dockOffsetY = 0,
  dockRafId = null,
  dockPendingX = 0;
dockHandle.addEventListener("mousedown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dockDragging = true;
  dock.classList.add("is-dragging");
  dockOffsetX = e.screenX - window.screenX;
  dockOffsetY = e.screenY - window.screenY;
});
window.addEventListener("mouseup", () => {
  if (!dockDragging) return;
  dockDragging = false;
  dock.classList.remove("is-dragging");
  if (dockRafId) {
    cancelAnimationFrame(dockRafId);
    dockRafId = null;
  }
});
window.addEventListener("mousemove", (e) => {
  if (!dockDragging) return;
  dockPendingX = e.screenX - dockOffsetX;
  if (dockRafId) return;
  dockRafId = requestAnimationFrame(() => {
    window.api?.moveWindow?.({ x: dockPendingX, y: window.screenY });
    dockRafId = null;
  });
});
document.addEventListener("mousemove", (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const isInteractive =
    el &&
    (el.closest(".panel") ||
      el.closest(".gh-panel") ||
      el.closest(".dock") ||
      el.closest(".bbl") ||
      el.closest(".ctx-menu") ||
      el.closest(".confirm-overlay"));
  window.api?.setIgnoreMouse(!isInteractive);
});

/* ══════════════════════════════════════════════
  테마
══════════════════════════════════════════════ */
function applyTheme(mode) {
  document.body.classList.toggle("light-mode", mode === "light");
  localStorage.setItem("theme", mode);
}
function toggleTheme() {
  applyTheme(document.body.classList.contains("light-mode") ? "dark" : "light");
}
applyTheme(localStorage.getItem("theme") ?? "light");
updateCtxThemeLabel();

/* ══════════════════════════════════════════════
  이슈 타입 맵
══════════════════════════════════════════════ */
const TYPE_MAP = {
  Bug: { cls: "ityp-bug", ico: "i-type-bug", tbCls: "tb-bug" },
  Task: { cls: "ityp-task", ico: "i-type-task", tbCls: "tb-task" },
  Story: { cls: "ityp-story", ico: "i-type-story", tbCls: "tb-story" },
  Epic: { cls: "ityp-epic", ico: "i-type-epic", tbCls: "tb-epic" },
  Subtask: { cls: "ityp-sub", ico: "i-type-subtask", tbCls: "tb-sub" },
};

function memoToHtml(text) {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) =>
      line.replace(
        /(https?:\/\/[^\s]+)/g,
        (url) => `<a data-url="${url}">${url}</a>`,
      ),
    )
    .join("<br>");
}

/* ══════════════════════════════════════════════
  Jira 전역 상태
══════════════════════════════════════════════ */
let open = false,
  curF = "todo",
  curP = "all",
  isS = false;
let issues = [],
  memos = {},
  links = {},
  branches = {},
  pins = new Set(),
  q = "";
let activeDropEl = null;

const LABEL = { todo: "To Do", wip: "In Progress", done: "Done" };
const msgs = [
  "이슈 목록이에요! 📋",
  "파이팅! 💪",
  "PR 리뷰 잊지 마세요 👀",
  "커피 한잔 해요~ ☕",
];
let mi = 0;

function showB(msg, dur = 2800) {
  const b = document.getElementById("bbl");
  b.textContent = msg;
  b.classList.add("show");
  clearTimeout(window._bt);
  window._bt = setTimeout(() => b.classList.remove("show"), dur);
}
function fmt(d) {
  if (!d) return "";
  const diff = Math.floor((new Date() - new Date(d)) / 86400000);
  return diff === 0
    ? "오늘"
    : diff === 1
      ? "어제"
      : diff < 7
        ? `${diff}일 전`
        : diff < 30
          ? `${Math.floor(diff / 7)}주 전`
          : `${Math.floor(diff / 30)}달 전`;
}
function hl(text) {
  if (!q) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return String(text || "").replace(re, "<mark>$1</mark>");
}
function projKey(k) {
  return String(k || "").split("-")[0];
}
function catOf(issue) {
  if (issue.statusCategory === "done") return "done";
  const n = String(issue.status || "").toLowerCase();
  if (
    n.includes("progress") ||
    n.includes("wip") ||
    n.includes("testing") ||
    n.includes("review") ||
    n.includes("doing")
  )
    return "wip";
  return "todo";
}
function getFilteredIssues() {
  let list =
    curP === "all" ? issues : issues.filter((i) => projKey(i.key) === curP);
  if (curF === "pin") list = list.filter((i) => pins.has(i.key));
  else if (curF !== "all") list = list.filter((i) => catOf(i) === curF);
  return list;
}
function getProjects() {
  const base =
    curF === "pin"
      ? issues.filter((i) => pins.has(i.key))
      : curF === "all"
        ? issues
        : issues.filter((i) => catOf(i) === curF);
  return [...new Set(base.map((i) => projKey(i.key)).filter(Boolean))];
}
function setListState(type, msg = "") {
  document.getElementById("loadingState").hidden = type !== "loading";
  document.getElementById("errorState").hidden = type !== "error";
  document.getElementById("emptyState").hidden = type !== "empty";
  document.getElementById("issueList").hidden = type !== "list";
  if (type === "error") document.getElementById("errorState").textContent = msg;
}

/* ── 칩 렌더 ── */
function refreshInline(key, node) {
  const memo = memos[key] || "";
  const kLinks = links[key] || [];
  const kBranches = branches[key] || [];

  const txtEl = node.querySelector(".memo-inline-text");
  const firstLine = memo ? memo.split("\n")[0] : "";
  txtEl.textContent = firstLine;
  txtEl.style.display = firstLine ? "inline-block" : "none";

  const chipsWrap = node.querySelector(".chips-wrap");
  const chipsEl = node.querySelector(".chips");
  chipsEl.innerHTML = "";

  if (kBranches.length || kLinks.length) {
    chipsWrap.style.display = "flex";
    kBranches.forEach((b) => {
      const chip = mkChipBranch();
      chip.querySelector(".chip-text").textContent = "\u00a0" + b;
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(b);
      });
      chipsEl.appendChild(chip);
    });
    kLinks.forEach((l) => {
      const icoInfo =
        LINK_ICONS.find((i) => i.id === (l.iconId || detectIcon(l.url).id)) ||
        LINK_ICONS[6];
      const chip = mkChipLink();
      chip.querySelector(".chip-link-ico").classList.add(icoInfo.cls);
      chip.querySelector(".chip-text").textContent =
        "\u00a0" + (l.label || linkLabel(l.url));
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        window.api?.openUrl(l.url);
      });
      chipsEl.appendChild(chip);
    });
  } else {
    chipsWrap.style.display = "none";
  }
}

/* ── 브랜치 목록 ── */
function renderBranchList(drop, issue, node) {
  const bl = drop.querySelector(".branch-list");
  bl.innerHTML = "";
  (branches[issue.key] || []).forEach((b, idx) => {
    const row = mkBranchItem();
    row.querySelector(".branch-name").textContent = b;

    const readDiv = row.querySelector(".branch-read");
    const editDiv = row.querySelector(".branch-edit-area");
    const editInput = editDiv.querySelector(".branch-input");
    const saveBtn = editDiv.querySelector(".me-btn.ok");
    const cancelBtn = editDiv.querySelector(".me-btn:not(.ok)");
    editInput.value = b;

    row.querySelector(".branch-copy-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard?.writeText(b);
    });
    row.querySelector(".branch-edit-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      readDiv.hidden = true;
      editDiv.hidden = false;
      editInput.focus();
      editInput.select();
    });
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      readDiv.hidden = false;
      editDiv.hidden = true;
    });
    saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const v = editInput.value.trim();
      if (!v) return;
      branches[issue.key][idx] = v;
      window.api?.saveBranches?.(branches);
      renderBranchList(drop, issue, node);
      refreshInline(issue.key, node);
    });
    editInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveBtn.click();
      }
      if (e.key === "Escape") cancelBtn.click();
    });
    editInput.addEventListener("click", (e) => e.stopPropagation());
    row.querySelector(".branch-del-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      showConfirm(`'${b}' 브랜치를 삭제할까요?`, () => {
        branches[issue.key].splice(idx, 1);
        if (!branches[issue.key].length) delete branches[issue.key];
        window.api?.saveBranches?.(branches);
        renderBranchList(drop, issue, node);
        refreshInline(issue.key, node);
      });
    });
    bl.appendChild(row);
  });
}

/* ── 링크 목록 ── */
function renderLinkList(drop, issue, node) {
  const ll = drop.querySelector(".link-list");
  ll.innerHTML = "";
  (links[issue.key] || []).forEach((l, idx) => {
    const item = mkLinkItem();
    item.querySelector(".link-name-text").textContent =
      l.label || linkLabel(l.url);
    item.querySelector(".link-url-text").textContent = l.url;
    item.querySelector(".le-name").value = l.label || linkLabel(l.url);
    item.querySelector(".le-url").value = l.url;

    const icoInfo =
      LINK_ICONS.find((i) => i.id === (l.iconId || detectIcon(l.url).id)) ||
      LINK_ICONS[6];
    const icoSpan = item.querySelector(".link-ico-span");
    const icoBtn = item.querySelector(".link-ico-btn");
    icoSpan.classList.add(icoInfo.cls);

    const picker = mkPicker(l.iconId || detectIcon(l.url).id, (iconId) => {
      l.iconId = iconId;
      window.api?.saveLinks?.(links);
      renderLinkList(drop, issue, node);
      refreshInline(issue.key, node);
    });
    icoBtn.appendChild(picker);
    icoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      picker.classList.toggle("show");
    });

    item.querySelector(".la-edit").addEventListener("click", (e) => {
      e.stopPropagation();
      item.querySelector(".link-edit").classList.toggle("show");
    });
    item.querySelector(".la-del").addEventListener("click", (e) => {
      e.stopPropagation();
      showConfirm("링크를 삭제할까요?", () => {
        if (!links[issue.key]) return;
        links[issue.key].splice(idx, 1);
        if (!links[issue.key].length) delete links[issue.key];
        window.api?.saveLinks?.(links);
        renderLinkList(drop, issue, node);
        refreshInline(issue.key, node);
      });
    });
    item.querySelector(".le-cancel").addEventListener("click", (e) => {
      e.stopPropagation();
      item.querySelector(".link-edit").classList.remove("show");
    });
    item.querySelector(".le-ok").addEventListener("click", (e) => {
      e.stopPropagation();
      l.label = item.querySelector(".le-name").value.trim();
      l.url = item.querySelector(".le-url").value.trim();
      window.api?.saveLinks?.(links);
      item.querySelector(".link-edit").classList.remove("show");
      renderLinkList(drop, issue, node);
      refreshInline(issue.key, node);
    });
    item
      .querySelectorAll(".le-input")
      .forEach((i) => i.addEventListener("click", (e) => e.stopPropagation()));
    ll.appendChild(item);
  });
}

/* ── 메모 드롭 syncDrop ── */
function syncDrop(drop, issue, node) {
  const memo = memos[issue.key] || "";
  const readEl = drop.querySelector(".memo-read");
  const span = readEl.querySelector("span");
  drop.querySelector(".memo-ta").value = memo;
  if (memo) {
    span.className = "memo-read-text";
    span.innerHTML = memoToHtml(memo);
  } else {
    span.className = "memo-read-empty";
    span.textContent = "메모 없음";
  }
  drop.querySelectorAll(".memo-read-text a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.stopPropagation();
      window.api?.openUrl(a.dataset.url || a.textContent);
    });
  });
  renderBranchList(drop, issue, node);
  renderLinkList(drop, issue, node);
}

/* ── 이슈 카드 생성 ── */
function createCard(issue) {
  const node = mkIssueEl();
  const cat = catOf(issue);

  /* Jira 키 버튼 */
  const ikBtn = node.querySelector(".ik");
  const ikKey = ikBtn.querySelector(".ik-key");
  ikKey.innerHTML = hl(issue.key || "");
  ikBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    window.api?.openUrl(issue.url);
  });

  /* 이슈 제목 */
  node.querySelector(".it").innerHTML = hl(issue.summary || "");

  /* 상태 뱃지 */
  const sbEl = node.querySelector(".sb");
  sbEl.classList.add("sb-" + cat);
  sbEl.textContent = issue.status || LABEL[cat] || "To Do";

  /* 타입 뱃지 */
  const ti = TYPE_MAP[issue.issueType] || TYPE_MAP["Task"];
  const tbEl = node.querySelector(".type-badge");
  tbEl.classList.add(ti.tbCls || "tb-task");
  tbEl.querySelector(".type-badge-ico").classList.add(ti.ico);
  tbEl.querySelector(".type-badge-lbl").textContent = issue.issueType || "Task";

  /* 날짜 */
  node.querySelector(".idate").textContent = fmt(issue.updated);

  /* 핀 버튼 */
  const pinBtn = node.querySelector(".pin-btn");
  if (pins.has(issue.key)) pinBtn.classList.add("pinned");
  pinBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    pins.has(issue.key) ? pins.delete(issue.key) : pins.add(String(issue.key));
    pinBtn.classList.toggle("pinned", pins.has(issue.key));
    document.getElementById("n-pin").textContent = pins.size;
    window.api?.savePins?.([...pins]);
    if (curF === "pin") render();
  });

  /* 메모 드롭다운 */
  const drop = mkMemoDrop();

  /* 메모 편집 트리거 */
  drop.querySelector(".memo-edit-trigger").addEventListener("click", (e) => {
    e.stopPropagation();
    drop.querySelector(".memo-ta").value = memos[issue.key] || "";
    drop.querySelector(".memo-read").style.display = "none";
    drop.querySelector(".memo-edit-area").classList.add("show");
    drop.querySelector(".memo-ta").focus();
  });
  drop.querySelector(".memo-del-trigger").addEventListener("click", (e) => {
    e.stopPropagation();
    if (!memos[issue.key]) return;
    showConfirm("메모를 삭제할까요?", () => {
      delete memos[issue.key];
      window.api?.saveMemos(memos);
      syncDrop(drop, issue, node);
      refreshInline(issue.key, node);
    });
  });
  drop.querySelector(".memo-cancel").addEventListener("click", (e) => {
    e.stopPropagation();
    drop.querySelector(".memo-ta").value = memos[issue.key] || "";
    drop.querySelector(".memo-read").style.display = "";
    drop.querySelector(".memo-edit-area").classList.remove("show");
  });
  drop.querySelector(".memo-ok").addEventListener("click", (e) => {
    e.stopPropagation();
    const val = drop.querySelector(".memo-ta").value.trim();
    if (val) memos[issue.key] = val;
    else delete memos[issue.key];
    window.api?.saveMemos(memos);
    const readEl = drop.querySelector(".memo-read");
    const span = readEl.querySelector("span");
    span.className = val ? "memo-read-text" : "memo-read-empty";
    span.innerHTML = val ? memoToHtml(val) : "메모 없음";
    span.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", (ev) => {
        ev.stopPropagation();
        window.api?.openUrl(a.dataset.url || a.textContent);
      });
    });
    readEl.style.display = "";
    drop.querySelector(".memo-edit-area").classList.remove("show");
    refreshInline(issue.key, node);
  });

  /* 브랜치 추가 */
  const branchInput = drop.querySelector(".branch-input");
  const branchAddBtn = drop.querySelector(".branch-add-btn");
  const doAddBranch = () => {
    const val = branchInput.value.trim();
    if (!val) return;
    if (!branches[issue.key]) branches[issue.key] = [];
    if (!branches[issue.key].includes(val)) {
      branches[issue.key].push(val);
      window.api?.saveBranches?.(branches);
      refreshInline(issue.key, node);
    }
    branchInput.value = "";
    renderBranchList(drop, issue, node);
  };
  branchAddBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    doAddBranch();
  });
  branchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      doAddBranch();
    }
  });
  branchInput.addEventListener("click", (e) => e.stopPropagation());

  /* 링크 추가 */
  const addInput = drop.querySelector(".link-input");
  const addBtn = drop.querySelector(".link-add-btn");
  const doAdd = () => {
    const url = addInput.value.trim();
    if (!url) return;
    if (!links[issue.key]) links[issue.key] = [];
    links[issue.key].push({ url, label: "", iconId: detectIcon(url).id });
    addInput.value = "";
    window.api?.saveLinks?.(links);
    renderLinkList(drop, issue, node);
    refreshInline(issue.key, node);
    setTimeout(() => drop.querySelector(".link-input")?.focus(), 50);
  };
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    doAdd();
  });
  addInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      doAdd();
    }
  });
  addInput.addEventListener("click", (e) => e.stopPropagation());

  /* 피커 닫기 */
  drop.addEventListener("click", (e) => {
    if (!e.target.closest(".link-ico-btn") && !e.target.closest(".ico-picker"))
      drop
        .querySelectorAll(".ico-picker")
        .forEach((p) => p.classList.remove("show"));
  });

  syncDrop(drop, issue, node);
  refreshInline(issue.key, node);

  /* 카드 클릭 → 드롭 토글 */
  node.addEventListener("click", (e) => {
    if (e.target.closest(".ik") || e.target.closest(".pin-btn")) return;
    const isOpen = drop.classList.contains("open");
    if (activeDropEl && activeDropEl !== drop)
      activeDropEl.classList.remove("open");
    if (isOpen) {
      drop.classList.remove("open");
      activeDropEl = null;
    } else {
      syncDrop(drop, issue, node);
      drop.classList.add("open");
      activeDropEl = drop;
    }
  });

  const wrapper = document.createElement("div");
  wrapper.appendChild(node);
  wrapper.appendChild(drop);
  return wrapper;
}

/* ── 렌더 ── */
function render() {
  document.getElementById("n-todo").textContent = issues.filter(
    (i) => catOf(i) === "todo",
  ).length;
  document.getElementById("n-wip").textContent = issues.filter(
    (i) => catOf(i) === "wip",
  ).length;
  document.getElementById("n-done").textContent = issues.filter(
    (i) => catOf(i) === "done",
  ).length;
  document.getElementById("n-pin").textContent = pins.size;
  activeDropEl = null;

  const il = document.getElementById("issueList");
  il.innerHTML = "";
  let any = false;

  if (q) {
    let list =
      curP === "all" ? issues : issues.filter((i) => projKey(i.key) === curP);
    list = list.filter(
      (i) =>
        (i.key || "").toLowerCase().includes(q) ||
        (i.summary || "").toLowerCase().includes(q),
    );
    if (!list.length) {
      const nr = mkNoResult();
      nr.querySelector(".no-result-msg").textContent =
        `"${q}" 검색 결과가 없어요`;
      il.appendChild(nr);
      setListState("list");
      return;
    }
    [
      ["To Do", list.filter((i) => catOf(i) === "todo")],
      ["In Progress", list.filter((i) => catOf(i) === "wip")],
      ["Done", list.filter((i) => catOf(i) === "done")],
    ].forEach(([label, items]) => {
      if (!items.length) return;
      any = true;
      const g = mkGroupEl();
      g.querySelector(".group-label").textContent = label;
      g.querySelector(".group-count").textContent = items.length;
      items.forEach((i) =>
        g.querySelector(".group-items").appendChild(createCard(i)),
      );
      il.appendChild(g);
    });
    if (any) setListState("list");
    return;
  }

  const list = getFilteredIssues();
  if (curF === "pin") {
    if (list.length) {
      any = true;
      const g = mkGroupEl();
      g.querySelector(".gh").classList.add("gh-pin");
      g.querySelector(".group-label").textContent = "Pin";
      g.querySelector(".group-count").textContent = list.length;
      list.forEach((i) =>
        g.querySelector(".group-items").appendChild(createCard(i)),
      );
      il.appendChild(g);
    }
  } else {
    if (list.length) {
      any = true;
      const g = mkGroupEl();
      g.querySelector(".group-label").textContent = LABEL[curF] || curF;
      g.querySelector(".group-count").textContent = list.length;
      list.forEach((i) =>
        g.querySelector(".group-items").appendChild(createCard(i)),
      );
      il.appendChild(g);
    }
  }
  if (!any) setListState("empty");
  else setListState("list");
}

/* ══════════════════════════════════════════════
  Jira 패널 제어
══════════════════════════════════════════════ */
function togglePanel() {
  open = !open;
  document.getElementById("panel").classList.toggle("open", open);
  if (open) {
    if (ghState?.open) {
      ghState.open = false;
      document.getElementById("ghPanel").classList.remove("open");
    }
    showB(msgs[mi++ % msgs.length]);
    loadIssues();
  }
}
function setFilter(cat) {
  curF = cat;
  curP = "all";
  document.body.classList.toggle("pin-mode", cat === "pin");
  document
    .querySelectorAll(".sc,.pin-card")
    .forEach((b) => b.classList.remove("on"));
  if (cat === "pin") document.getElementById("pinCard").classList.add("on");
  else document.querySelector(`.sc[data-filter="${cat}"]`)?.classList.add("on");
  renderProjBar();
  render();
}
function setProj(p) {
  curP = p;
  renderProjBar();
  render();
}
function onSearch(val) {
  q = val.trim().toLowerCase();
  document.getElementById("searchClear").classList.toggle("vis", !!q);
  document.getElementById("statRow").classList.toggle("searching", !!q);
  render();
}
function clearSearch() {
  q = "";
  document.getElementById("searchInput").value = "";
  document.getElementById("searchClear").classList.remove("vis");
  document.getElementById("statRow").classList.remove("searching");
  render();
}
function renderProjBar() {
  const ps = getProjects();
  const bar = document.getElementById("projBar");
  bar.innerHTML = "";
  if (isS || ps.length <= 1) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const mk = (label, active, onClick) => {
    const t = mkProjTag();
    t.textContent = label;
    t.classList.toggle("on", active);
    t.addEventListener("click", onClick);
    bar.appendChild(t);
  };
  mk("all", curP === "all", () => setProj("all"));
  ps.forEach((p) => mk(p, curP === p, () => setProj(p)));
}
async function loadIssues() {
  if (isS) return;
  setListState("loading");
  try {
    const result = await window.api.fetchIssues();
    jiraRenderUserBadge(result.login, result.initials);
    issues = result.issues || [];

    // pin된 이슈 중 현재 목록에 없는 것만 추가로 fetch
    const missingPinKeys = [...pins].filter(
      (k) => !issues.some((i) => i.key === k),
    );
    if (missingPinKeys.length) {
      try {
        const pinResult = await window.api.fetchIssuesByKeys(missingPinKeys);
        console.log("[PIN] result:", pinResult);
        if (pinResult?.issues?.length)
          issues = [...issues, ...pinResult.issues];
      } catch (e2) {
        console.warn("[PIN] 핀 이슈 추가 fetch 실패:", e2);
        console.warn("[PIN] missingPinKeys:", missingPinKeys);
        // ipc 에러 상세
        if (e2?.message) console.warn("[PIN] message:", e2.message);
      }
    }

    renderProjBar();
    render();
  } catch (e) {
    const m = String(e?.message || "불러오기 실패");
    setListState(
      "error",
      m.includes("설정")
        ? "⚙️ 설정에서 Jira URL과 PAT를 입력해주세요!"
        : `❌ ${m}`,
    );
  }
}
async function toggleSettings() {
  isS = !isS;
  document.getElementById("issueView").hidden = isS;
  document.getElementById("settingsView").hidden = !isS;
  document.getElementById("statRow").hidden = isS;
  document.getElementById("rbtn").hidden = isS;
  document.getElementById("searchWrap").hidden = isS;
  document.getElementById("ptitle").textContent = isS
    ? "Setting"
    : "Jira Issues";
  const sb = document.getElementById("settingsBtn");
  sb.classList.toggle("button-back", isS);
  sb.classList.toggle("button-setting", !isS);
  renderProjBar();
  if (isS && window.api?.getSettings) {
    const s = await window.api.getSettings();
    document.getElementById("iUrl").value = s.baseUrl || "";
    document.getElementById("iPat").value = s.pat || "";
    document.getElementById("iDays").value = String(s.doneDays || 60);
  }
}
async function saveSettings() {
  const baseUrl = document
    .getElementById("iUrl")
    .value.trim()
    .replace(/\/$/, "");
  const pat = document.getElementById("iPat").value.trim();
  const doneDays = parseInt(document.getElementById("iDays").value) || 60;
  if (!baseUrl || !pat) {
    showB("URL과 PAT를 모두 입력해주세요!");
    return;
  }
  await window.api?.saveSettings({ baseUrl, pat, doneDays });
  showB("설정 저장! 이슈 불러올게요 📋");
  await toggleSettings();
  loadIssues();
}
function jiraRenderUserBadge(login, initials) {
  const el = document.getElementById("jiraAvatar");
  const un = document.getElementById("jiraUsername");
  if (!el || !un || !login) return;
  un.textContent = login;
  el.textContent = initials || login.slice(0, 2).toUpperCase();
}

/* Jira 이벤트 */
document.getElementById("dockBtn").addEventListener("click", togglePanel);
document.getElementById("jiraCloseBtn").addEventListener("click", () => {
  if (open) togglePanel();
});
document.getElementById("rbtn").addEventListener("click", loadIssues);
document
  .getElementById("settingsBtn")
  .addEventListener("click", toggleSettings);
document
  .getElementById("saveSettingsBtn")
  .addEventListener("click", saveSettings);
document
  .getElementById("pinCard")
  .addEventListener("click", () => setFilter("pin"));
document
  .querySelectorAll(".sc[data-filter]")
  .forEach((b) =>
    b.addEventListener("click", () => setFilter(b.dataset.filter)),
  );
document
  .getElementById("searchInput")
  .addEventListener("input", (e) => onSearch(e.target.value));
document.getElementById("searchClear").addEventListener("click", clearSearch);
document.getElementById("searchInput").addEventListener("keydown", (e) => {
  if (e.key === "Escape") clearSearch();
});

/* ══════════════════════════════════════════════
  GitHub 패널
══════════════════════════════════════════════ */
const ghState = {
  open: false,
  tab: "home",
  prFilter: "all",
  query: "",
  isSettings: false,
  prs: [],
  token: "",
  baseUrl: "",
  repos: [],
  history: [],
  selectedBaseByRepo: {},
  login: "",
  avatarUrl: "",
  defaultBranches: [],
};

const ghPanel = document.getElementById("ghPanel");
const ghPRSearchInput = document.getElementById("ghPRSearchInput");
const ghPRSearchClear = document.getElementById("ghPRSearchClear");

function ghFmt(d) {
  if (!d) return "";
  const diff = Math.floor((new Date() - new Date(d)) / 86400000);
  return diff === 0
    ? "오늘"
    : diff === 1
      ? "어제"
      : diff < 7
        ? `${diff}일 전`
        : diff < 30
          ? `${Math.floor(diff / 7)}주 전`
          : `${Math.floor(diff / 30)}달 전`;
}
function ghRenderUserBadge() {
  const el = document.getElementById("ghAvatar");
  const un = document.getElementById("ghUsername");
  if (!el || !un || !ghState.login) return;
  un.textContent = ghState.login;
  el.textContent = ghState.login.slice(0, 2).toUpperCase();
}
function ghNormalizeBaseUrl(url = "") {
  return url.trim().replace(/\/$/, "");
}
function ghRepoWebUrl(repo) {
  return `${ghState.baseUrl}/${repo.owner}/${repo.repo}`;
}

function ghSetListState(type, msg = "") {
  if (ghState.tab !== "prs") return;
  document.getElementById("ghListView").hidden = false;
  document.getElementById("ghLoadingState").hidden = type !== "loading";
  document.getElementById("ghErrorState").hidden = type !== "error";
  document.getElementById("ghEmptyState").hidden = type !== "empty";
  document.getElementById("ghPRList").hidden = type !== "list";
  if (type === "error")
    document.getElementById("ghErrorState").textContent = msg;
}
function ghSyncPrCounts() {
  const openList = ghState.prs.filter((pr) => pr.stateGroup === "open");
  const doneList = ghState.prs.filter((pr) => pr.stateGroup === "done");
  document.getElementById("gh-n-open").textContent = ghState.prs.length;
  document.getElementById("gh-n-open-pill").textContent = openList.length;
  document.getElementById("gh-n-done").textContent = doneList.length;
  document.getElementById("gh-n-all").textContent = ghState.prs.length;
  ghSyncFilterButtons();
}
function ghSetView(view) {
  document.getElementById("ghHomeView").hidden = view !== "home";
  document.getElementById("ghListView").hidden = view !== "list";
  document.getElementById("ghBuilderView").hidden = view !== "builder";
  document.getElementById("ghSettingsView").hidden = view !== "settings";
}
function ghSyncFilterButtons() {
  document
    .querySelectorAll("[data-gh-filter]")
    .forEach((btn) =>
      btn.classList.toggle("on", btn.dataset.ghFilter === ghState.prFilter),
    );
}

async function ghLoadSettings() {
  let s = {};
  try {
    s = (await window.api?.getGHSettings?.()) ?? {};
  } catch (e) {}
  ghState.token = s.token || "";
  ghState.baseUrl = ghNormalizeBaseUrl(s.baseUrl || "");
  ghState.defaultBranches = Array.isArray(s.defaultBranches)
    ? s.defaultBranches.filter(Boolean)
    : String(s.defaultBranches || "main,dev,stg")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
  ghState.repos = Array.isArray(s.repos)
    ? s.repos.map((r) => ({
        owner: r.owner,
        repo: r.repo,
        branches: Array.isArray(r.branches)
          ? r.branches
          : String(r.branches || "")
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
      }))
    : [];
}
async function ghLoadHistory() {
  try {
    ghState.history = (await window.api?.getGHHistory?.()) || [];
  } catch (e) {
    ghState.history = [];
  }
}
async function ghSaveSettings() {
  const token = document.getElementById("ghIToken").value.trim();
  const baseUrl = ghNormalizeBaseUrl(
    document.getElementById("ghIBaseUrl").value,
  );
  const defaultBranches = (
    document.getElementById("ghDefaultBranches").value.trim() || "main,dev,stg"
  )
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const rows = document.querySelectorAll("#ghRepoList .gh-repo-row");
  const repos = [];
  rows.forEach((row) => {
    const full = row.querySelector(".gh-repo-full").value.trim();
    const branchesRaw = row.querySelector(".gh-repo-branches").value.trim();
    const [owner, repo] = full.split("/");
    if (!owner || !repo) return;
    repos.push({
      owner,
      repo,
      branches: branchesRaw
        ? branchesRaw
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : [],
    });
  });
  await window.api?.saveGHSettings?.({
    token,
    baseUrl,
    repos,
    defaultBranches,
  });
  ghState.token = token;
  ghState.baseUrl = baseUrl;
  ghState.defaultBranches = defaultBranches;
  ghState.repos = repos;
}
function ghAddRepoRow(data = {}) {
  const row = getTpl("ghRepoRowTemplate");
  row.querySelector(".gh-repo-full").value =
    data.owner && data.repo ? `${data.owner}/${data.repo}` : "";
  row.querySelector(".gh-repo-branches").value = Array.isArray(data.branches)
    ? data.branches.join(",")
    : data.branches || "";
  row
    .querySelector(".gh-repo-del")
    .addEventListener("click", () => row.remove());
  document.getElementById("ghRepoList").appendChild(row);
}
function ghRenderSettingsUI() {
  document.getElementById("ghIBaseUrl").value = ghState.baseUrl;
  document.getElementById("ghIToken").value = ghState.token;
  document.getElementById("ghDefaultBranches").value = (
    ghState.defaultBranches || []
  ).join(",");
  document.getElementById("ghRepoList").innerHTML = "";
  ghState.repos.forEach(ghAddRepoRow);
}
function ghPushHistory(item) {
  const next = [
    item,
    ...ghState.history.filter((v) => v.url !== item.url),
  ].slice(0, 10);
  ghState.history = next;
  window.api?.saveGHHistory?.(next);
  ghRenderHome();
}

/* ── GitHub 홈 ── */
function ghRenderHome() {
  const shortcutList = document.getElementById("ghShortcutList");
  const historyList = document.getElementById("ghHistoryList");
  const searchInput = document.getElementById("ghRepoSearchInput");

  function renderRepoList(filter = "") {
    shortcutList.innerHTML = "";
    const filtered = ghState.repos.filter(
      (r) =>
        !filter ||
        r.repo.toLowerCase().includes(filter) ||
        r.owner.toLowerCase().includes(filter),
    );
    if (!ghState.repos.length) {
      shortcutList.innerHTML =
        '<div class="state empty" style="font-size:11px;padding:10px 0">⚙ 설정에서 레포를 추가하세요</div>';
      return;
    }
    if (!filtered.length) {
      shortcutList.innerHTML =
        '<div class="state empty" style="font-size:11px;padding:8px 0">검색 결과가 없어요</div>';
      return;
    }
    filtered.forEach((repo) => {
      const row = mkGhRepoRowItem();
      row.querySelector(".gh-repo-row-name").textContent = repo.repo;
      row.querySelector(".gh-repo-row-owner").textContent = repo.owner;
      row.addEventListener("click", () =>
        window.api?.openUrl(ghRepoWebUrl(repo)),
      );
      shortcutList.appendChild(row);
    });
  }

  renderRepoList();
  if (searchInput) {
    searchInput.value = "";
    searchInput.oninput = (e) =>
      renderRepoList(e.target.value.trim().toLowerCase());
  }

  historyList.innerHTML = "";
  if (!ghState.history.length) {
    historyList.innerHTML =
      '<div class="state empty" style="font-size:11px;padding:8px 0">최근 생성 링크가 없어요</div>';
    return;
  }
  ghState.history.forEach((item) => {
    const row = mkGhHistItem();
    const typeCls = item.type === "PR" ? "gh-hist-pr" : "gh-hist-diff";
    row.querySelector(".gh-hist-type").textContent = item.type;
    row.querySelector(".gh-hist-type").classList.add(typeCls);
    row.querySelector(".gh-hist-label").textContent = item.label;

    let shortUrl = item.url;
    try {
      shortUrl = new URL(item.url).pathname.replace(/^\/[^/]+\/[^/]+\//, "");
    } catch {}
    row.querySelector(".gh-hist-url").textContent = shortUrl;

    row.querySelector(".gh-hist-open").addEventListener("click", (e) => {
      e.stopPropagation();
      window.api?.openUrl(item.url);
    });
    row.querySelector(".gh-hist-copy").addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard?.writeText(item.url);
    });
    historyList.appendChild(row);
  });
}

/* ── GitHub PR 렌더 ── */
function ghGroupByRepo(list) {
  const map = new Map();
  list.forEach((pr) => {
    const key = `${pr.owner}/${pr.repo}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(pr);
  });
  return [...map.entries()];
}
function ghRenderPRs() {
  const openList = ghState.prs.filter((pr) => pr.stateGroup === "open");
  const doneList = ghState.prs.filter((pr) => pr.stateGroup === "done");
  ghSyncPrCounts();

  let list =
    ghState.prFilter === "open"
      ? openList
      : ghState.prFilter === "done"
        ? doneList
        : ghState.prs.slice();
  const q = ghState.query.trim().toLowerCase();
  if (q) {
    list = list.filter((pr) =>
      [pr.title, pr.head, pr.base, pr.owner, pr.repo, String(pr.number)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }

  const ghPRList = document.getElementById("ghPRList");
  ghPRList.innerHTML = "";
  if (!list.length) {
    ghSetListState("empty");
    return;
  }

  ghGroupByRepo(list).forEach(([repoName, items]) => {
    /* 그룹 헤더 */
    const header = mkGhGroupHeader();
    const repoObj = ghState.repos.find(
      (r) => `${r.owner}/${r.repo}` === repoName,
    );
    const repoUrl = repoObj ? ghRepoWebUrl(repoObj) : "";
    header.querySelector(".gh-group-name").textContent = repoName;
    header.querySelector(".gh-group-count").textContent = `${items.length}개`;
    if (repoUrl) {
      const linkBtn = document.createElement("button");
      linkBtn.className = "gh-group-link";
      linkBtn.type = "button";
      linkBtn.title = "레포 열기";
      linkBtn.innerHTML = `<span class="ico ico-sm i-open"></span>`;
      linkBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.api?.openUrl(repoUrl);
      });
      header.appendChild(linkBtn);
    }
    ghPRList.appendChild(header);

    /* PR 행들 */
    items.forEach((pr) => {
      const row = mkGhPRRow();
      const stateCls =
        pr.stateGroup === "open" ? "gh-pr-state-open" : "gh-pr-state-done";
      row.querySelector(".gh-pr-state").classList.add(stateCls);
      row.querySelector(".gh-pr-state").textContent = pr.stateLabel;
      row.querySelector(".gh-pr-row-num").textContent = `#${pr.number}`;
      row.querySelector(".gh-pr-row-repo").textContent =
        `${pr.owner}/${pr.repo}`;
      row.querySelector(".gh-pr-row-time").textContent = ghFmt(pr.updatedAt);
      row.querySelector(".gh-pr-row-title").textContent = pr.title;
      row.querySelector(".gh-pr-row-sub").textContent =
        `${pr.head} → ${pr.base}`;

      const prUrl = pr.url;
      const diffUrl = `${ghState.baseUrl}/${pr.owner}/${pr.repo}/compare/${encodeURIComponent(pr.base)}...${encodeURIComponent(pr.head)}?expand=1`;

      row.querySelector(".gh-pr-open-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        ghPushHistory({
          type: "PR",
          label: `${pr.owner}/${pr.repo} #${pr.number}`,
          url: prUrl,
        });
        window.api?.openUrl(prUrl);
      });
      row.querySelector(".gh-pr-diff-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        ghPushHistory({
          type: "DIFF",
          label: `${pr.owner}/${pr.repo}`,
          url: diffUrl,
        });
        window.api?.openUrl(diffUrl);
      });
      row.querySelector(".gh-pr-copy-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(prUrl);
      });
      row.addEventListener("click", () => {
        ghPushHistory({
          type: "PR",
          label: `${pr.owner}/${pr.repo} #${pr.number}`,
          url: prUrl,
        });
        window.api?.openUrl(prUrl);
      });
      ghPRList.appendChild(row);
    });
  });
  ghSetListState("list");
}

/* ── GitHub 빌더 ── */
function ghRenderBuilder() {
  const repoSel = document.getElementById("ghBuildRepo");
  repoSel.innerHTML = ghState.repos
    .map(
      (repo) =>
        `<option value="${repo.owner}/${repo.repo}">${repo.owner}/${repo.repo}</option>`,
    )
    .join("");
  if (!repoSel.value && ghState.repos[0])
    repoSel.value = `${ghState.repos[0].owner}/${ghState.repos[0].repo}`;

  function renderBranches() {
    const repo = ghState.repos.find(
      (r) => `${r.owner}/${r.repo}` === repoSel.value,
    );
    const bar = document.getElementById("ghBranchBar");
    bar.innerHTML = "";
    const branchesList = repo?.branches?.length
      ? repo.branches
      : ghState.defaultBranches?.length
        ? ghState.defaultBranches
        : ["main", "dev", "stg"];
    const selected =
      ghState.selectedBaseByRepo[repoSel.value] || branchesList[0];
    ghState.selectedBaseByRepo[repoSel.value] = selected;
    branchesList.forEach((branch) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `ptag${branch === ghState.selectedBaseByRepo[repoSel.value] ? " on" : ""}`;
      btn.textContent = branch;
      btn.addEventListener("click", () => {
        ghState.selectedBaseByRepo[repoSel.value] = branch;
        renderBranches();
      });
      bar.appendChild(btn);
    });
  }
  repoSel.onchange = renderBranches;
  renderBranches();
}

async function ghFetchPRs({ silent = false } = {}) {
  if (!ghState.token || !ghState.baseUrl || !ghState.repos.length) {
    if (!silent)
      ghSetListState(
        "error",
        "⚙️ 설정에서 Base URL, PAT, 레포를 입력해주세요!",
      );
    else {
      ghState.prs = [];
      ghSyncPrCounts();
    }
    return;
  }
  if (!silent) ghSetListState("loading");
  try {
    const result =
      (await window.api?.fetchGHPRs?.(
        ghState.baseUrl,
        ghState.token,
        ghState.repos,
      )) || {};
    ghState.prs = Array.isArray(result.prs) ? result.prs : [];
    ghState.login = result.login || "";
    ghState.avatarUrl = result.avatarUrl || "";
    ghRenderUserBadge();
    if (ghState.tab === "prs") ghRenderPRs();
    else ghSyncPrCounts();
  } catch (e) {
    if (!silent)
      ghSetListState("error", `❌ ${e.message || "PR 불러오기 실패"}`);
  }
}

function ghSetTab(tab) {
  ghState.tab = tab;
  document
    .querySelectorAll("[data-gh-tab]")
    .forEach((btn) => btn.classList.toggle("on", btn.dataset.ghTab === tab));
  if (tab === "home") {
    ghSetView("home");
    ghRenderHome();
  } else if (tab === "builder") {
    ghSetView("builder");
    ghRenderBuilder();
  } else {
    ghSetView("list");
    ghRenderPRs();
  }
}
async function ghToggleSettings() {
  ghState.isSettings = !ghState.isSettings;
  const btn = document.getElementById("ghSettingsBtn");
  btn.classList.toggle("button-back", ghState.isSettings);
  btn.classList.toggle("button-setting", !ghState.isSettings);
  document.getElementById("ghTabRow").hidden = ghState.isSettings;
  document.getElementById("ghRbtn").hidden = ghState.isSettings;
  document.getElementById("ghPtitle").textContent = ghState.isSettings
    ? "Setting"
    : "GitHub";
  if (ghState.isSettings) {
    await ghLoadSettings();
    ghRenderSettingsUI();
    ghSetView("settings");
  } else {
    ghSetTab(ghState.tab);
    if (ghState.tab === "prs") await ghFetchPRs();
  }
}
async function ghTogglePanel() {
  ghState.open = !ghState.open;
  ghPanel.classList.toggle("open", ghState.open);
  if (ghState.open) {
    if (open) {
      open = false;
      document.getElementById("panel").classList.remove("open");
    }
    ghState.isSettings = false;
    document.getElementById("ghSettingsBtn").classList.remove("button-back");
    document.getElementById("ghSettingsBtn").classList.add("button-setting");
    document.getElementById("ghTabRow").hidden = false;
    document.getElementById("ghRbtn").hidden = false;
    document.getElementById("ghPtitle").textContent = "GitHub";
    await ghLoadSettings();
    await ghLoadHistory();
    if (ghState.token && ghState.baseUrl && ghState.repos.length) {
      await ghFetchPRs({ silent: ghState.tab !== "prs" });
    } else {
      ["gh-n-open", "gh-n-open-pill", "gh-n-done", "gh-n-all"].forEach(
        (id) => (document.getElementById(id).textContent = "0"),
      );
    }
    if (ghState.tab === "home") ghRenderHome();
    else if (ghState.tab === "builder") ghRenderBuilder();
    ghSetTab(ghState.tab);
  }
}

/* GitHub 이벤트 */
document.getElementById("ghDockBtn").addEventListener("click", ghTogglePanel);
document.getElementById("ghCloseBtn").addEventListener("click", () => {
  if (ghState.open) ghTogglePanel();
});
document.getElementById("ghRbtn").addEventListener("click", () => {
  if (ghState.tab === "prs") ghFetchPRs();
  else if (ghState.tab === "home")
    ghFetchPRs({ silent: true }).then(() => ghRenderHome());
  else ghRenderBuilder();
});
document
  .getElementById("ghSettingsBtn")
  .addEventListener("click", ghToggleSettings);
document
  .getElementById("ghAddRepoBtn")
  .addEventListener("click", () =>
    ghAddRepoRow({ branches: ghState.defaultBranches }),
  );
document.querySelectorAll("[data-gh-tab]").forEach((btn) =>
  btn.addEventListener("click", async () => {
    const tab = btn.dataset.ghTab;
    ghState.tab = tab;
    document
      .querySelectorAll("[data-gh-tab]")
      .forEach((b) => b.classList.toggle("on", b.dataset.ghTab === tab));
    if (tab === "home") {
      ghSetView("home");
      ghRenderHome();
    } else if (tab === "builder") {
      ghSetView("builder");
      ghRenderBuilder();
    } else {
      ghSetView("list");
      await ghFetchPRs();
    }
  }),
);
ghPRSearchInput?.addEventListener("input", (e) => {
  ghState.query = e.target.value || "";
  ghPRSearchClear.classList.toggle("vis", !!ghState.query.trim());
  if (ghState.tab === "prs") ghRenderPRs();
});
ghPRSearchClear?.addEventListener("click", () => {
  ghState.query = "";
  ghPRSearchInput.value = "";
  ghPRSearchClear.classList.remove("vis");
  if (ghState.tab === "prs") ghRenderPRs();
});
document.querySelectorAll("[data-gh-filter]").forEach((btn) =>
  btn.addEventListener("click", () => {
    ghState.prFilter = btn.dataset.ghFilter || "all";
    ghSyncFilterButtons();
    if (ghState.tab === "prs") ghRenderPRs();
  }),
);
document.getElementById("ghSaveBtn").addEventListener("click", async () => {
  await ghSaveSettings();
  ghState.isSettings = true;
  await ghToggleSettings();
  ghRenderHome();
});
document.getElementById("ghGoPrBtn").addEventListener("click", () => {
  const repoFull = document.getElementById("ghBuildRepo").value;
  const head = document.getElementById("ghHeadInput").value.trim();
  const base = ghState.selectedBaseByRepo[repoFull];
  const status = document.getElementById("ghBuildStatus");
  if (!repoFull || !head || !base) {
    status.textContent = "⚠️ 레포, base 브랜치, compare 값을 확인해주세요!";
    return;
  }
  const url = `${ghState.baseUrl}/${repoFull}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?expand=1`;
  ghPushHistory({ type: "PR", label: repoFull, url });
  window.api?.openUrl(url);
});
document.getElementById("ghCopyPrBtn").addEventListener("click", () => {
  const repoFull = document.getElementById("ghBuildRepo").value;
  const head = document.getElementById("ghHeadInput").value.trim();
  const base = ghState.selectedBaseByRepo[repoFull];
  const status = document.getElementById("ghBuildStatus");
  if (!repoFull || !head || !base) {
    status.textContent = "⚠️ 레포, base 브랜치, compare 값을 확인해주세요!";
    return;
  }
  const url = `${ghState.baseUrl}/${repoFull}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?expand=1`;
  navigator.clipboard?.writeText(url).then(() => {
    status.textContent = "📋 복사됐어요!";
    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  });
});
document.getElementById("ghGoDiffBtn").addEventListener("click", () => {
  const repoFull = document.getElementById("ghBuildRepo").value;
  const base = document.getElementById("ghBaseShaInput").value.trim();
  const head = document.getElementById("ghHeadShaInput").value.trim();
  const status = document.getElementById("ghBuildStatus");
  if (!repoFull || !base || !head) {
    status.textContent = "⚠️ 레포와 SHA 두 개를 모두 입력해주세요!";
    return;
  }
  const url = `${ghState.baseUrl}/${repoFull}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?expand=1`;
  ghPushHistory({ type: "DIFF", label: repoFull, url });
  window.api?.openUrl(url);
});
document.getElementById("ghCopyDiffBtn").addEventListener("click", () => {
  const repoFull = document.getElementById("ghBuildRepo").value;
  const base = document.getElementById("ghBaseShaInput").value.trim();
  const head = document.getElementById("ghHeadShaInput").value.trim();
  const status = document.getElementById("ghBuildStatus");
  if (!repoFull || !base || !head) {
    status.textContent = "⚠️ 레포와 SHA 두 개를 모두 입력해주세요!";
    return;
  }
  const url = `${ghState.baseUrl}/${repoFull}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?expand=1`;
  navigator.clipboard?.writeText(url).then(() => {
    status.textContent = "📋 복사됐어요!";
    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  });
});

/* ══════════════════════════════════════════════
  초기화
══════════════════════════════════════════════ */
async function init() {
  if (window.api) {
    try {
      const s = await window.api.getSettings();
      const m = await window.api.getMemos();
      const l = await window.api.getLinks?.();
      const b = await window.api.getBranches?.();
      const p = await window.api.getPins?.();
      if (m) memos = m;
      if (l) links = l;
      if (b) branches = b;
      if (p) pins = new Set(p.map(String));
      setTimeout(
        () =>
          showB(
            s.baseUrl && s.pat
              ? "안녕! 클릭하면 이슈를 볼 수 있어요 🐾"
              : "⚙ 설정에서 Jira URL과 PAT를 입력해주세요!",
            3500,
          ),
        1200,
      );
    } catch (e) {
      console.error(e);
    }
  }
}
init();
setInterval(() => {
  if (!open) showB(msgs[mi++ % msgs.length]);
}, 7000);
