"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function cloneTemplate(id) {
  const template = document.getElementById(id);
  if (!template) throw new Error(`Template not found: #${id}`);
  return template.content.firstElementChild.cloneNode(true);
}

function renderEmptyState(target, message) {
  if (!target) return;

  target.replaceChildren();
  const empty = cloneTemplate("emptyStateTemplate");
  empty.textContent = message;
  target.appendChild(empty);
}

function setMemoActions(card, mode = "view") {
  const wrap = $(".memo-edit-actions", card);
  if (!wrap) return;

  wrap.replaceChildren();
  const templateId =
    mode === "edit" ? "memoEditActionsTemplate" : "memoViewActionsTemplate";
  const fragment = document.getElementById(templateId)?.content.cloneNode(true);
  if (fragment) wrap.appendChild(fragment);
}

const icon = (name, extra = "") =>
  `<span class="svg-icon i-${name}${extra ? ` ${extra}` : ""}"></span>`;

const ICONS = {
  bug: icon("bug"),
  task: icon("task"),
  story: icon("story"),
  epic: icon("epic"),
  doc: icon("doc"),
  figma: icon("figma"),
  link: icon("link"),
  mobile: icon("mobile"),
  pin: icon("pin", "fill"),
  edit: icon("edit"),
  del: icon("del"),
  check: icon("check"),
  branch: icon("branch"),
  github: icon("github"),
  desktop: icon("desktop"),
  file: icon("file"),
  x: icon("x"),
};

const LINK_ICON_OPTIONS = [
  { id: "icoLink", label: "Link", icon: ICONS.link },
  { id: "icoFigma", label: "Figma", icon: ICONS.figma },
  { id: "icoDoc", label: "Doc", icon: ICONS.doc },
  { id: "icoGithub", label: "GitHub", icon: ICONS.github },
  { id: "icoDesktop", label: "Desktop", icon: ICONS.desktop },
  { id: "icoMobile", label: "Mobile", icon: ICONS.mobile },
  { id: "icoFile", label: "File", icon: ICONS.file },
];

const state = {
  panelOpen: false,
  view: "home",
  previousView: "home",
  jiraFilter: "todo",
  prFilter: "all",
  issues: [],
  prs: [],
  memos: {},
  links: {},
  branches: {},
  pins: new Set(),
  gh: { baseUrl: "", token: "", repos: [], login: "", avatarUrl: "" },
  jira: { baseUrl: "", pat: "", doneDays: 60, login: "" },
  reposDraft: [],
  repoEditingIndex: null,
  dockCharacter: "quokka",
  userName: "goeun",
  logwork: {},
  logworkOffset: 0,
};

function esc(s = "") {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
let speechTimer = null;

function showSpeech(msg, delay = 2200) {
  const speech = $("#speech");
  if (!speech) return;

  speech.textContent = msg;
  speech.classList.add("is-show");

  clearTimeout(speechTimer);
  speechTimer = setTimeout(() => {
    speech.classList.remove("is-show");
    speech.textContent = "";
  }, delay);
}
function setPanel(open, view = state.view) {
  state.panelOpen = open;
  $("#dockFrame").classList.toggle("is-open", open);
  if (open) setView(view);
}
function setView(view) {
  state.view = view;
  $("#topTabs").classList.toggle("is-settings", view === "settings");
  $$(".top-tab").forEach((tab) =>
    tab.classList.toggle("is-on", tab.dataset.view === view),
  );
  $$(".view").forEach((panel) =>
    panel.classList.toggle("is-active", panel.dataset.panel === view),
  );
  const name = state.userName || "goeun";
  const titles = {
    home: `@${name} · Home`,
    jira: `@${name} · Jira`,
    pr: `@${name} · Pull Requests`,
    settings: `@${name} · Settings`,
  };
  $("#dynamicTitle").textContent = titles[view] || titles.home;
  if (view === "settings") loadSettingsIntoForm();
  if (view === "jira") renderIssues();
  if (view === "pr") renderPRs();
  if (view === "home") renderHome();
}

function setLoading(type, text) {
  const map = {
    jira: "#jiraState",
    pr: "#prState",
    logwork: "#logworkState",
  };
  const selector = map[type];
  if (!selector) return;
  const el = $(selector);
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
}

function fmtDate(d) {
  if (!d) return "";
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (Number.isNaN(diff)) return "";
  if (diff <= 0) return "오늘";
  if (diff === 1) return "어제";
  if (diff < 7) return `${diff}일 전`;
  if (diff < 30) return `${Math.floor(diff / 7)}주 전`;
  return `${Math.floor(diff / 30)}달 전`;
}
function formatDecimal(num) {
  return Number(num || 0)
    .toFixed(3)
    .replace(/\.?0+$/, "");
}

function issueCat(issue) {
  const cat = String(issue.statusCategory || "").toLowerCase();
  if (cat === "done") return "done";
  if (cat === "indeterminate") return "wip";
  return "todo";
}

function badgeClass(cat) {
  return cat === "done" ? "done" : cat === "wip" ? "doing" : "todo";
}

function typeInfo(type = "") {
  const t = String(type).toLowerCase().trim();
  if (t === "bug") {
    return { cls: "bug", icon: ICONS.bug };
  }
  if (t === "story") {
    return { cls: "story", icon: ICONS.story };
  }
  if (t === "epic") {
    return { cls: "epic", icon: ICONS.epic };
  }
  if (t === "sub-task" || t === "subtask") {
    return { cls: "task", icon: ICONS.task };
  }
  return { cls: "task", icon: ICONS.task };
}

function linkLabel(url) {
  try {
    const u = new URL(url);
    if (u.protocol === "file:")
      return decodeURIComponent(u.pathname.split("/").pop()) || url;
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
function detectIconId(url, iconId = "") {
  if (iconId && LINK_ICON_OPTIONS.some((item) => item.id === iconId))
    return iconId;
  const u = String(url || "").toLowerCase();
  if (u.includes("figma")) return "icoFigma";
  if (/github|gitlab/.test(u)) return "icoGithub";
  if (/notion|docs\.google|confluence|atlassian|drive\.google/.test(u))
    return "icoDoc";
  if (u.includes("desktop") || u.includes("pc")) return "icoDesktop";
  if (u.includes("mobile")) return "icoMobile";
  if (u.startsWith("file:")) return "icoFile";
  return "icoLink";
}
function linkIcon(url, iconId = "") {
  const id = detectIconId(url, iconId);
  return (
    LINK_ICON_OPTIONS.find((item) => item.id === id) || LINK_ICON_OPTIONS[0]
  ).icon;
}
function iconPickerHtml(selectedId = "icoLink") {
  return `<div class="link-picker">${LINK_ICON_OPTIONS.map((item) => `<button class="link-ico ${item.id === selectedId ? "is-picked" : ""}" type="button" data-icon-id="${item.id}" title="${esc(item.label)}">${item.icon}</button>`).join("")}</div>`;
}
function hl(text = "", keyword = "") {
  const safe = esc(text);
  const terms = queryValues(keyword)
    .filter((term) => term.length > 0)
    .sort((a, b) => b.length - a.length);

  if (!terms.length) return safe;

  const re = new RegExp(
    `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  return safe.replace(re, "<mark>$1</mark>");
}

function splitSearchTokens(rawQuery = "") {
  return String(rawQuery).trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function tokenParts(token = "") {
  const index = token.indexOf(":");
  if (index < 1) return { field: "", value: token };
  return {
    field: token.slice(0, index).trim(),
    value: token.slice(index + 1).trim(),
  };
}

function queryValues(rawQuery = "") {
  return splitSearchTokens(rawQuery)
    .map((token) => tokenParts(token).value)
    .filter(Boolean);
}

function includesValue(source = "", value = "") {
  return String(source || "")
    .toLowerCase()
    .includes(String(value || "").toLowerCase());
}

function matchesField(fields, field, value) {
  const aliases = {
    key: ["key"],
    issue: ["key"],
    title: ["title"],
    summary: ["title"],
    status: ["status"],
    state: ["status", "state"],
    type: ["type"],
    memo: ["memo"],
    branch: ["branch", "head", "base"],
    link: ["link"],
    repo: ["repo", "owner"],
    owner: ["owner"],
    number: ["number"],
    pr: ["number", "title"],
    pin: ["pin"],
    pinned: ["pin"],
  };
  const keys = aliases[field] || [field];
  return keys.some((key) => includesValue(fields[key], value));
}

function matchesQuery(fields, rawQuery = "") {
  const tokens = splitSearchTokens(rawQuery);
  if (!tokens.length) return true;

  return tokens.every((token) => {
    const { field, value } = tokenParts(token);
    if (!value) return true;
    if (field) return matchesField(fields, field, value);
    return Object.values(fields).some((fieldValue) =>
      includesValue(fieldValue, value),
    );
  });
}

function issueSearchFields(issue) {
  const key = issue.key;
  const cat = issueCat(issue);
  const branches = state.branches[key] || [];
  const links = state.links[key] || [];

  return {
    key,
    title: issue.summary || "",
    status: `${issue.status || ""} ${cat}`,
    type: issue.issueType || "",
    memo: state.memos[key] || "",
    branch: branches.join(" "),
    link: links.map((l) => `${l.label || ""} ${l.url || ""}`).join(" "),
    pin: state.pins.has(key) ? "true yes pinned pin" : "false no",
  };
}

function prSearchFields(pr) {
  return {
    repo: pr.repo || "",
    owner: pr.owner || "",
    title: pr.title || "",
    status: `${pr.stateLabel || ""} ${pr.stateGroup || ""}`,
    state: `${pr.stateLabel || ""} ${pr.stateGroup || ""}`,
    branch: `${pr.head || ""} ${pr.base || ""}`,
    head: pr.head || "",
    base: pr.base || "",
    number: String(pr.number || ""),
  };
}

async function boot() {
  loadLogwork();
  bindChrome();
  bindFilters();
  bindHome();
  await loadLocalState();
  await loadSettings();

  await Promise.allSettled([
    fetchIssues({ silent: true }),
    fetchPRs({ silent: true }),
  ]);
  await fetchLogwork();
  renderAll();
}

function bindChrome() {
  $("#dockBtn").addEventListener("click", async () => {
    setPanel(!state.panelOpen, state.previousView || "jira");
    if (state.panelOpen && state.view === "jira" && !state.issues.length)
      await fetchIssues();
    if (state.panelOpen && state.view === "pr" && !state.prs.length)
      await fetchPRs();
  });
  $("#ghDockBtn").addEventListener("click", async () => {
    setPanel(!state.panelOpen, state.previousView || "jira");
    if (state.panelOpen && state.view === "jira" && !state.issues.length)
      await fetchIssues();
    if (state.panelOpen && state.view === "pr" && !state.prs.length)
      await fetchPRs();
  });

  updateDockVisibility();
  $("#closePanelBtn").addEventListener("click", () => setPanel(false));
  $("#refreshBtn").addEventListener("click", async () => {
    if (state.view === "home") {
      await fetchLogwork();
      renderHome();
    } else if (state.view === "pr") {
      await fetchPRs();
    } else if (state.view === "settings") {
      await Promise.all([fetchIssues(), fetchPRs(), fetchLogwork()]);
      renderAll();
    } else {
      await Promise.all([fetchIssues(), fetchLogwork()]);
    }
  });
  $("#settingsBtn").addEventListener("click", () => {
    if (state.view === "settings") setView(state.previousView || "jira");
    else {
      state.previousView = state.view;
      setView("settings");
    }
  });
  $$(".top-tab").forEach((tab) =>
    tab.addEventListener("click", () => setView(tab.dataset.view)),
  );

  $("#avatarBtn").addEventListener("click", toggleTheme);
  $("#ctxTheme").addEventListener("click", toggleTheme);
  $("#ctxQuit").addEventListener("click", () => window.api?.quit?.());
  $("#dock").addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const menu = $("#ctxMenu");
    menu.style.left =
      Math.max(8, Math.min(e.clientX, window.innerWidth - 148)) + "px";
    menu.style.top =
      Math.max(8, Math.min(e.clientY - 70, window.innerHeight - 90)) + "px";
    menu.classList.add("show");
  });
  document.addEventListener("click", (e) => {
    if (!$("#ctxMenu").contains(e.target))
      $("#ctxMenu").classList.remove("show");
  });

  let dragging = false,
    ox = 0,
    oy = 0,
    raf = null,
    pending = null;
  $("#dockHandle").addEventListener("mousedown", (e) => {
    e.preventDefault();
    dragging = true;
    ox = e.screenX - window.screenX;
    oy = e.screenY - window.screenY;
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    pending = { x: e.screenX - ox, y: e.screenY - oy };
    if (raf) return;
    raf = requestAnimationFrame(() => {
      window.api?.moveWindow?.(pending);
      raf = null;
    });
  });
  document.addEventListener("mousemove", (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const interactive =
      el &&
      (el.closest(".dock-frame") ||
        el.closest(".dock-bottom-native") ||
        el.closest(".ctx-menu") ||
        el.closest(".confirm-overlay"));
    window.api?.setIgnoreMouse?.(!interactive);
  });

  $("#jiraSearch").addEventListener("input", renderIssues);
  $("#prSearch").addEventListener("input", renderPRs);
  $("#addRepoBtn").addEventListener("click", addRepoFromForm);
  $("#saveSettingsBtn").addEventListener("click", saveSettingsFromForm);
  $("#usePersonalJira")?.addEventListener("change", () => {
    $("#jiraEmailWrap").hidden = !$("#usePersonalJira").checked;
  });
  $("#confirmCancel").addEventListener("click", closeConfirm);
  $("#confirmOverlay").addEventListener("click", (e) => {
    if (e.target.id === "confirmOverlay") closeConfirm();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest?.(".link-icon-select")) {
      $$(".link-icon-select.is-open").forEach((el) =>
        el.classList.remove("is-open"),
      );
    }
  });
}
function bindFilters() {
  $$("[data-jira-filter]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.jiraFilter = btn.dataset.jiraFilter;
      $$("[data-jira-filter]").forEach((b) =>
        b.classList.toggle("is-on", b === btn),
      );
      renderIssues();
    }),
  );
  $$("[data-pr-filter]").forEach((btn) =>
    btn.addEventListener("click", () => {
      state.prFilter = btn.dataset.prFilter;
      $$("[data-pr-filter]").forEach((b) =>
        b.classList.toggle("is-on", b === btn),
      );
      renderPRs();
    }),
  );
}
function getLogworkMonth(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d;
}

function logworkKey(offset = 0) {
  const d = getLogworkMonth(offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function loadLogwork() {
  state.logwork = JSON.parse(localStorage.getItem("logwork") || "{}");
}

function saveLogwork() {
  localStorage.setItem("logwork", JSON.stringify(state.logwork));
}

function getLogworkData(offset = 0) {
  return (
    state.logwork[logworkKey(offset)] || {
      logged: 0,
      target: 20,
      seconds: 0,
      logs: [],
    }
  );
}

function setLogworkTarget(offset, target) {
  const key = logworkKey(offset);

  state.logwork[key] = {
    ...getLogworkData(offset),
    target,
  };

  saveLogwork();
}

function bindHome() {
  $("#logworkPrev").addEventListener("click", async () => {
    state.logworkOffset -= 1;
    await fetchLogwork();
  });

  $("#logworkNext").addEventListener("click", async () => {
    if (state.logworkOffset >= 0) return;
    state.logworkOffset += 1;
    await fetchLogwork();
  });

  $("#logworkEditTargetBtn").addEventListener("click", () => {
    const { target } = getLogworkData(state.logworkOffset);

    $("#logworkTargetInput").value = target;
    $("#logworkTargetForm").hidden = false;
    $("#logworkTargetInput").focus();
    $("#logworkTargetInput").select();
  });

  $("#logworkTargetSave").addEventListener("click", () => {
    const val = Number($("#logworkTargetInput").value);

    if (!isNaN(val) && val > 0) {
      setLogworkTarget(state.logworkOffset, val);
    }

    $("#logworkTargetForm").hidden = true;
    renderLogwork();
  });

  $("#logworkTargetCancel").addEventListener("click", () => {
    $("#logworkTargetForm").hidden = true;
  });

  $("#logworkTargetInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#logworkTargetSave").click();
    if (e.key === "Escape") $("#logworkTargetCancel").click();
  });

  $("#exportReportBtn")?.addEventListener("click", async () => {
    const rows = buildWorkReportRows();
    if (!rows.length) {
      showSpeech("엑셀로 내보낼 로그워크가 없어요 🥲");
      return;
    }
    const result = await window.api?.exportWorkReport?.(rows);
    if (!result?.canceled) showSpeech("업무보고 엑셀 저장 완료! 📊");
  });
}

function renderLogworkList(logs = []) {
  const list = $("#logworkList");
  if (!list) return;

  list.replaceChildren();

  if (!logs.length) {
    renderEmptyState(list, "이번 달 등록한 로그워크가 없어요");
    return;
  }

  logs
    .slice()
    .sort((a, b) => new Date(b.started) - new Date(a.started))
    .forEach((log) => {
      const date = log.started
        ? new Date(log.started)
            .toLocaleDateString("ko-KR", {
              timeZone: "Asia/Seoul",
              month: "2-digit",
              day: "2-digit",
            })
            .replace(/\.\s?/g, "")
            .replace(/^(\d{2})(\d{2})$/, "$1/$2")
        : "-";
      const item = cloneTemplate("logworkItemTemplate");
      item.dataset.issueKey = log.issueKey || "";
      $(".home-mini-key", item).textContent = `${date}`;
      $(".home-mini-title", item).textContent = log.summary || "";
      $(".badge", item).textContent = `${log.timeSpent || ""}`;

      item.addEventListener("click", () => {
        const key = item.dataset.issueKey;
        const baseUrl = String(state.jira.baseUrl || "").replace(/\/$/, "");
        if (baseUrl && key) window.api?.openUrl?.(`${baseUrl}/browse/${key}`);
      });
      list.appendChild(item);
    });
}
function renderLogwork() {
  const offset = state.logworkOffset;
  const { logged, target, logs = [] } = getLogworkData(offset);
  $("#logworkTargetForm").hidden = true;
  const d = getLogworkMonth(offset);
  const months = [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ];

  $("#logworkMonthLabel").textContent =
    `${d.getFullYear()}년 ${months[d.getMonth()]}`;

  const pct =
    target > 0 ? Math.min(100, Math.round((logged / target) * 100)) : 0;

  const remaining = Math.max(0, target - logged);

  $("#logworkLoggedVal").textContent = formatDecimal(logged);
  $("#logworkTargetVal").textContent = target;

  const fill = $("#logworkFill");
  fill.style.width = `${pct}%`;
  fill.classList.toggle("is-done", pct >= 100);

  $("#logworkPct").textContent = `${formatDecimal(pct)}%`;
  $("#logworkRemain").textContent =
    remaining > 0 ? `${formatDecimal(remaining)}d 남음` : "목표 달성! 🎉";

  $("#logworkNext").disabled = offset >= 0;

  renderLogworkList(logs);
}
function renderHomeJira() {
  const list = $("#homeJiraList");
  const items = state.issues
    .filter((issue) => issueCat(issue) !== "done")
    .slice(0, 5);

  list.replaceChildren();

  if (!items.length) {
    renderEmptyState(
      list,
      state.issues.length ? "진행 중인 이슈가 없어요 🎉" : "이슈가 없어요",
    );
    return;
  }

  items.forEach((issue) => {
    const cat = issueCat(issue);
    const item = cloneTemplate("homeMiniItemTemplate");
    $(".home-mini-dot", item).style.background =
      cat === "wip" ? "var(--blue)" : "var(--gray)";
    $(".home-mini-key", item).textContent = issue.key;
    $(".home-mini-title", item).textContent = issue.summary || "";
    const badge = $(".badge", item);
    badge.classList.add(badgeClass(cat));
    badge.textContent = issue.status || cat;
    item.addEventListener("click", () => window.api?.openUrl?.(issue.url));
    list.appendChild(item);
  });
}

function renderHomePR() {
  const list = $("#homePRList");
  const items = state.prs.filter((pr) => pr.stateGroup === "open").slice(0, 5);

  list.replaceChildren();

  if (!items.length) {
    renderEmptyState(
      list,
      state.prs.length ? "오픈 PR이 없어요 🎉" : "PR이 없어요",
    );
    return;
  }

  items.forEach((pr) => {
    const item = cloneTemplate("homeMiniItemTemplate");
    $(".home-mini-dot", item).style.background = "var(--green)";
    $(".home-mini-key", item).textContent = `#${pr.number || ""}`;
    $(".home-mini-title", item).textContent = pr.title || "";
    const badge = $(".badge", item);
    badge.classList.add("open");
    badge.textContent = pr.stateLabel || "Open";
    item.addEventListener(
      "click",
      () => pr.url && window.api?.openUrl?.(pr.url),
    );
    list.appendChild(item);
  });
}
function formatReportDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy} ${mm} ${dd}`;
}

function parseTimeSpentToSeconds(text = "") {
  const value = String(text);
  let seconds = 0;
  const day = value.match(/(\d+(?:\.\d+)?)d/);
  const hour = value.match(/(\d+(?:\.\d+)?)h/);
  const minute = value.match(/(\d+(?:\.\d+)?)m/);
  if (day) seconds += Number(day[1]) * 8 * 60 * 60;
  if (hour) seconds += Number(hour[1]) * 60 * 60;
  if (minute) seconds += Number(minute[1]) * 60;
  return seconds;
}

function buildWorkReportRows() {
  const { logs = [] } = getLogworkData(state.logworkOffset);
  const issueMap = new Map(state.issues.map((issue) => [issue.key, issue]));
  const group = new Map();

  logs.forEach((log) => {
    const key = log.issueKey;
    if (!key) return;
    if (!group.has(key)) group.set(key, { issueKey: key, logs: [], seconds: 0 });
    const item = group.get(key);
    item.logs.push(log);
    item.seconds += log.timeSpentSeconds || parseTimeSpentToSeconds(log.timeSpent);
  });

  return [...group.values()].map(({ issueKey, logs, seconds }) => {
    const issue = issueMap.get(issueKey) || {};
    const sorted = logs.slice().sort((a, b) => new Date(a.started) - new Date(b.started));
    return {
      "JIRA 번호": issueKey,
      "업무내용": issue.summary || sorted[0]?.summary || "",
      "업무분류": "",
      "Type": issue.issueType || "",
      "요청구분": "JIRA",
      "요청자": issue.reporter || "",
      "담당자": issue.assignee || "",
      "업무 시작일": formatReportDate(sorted[0]?.started),
      "업무 종료일": formatReportDate(sorted[sorted.length - 1]?.started),
      "Mark up Delivery": formatReportDate(sorted[sorted.length - 1]?.started),
      "소요시간(D)": Number((seconds / 28800).toFixed(2)),
      "Phase": issue.status || "",
      "LTS": "",
      "비고": issue.url || `${state.jira.baseUrl}/browse/${issueKey}`,
    };
  });
}

function renderHome() {
  renderLogwork();
  renderHomeJira();
  renderHomePR();
}

function applyTheme(mode) {
  document.body.classList.toggle("dark-mode", mode === "dark");
  localStorage.setItem("theme", mode);
  $("#ctxTheme").textContent =
    mode === "dark" ? "☀ 라이트 모드" : "🌙 다크 모드";
}
function toggleTheme() {
  applyTheme(document.body.classList.contains("dark-mode") ? "light" : "dark");
}
applyTheme(localStorage.getItem("theme") || "light");

function updateDockVisibility() {
  const dockBtn = $("#dockBtn");
  const ghDockBtn = $("#ghDockBtn");
  if (state.dockCharacter === "quokka") {
    dockBtn.style.display = "";
    ghDockBtn.style.display = "none";
  } else {
    dockBtn.style.display = "none";
    ghDockBtn.style.display = "";
  }
}

async function loadLocalState() {
  const [memos, links, pins, branches] = await Promise.all([
    window.api?.getMemos?.(),
    window.api?.getLinks?.(),
    window.api?.getPins?.(),
    window.api?.getBranches?.(),
  ]);
  state.memos = memos || {};
  state.links = links || {};
  state.branches = branches || {};
  state.pins = new Set(pins || []);
}
async function savePins() {
  await window.api?.savePins?.([...state.pins]);
}
async function saveMemos() {
  await window.api?.saveMemos?.(state.memos);
}
async function saveLinks() {
  await window.api?.saveLinks?.(state.links);
}
async function saveBranches() {
  await window.api?.saveBranches?.(state.branches);
}
async function loadSettings() {
  const jira = (await window.api?.getSettings?.()) || {};
  const gh = (await window.api?.getGHSettings?.()) || {};
  state.jira = {
    baseUrl: jira.baseUrl || "",
    pat: jira.pat || "",
    doneDays: jira.doneDays || 60,
    usePersonalJira: !!jira.usePersonalJira,
    email: jira.email || "",
    login: "",
  };
  state.gh = {
    baseUrl: gh.baseUrl || "",
    token: gh.token || "",
    repos: Array.isArray(gh.repos) ? gh.repos : [],
    login: "",
    avatarUrl: "",
  };
  state.reposDraft = [...state.gh.repos];
  state.dockCharacter = localStorage.getItem("dockCharacter") || "quokka";
  state.userName = localStorage.getItem("userName") || "goeun";
  updateDockVisibility();
}
async function fetchIssues({ silent = false } = {}) {
  if (!state.jira.baseUrl || !state.jira.pat) {
    if (!silent)
      setLoading("jira", "설정에서 Jira URL/PAT를 먼저 입력해줘요 🐾");
    updateCounts();
    return;
  }
  if (!silent) setLoading("jira", "Jira 이슈 불러오는 중...");
  try {
    const result = await window.api?.fetchIssues?.();
    state.issues = Array.isArray(result?.issues) ? result.issues : [];
    await ensurePinnedIssues();
    state.jira.login = result?.login || "";
    setLoading("jira", "");
    showSpeech("Jira 이슈를 새로 불러왔어요 📋");
    renderIssues();
  } catch (e) {
    setLoading("jira", `❌ ${e.message || "Jira 이슈를 불러오지 못했어요"}`);
  }
  updateCounts();
}
async function fetchLogwork() {
  setLoading("logwork", "로그워크 불러오는 중...");

  try {
    const data = await window.api.fetchWorklogs(state.logworkOffset);

    state.logwork[logworkKey(state.logworkOffset)] = {
      logged: data.loggedDays,
      target: getLogworkData(state.logworkOffset).target,
      seconds: data.totalSeconds,
      logs: data.logs,
    };

    renderLogwork();
  } catch (e) {
    console.warn(e);
  } finally {
    setLoading("logwork", "");
  }
}
async function ensurePinnedIssues() {
  const pinnedKeys = [...state.pins];
  if (!pinnedKeys.length) return;
  const loadedKeys = new Set(state.issues.map((issue) => issue.key));
  const missingKeys = pinnedKeys.filter((key) => !loadedKeys.has(key));
  if (!missingKeys.length) return;
  try {
    const result = await window.api?.fetchIssuesByKeys?.(missingKeys);
    const extra = Array.isArray(result?.issues) ? result.issues : [];
    const merged = new Map(state.issues.map((issue) => [issue.key, issue]));
    extra.forEach((issue) => merged.set(issue.key, issue));
    state.issues = [...merged.values()];
  } catch (error) {
    console.warn("Pinned Jira fetch failed:", error);
  }
}

async function fetchPRs({ silent = false } = {}) {
  if (!state.gh.baseUrl || !state.gh.token || !state.gh.repos?.length) {
    if (!silent)
      setLoading("pr", "설정에서 GitHub URL/TOKEN/레포를 먼저 입력해줘요 🐇");
    updateCounts();
    return;
  }
  if (!silent) setLoading("pr", "GitHub PR 불러오는 중...");
  try {
    const result = await window.api?.fetchGHPRs?.(
      state.gh.baseUrl,
      state.gh.token,
      state.gh.repos,
    );
    state.prs = Array.isArray(result?.prs) ? result.prs : [];
    state.gh.login = result?.login || "";
    state.gh.avatarUrl = result?.avatarUrl || "";
    setLoading("pr", "");
    showSpeech("PR 목록을 새로 불러왔어요 👀");
    renderPRs();
  } catch (e) {
    setLoading("pr", `❌ ${e.message || "PR을 불러오지 못했어요"}`);
  }
  updateCounts();
}
function renderAll() {
  updateCounts();
  renderIssues();
  renderPRs();
  renderHome();
  renderRepoList();
}
function updateCounts() {
  const counts = { todo: 0, wip: 0, done: 0 };
  state.issues.forEach((issue) => counts[issueCat(issue)]++);
  $("#nTodo").textContent = counts.todo;
  $("#nWip").textContent = counts.wip;
  $("#nDone").textContent = counts.done;
  $("#nPin").textContent = state.issues.filter((issue) =>
    state.pins.has(issue.key),
  ).length;
  $("#tabJiraCount").textContent = state.issues.length;

  const open = state.prs.filter((p) => p.stateGroup === "open").length;
  const merged = state.prs.filter((p) => p.stateGroup === "merged").length;
  const closed = state.prs.filter((p) => p.stateGroup === "closed").length;
  $("#nPrAll").textContent = state.prs.length;
  $("#nPrOpen").textContent = open;
  $("#nPrMerged").textContent = merged;
  $("#nPrClosed").textContent = closed;
  $("#tabPrCount").textContent = open;
}

function renderIssues() {
  updateCounts();
  const list = $("#issueList");
  const query = $("#jiraSearch").value.trim().toLowerCase();
  let items = state.issues.filter((issue) => {
    if (state.jiraFilter === "pin") return state.pins.has(issue.key);
    return issueCat(issue) === state.jiraFilter;
  });
  if (query)
    items = items.filter((issue) =>
      matchesQuery(issueSearchFields(issue), query),
    );
  list.replaceChildren();
  if (!items.length) {
    renderEmptyState(
      list,
      state.issues.length ? "조건에 맞는 이슈가 없어요" : "이슈가 없어요 🎉",
    );
    return;
  }
  items.forEach((issue) => list.appendChild(createIssueCard(issue)));
}
function createIssueCard(issue) {
  const key = issue.key;
  const cat = issueCat(issue);
  const type = typeInfo(issue.issueType);
  const query = $("#jiraSearch")?.value.trim() || "";
  const card = cloneTemplate("issueCardTemplate");
  const isPinned = state.pins.has(key);
  if (isPinned) card.classList.add("is-pinned");

  const typeButton = $(".type-icon", card);
  typeButton.classList.add(type.cls);
  typeButton.innerHTML = type.icon;

  $(".issue-key", card).innerHTML = hl(key, query);
  $(".issue-title", card).innerHTML = hl(issue.summary, query);
  const pinBtn = $(".pin button", card);
  pinBtn.innerHTML = isPinned ? ICONS.pin : ICONS.pin.replace("fill", "");
  if (isPinned) pinBtn.classList.add("is-pinned");

  const status = $(".issue-status", card);
  status.classList.add(badgeClass(cat));
  status.textContent = issue.status || cat;
  $(".date-label", card).textContent = fmtDate(issue.updated);
  $(".branch-input", card).placeholder = `feature/${key}/base`;
  $(".memo-label", card).innerHTML = `${ICONS.doc} Memo`;
  $(".memo-text", card).innerHTML = state.memos[key]
    ? hl(state.memos[key], query)
    : "";
  $(".memo-inline-textarea", card).value = state.memos[key] || "";

  renderBranches(card, issue);
  renderLinks(card, issue);

  $(".pill-branch", card).addEventListener("click", (e) => {
    e.stopPropagation();
    card.classList.add("is-branch-editing");
    $(".branch-add-row .branch-input", card).focus();
  });
  $(".pill-memo", card).addEventListener("click", (e) => {
    e.stopPropagation();
    $(".memo-link-toggle", card).click();
  });

  $(".issue-title-link", card).addEventListener("click", () =>
    window.api?.openUrl?.(issue.url),
  );
  typeButton.addEventListener("click", () =>
    navigator.clipboard?.writeText(key),
  );
  $(".pin button", card).addEventListener("click", async (e) => {
    e.stopPropagation();
    state.pins.has(key) ? state.pins.delete(key) : state.pins.add(key);
    await savePins();
    renderIssues();
  });
  $(".branch-add-btn", card).addEventListener("click", (e) => {
    e.stopPropagation();
    const isEditing = card.classList.contains("is-branch-editing");
    if (isEditing) {
      card.classList.remove("is-branch-editing");
    } else {
      card.classList.add("is-branch-editing");
      $(".branch-add-row .branch-input", card).focus();
    }
  });
  $(".branch-save-btn", card).addEventListener("click", async (e) => {
    e.stopPropagation();
    const input = $(".branch-add-row .branch-input", card);
    const val = input.value.trim();
    if (!val) {
      showSpeech("브랜치 이름을 입력해주세요");
      return;
    }
    state.branches[key] = [...(state.branches[key] || []), val];
    input.value = "";
    await saveBranches();
    card.classList.remove("is-branch-editing");
    renderBranches(card, issue);
    showSpeech(`${key} 브랜치를 저장했어요`);
  });
  $(".branch-input", card).addEventListener("keydown", (e) => {
    if (e.key === "Enter") $(".branch-save-btn", card).click();
    if (e.key === "Escape") {
      $(".branch-add-row .branch-input", card).value = "";
      card.classList.remove("is-branch-editing");
    }
  });
  bindMemoToggle(card, key);
  $(".add-link-btn", card).addEventListener("click", async () => {
    const input = $(".new-link-input", card);
    const url = input.value.trim();
    if (!url) return;
    const iconId =
      $(".link-new-row .link-ico-current", card)?.dataset.iconId ||
      detectIconId(url);
    state.links[key] = [
      ...(state.links[key] || []),
      { url, label: linkLabel(url), iconId },
    ];
    input.value = "";
    await saveLinks();
    renderLinks(card, issue);
  });
  $(".new-link-input", card).addEventListener("keydown", (e) => {
    if (e.key === "Enter") $(".add-link-btn", card).click();
  });
  return card;
}
function bindMemoToggle(card, key) {
  const toggle = $(".memo-link-toggle", card);
  if (!toggle) return;

  toggle.addEventListener("click", async (e) => {
    e.stopPropagation();
    const isEditing = card.classList.contains("is-memo-editing");

    if (!isEditing) {
      // 편집 모드 시작
      card.classList.add("is-memo-editing");
      $(".saved-link-add-panel", card).classList.add("is-open");
      $(".memo-inline-textarea", card).focus();
      setMemoActions(card, "edit");

      $(".memo-save-btn", card).addEventListener("click", async (e) => {
        e.stopPropagation();
        const textarea = $(".memo-inline-textarea", card);
        state.memos[key] = textarea.value.trim();
        if (!state.memos[key]) delete state.memos[key];
        await saveMemos();
        $(".memo-text", card).innerHTML = state.memos[key]
          ? hl(state.memos[key], $("#jiraSearch")?.value.trim() || "")
          : "";
        card.classList.remove("is-memo-editing");
        card.classList.toggle(
          "has-memo",
          !!(state.memos[key] || (state.links[key] && state.links[key].length)),
        );
        $(".saved-link-add-panel", card).classList.remove("is-open");
        setMemoActions(card, "view");
        bindMemoToggle(card, key);
        showSpeech("메모를 저장했어요");
      });

      $(".memo-cancel-btn", card).addEventListener("click", (e) => {
        e.stopPropagation();
        const textarea = $(".memo-inline-textarea", card);
        textarea.value = state.memos[key] || "";
        card.classList.remove("is-memo-editing");
        card.classList.toggle(
          "has-memo",
          !!(state.memos[key] || (state.links[key] && state.links[key].length)),
        );
        $(".saved-link-add-panel", card).classList.remove("is-open");
        setMemoActions(card, "view");
        bindMemoToggle(card, key);
      });
    }
  });
}
function renderBranches(card, issue) {
  const stack = $(".branch-stack", card);
  const key = issue.key;
  const query = $("#jiraSearch")?.value.trim() || "";
  const arr = state.branches[key] || [];
  card.classList.toggle("has-branch", arr.length > 0);
  stack.innerHTML = "";
  arr.forEach((branch, idx) => {
    const row = cloneTemplate("branchRowTemplate");
    $(".branch-name", row).innerHTML = hl(branch, query);
    $(".branch-edit-input", row).value = branch;
    $(".copy", row).innerHTML = ICONS.branch;
    $(".edit", row).innerHTML = ICONS.edit;
    $(".danger", row).innerHTML = ICONS.del;
    $(".save", row).innerHTML = ICONS.check;
    $(".cancel", row).innerHTML = ICONS.x;

    const read = $(".branch-read", row);
    const editLine = $(".branch-edit-line", row);
    const editInput = $(".branch-edit-input", row);
    $(".copy", row).addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard?.writeText(branch);
      showSpeech("브랜치 복사 완료");
    });
    $(".edit", row).addEventListener("click", (e) => {
      e.stopPropagation();
      read.hidden = true;
      editLine.hidden = false;
      editInput.focus();
      editInput.select();
    });
    $(".cancel", row).addEventListener("click", (e) => {
      e.stopPropagation();
      read.hidden = false;
      editLine.hidden = true;
      editInput.value = branch;
    });
    $(".save", row).addEventListener("click", async (e) => {
      e.stopPropagation();
      const next = editInput.value.trim();
      if (!next) return;
      state.branches[key][idx] = next;
      await saveBranches();
      renderBranches(card, issue);
      showSpeech("브랜치를 수정했어요");
    });
    editInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") $(".save", row).click();
      if (e.key === "Escape") $(".cancel", row).click();
    });
    $(".danger", row).addEventListener("click", (e) => {
      e.stopPropagation();
      confirm(`'${branch}' 브랜치를 삭제할까요?`, async () => {
        state.branches[key].splice(idx, 1);
        if (!state.branches[key].length) delete state.branches[key];
        await saveBranches();
        renderBranches(card, issue);
        showSpeech("브랜치를 삭제했어요");
      });
    });
    stack.appendChild(row);
  });
}

function fillIconPicker(wrap, selectedId = "icoLink") {
  const picker = $(".link-picker", wrap);
  picker.replaceChildren();
  LINK_ICON_OPTIONS.forEach((item) => {
    const btn = cloneTemplate("linkPickerButtonTemplate");
    btn.classList.toggle("is-picked", item.id === selectedId);
    btn.dataset.iconId = item.id;
    btn.title = item.label;
    btn.innerHTML = item.icon;
    picker.appendChild(btn);
  });
}
function bindIconPicker(wrap, onPick) {
  const current = $(".link-ico-current", wrap);
  const picker = $(".link-picker", wrap);
  current.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    $$(".link-icon-select.is-open").forEach((el) => {
      if (el !== wrap) el.classList.remove("is-open");
    });
    wrap.classList.toggle("is-open");
  });
  $$("[data-icon-id]", picker).forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const iconId = btn.dataset.iconId || "icoLink";
      const item =
        LINK_ICON_OPTIONS.find((option) => option.id === iconId) ||
        LINK_ICON_OPTIONS[0];
      current.innerHTML = item.icon;
      current.dataset.iconId = iconId;
      $$("[data-icon-id]", picker).forEach((b) =>
        b.classList.toggle("is-picked", b === btn),
      );
      wrap.classList.remove("is-open");
      onPick?.(iconId);
    });
  });
}
function renderLinks(card, issue) {
  const key = issue.key;
  const query = $("#jiraSearch")?.value.trim() || "";
  const saved = $(".saved-links", card);
  const manage = $(".link-manage-list", card);
  const arr = state.links[key] || [];
  saved.innerHTML = "";
  manage.innerHTML = "";
  arr.forEach((link, idx) => {
    const iconId = detectIconId(link.url, link.iconId);
    const chip = cloneTemplate("savedLinkTemplate");
    $(".saved-link-icon", chip).innerHTML = linkIcon(link.url, iconId);
    $(".saved-link-text", chip).innerHTML = hl(
      link.label || linkLabel(link.url),
      query,
    );
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      window.api?.openUrl?.(link.url);
    });
    saved.appendChild(chip);

    const item = cloneTemplate("linkManageItemTemplate");
    const current = $(".link-ico-current", item);
    current.dataset.iconId = iconId;
    current.innerHTML = linkIcon(link.url, iconId);
    fillIconPicker($(".link-icon-select", item), iconId);
    $(".link-label-input", item).value = link.label || linkLabel(link.url);
    $(".link-url-input", item).value = link.url;
    $(".save", item).innerHTML = ICONS.check;
    $(".danger", item).innerHTML = ICONS.del;

    let selectedIconId = iconId;
    bindIconPicker($(".link-icon-select", item), (nextIconId) => {
      selectedIconId = nextIconId;
    });
    $(".save", item).addEventListener("click", async (e) => {
      e.stopPropagation();
      const url = $(".link-url-input", item).value.trim();
      const label = $(".link-label-input", item).value.trim();
      if (!url) return;
      state.links[key][idx] = {
        url,
        label: label || linkLabel(url),
        iconId: selectedIconId,
      };
      await saveLinks();
      renderLinks(card, issue);
      showSpeech("링크를 저장했어요");
    });
    $(".danger", item).addEventListener("click", (e) => {
      e.stopPropagation();
      confirm("링크를 삭제할까요?", async () => {
        state.links[key].splice(idx, 1);
        if (!state.links[key].length) delete state.links[key];
        await saveLinks();
        renderLinks(card, issue);
        showSpeech("링크를 삭제했어요");
      });
    });
    manage.appendChild(item);
  });

  const newRow = $(".link-new-row", card);
  if (newRow && !newRow.dataset.pickerBound) {
    const selector = cloneTemplate("linkIconSelectTemplate");
    const current = $(".link-ico-current", selector);
    current.dataset.iconId = "icoLink";
    current.innerHTML = ICONS.link;
    fillIconPicker(selector, "icoLink");
    $(".link-icon-placeholder", newRow).replaceWith(selector);
    newRow.dataset.pickerBound = "true";
    bindIconPicker(selector);
  }
  const hasMemo = !!(state.memos[key] || arr.length);
  card.classList.toggle("has-memo", hasMemo);
}
function isPrDone(pr) {
  return pr.stateGroup === "merged" || pr.stateGroup === "closed";
}

function renderPRs() {
  updateCounts();

  const list = $("#prList");
  const query = $("#prSearch").value.trim().toLowerCase();

  let items = state.prs.filter((pr) => {
    if (state.prFilter === "all") return true;
    if (state.prFilter === "done") return isPrDone(pr);
    return pr.stateGroup === state.prFilter;
  });

  if (query) {
    items = items.filter((pr) => matchesQuery(prSearchFields(pr), query));
  }

  list.replaceChildren();

  if (!items.length) {
    renderEmptyState(
      list,
      state.prs.length ? "조건에 맞는 PR이 없어요" : "PR이 없어요 🎉",
    );
    return;
  }

  items.forEach((pr) => list.appendChild(createPRCard(pr)));
}
function createPRCard(pr) {
  const query = $("#prSearch")?.value.trim() || "";
  const card = cloneTemplate("prCardTemplate");
  const jiraKey =
    (pr.title + " " + pr.head).match(/[A-Z][A-Z0-9]+-\d+/)?.[0] || "";
  const prUrl = pr.url || "";
  const diffUrl = prUrl ? `${prUrl}/files` : "";

  const toneClass =
    pr.stateGroup === "open"
      ? "tone-open"
      : pr.stateGroup === "merged"
        ? "tone-merged"
        : "tone-closed";
  card.classList.add(toneClass);

  const actionBtn = $(".pr-action-btn", card);
  actionBtn.innerHTML =
    pr.stateGroup === "open"
      ? `<span class="svg-icon i-open"></span>`
      : pr.stateGroup === "merged"
        ? `<span class="svg-icon i-check"></span>`
        : `<span class="svg-icon i-x"></span>`;

  $(".pr-repo", card).innerHTML =
    `${hl(pr.owner, query)} / ${hl(pr.repo, query)}`;

  const status = $(".pr-state", card);
  const badgeCls =
    pr.stateGroup === "open"
      ? "done"
      : pr.stateGroup === "merged"
        ? "merged"
        : "closed";
  status.classList.add(badgeCls);
  status.textContent = pr.stateLabel || "";

  $(".date-label", card).textContent = fmtDate(pr.updatedAt);

  $(".pr-title", card).innerHTML =
    `<span class="pr-number-label">#${esc(String(pr.number || ""))}</span> ${hl(pr.title, query)}`;

  actionBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (prUrl) window.api?.openUrl?.(prUrl);
  });

  $(".pr-title", card).addEventListener("click", (e) => {
    e.stopPropagation();
    if (prUrl) window.api?.openUrl?.(prUrl);
  });

  $(".pr-copy-btn", card).addEventListener("click", (e) => {
    e.stopPropagation();
    if (!prUrl) return;
    navigator.clipboard?.writeText(prUrl);
    showSpeech("PR 링크를 복사했어요");
  });

  const stack = $(".pr-link-stack", card);
  if (jiraKey) {
    const jiraRow = cloneTemplate("prJiraRowTemplate");
    $(".jira-key", jiraRow).textContent = jiraKey;
    jiraRow.addEventListener("click", (e) => {
      e.stopPropagation();
      const baseUrl = String(state.jira.baseUrl || "").replace(/\/$/, "");
      if (baseUrl) window.api?.openUrl?.(`${baseUrl}/browse/${jiraKey}`);
    });
    stack.appendChild(jiraRow);
  }

  const branchRow = cloneTemplate("prBranchRowTemplate");
  $(".pr-head", branchRow).innerHTML = hl(pr.head || "-", query);
  $(".pr-base", branchRow).innerHTML = hl(pr.base || "-", query);
  branchRow.addEventListener("click", (e) => {
    e.stopPropagation();
    if (diffUrl) window.api?.openUrl?.(diffUrl);
  });
  stack.appendChild(branchRow);

  return card;
}
function loadSettingsIntoForm() {
  $("#jiraUrl").value = state.jira.baseUrl || "";
  $("#jiraToken").value = state.jira.pat || "";
  $("#doneDays").value = String(state.jira.doneDays || 60);
  if ($("#usePersonalJira")) {
    $("#usePersonalJira").checked = !!state.jira.usePersonalJira;
    $("#jiraEmail").value = state.jira.email || "";
    $("#jiraEmailWrap").hidden = !$("#usePersonalJira").checked;
  }
  $("#githubUrl").value = state.gh.baseUrl || "";
  $("#githubToken").value = state.gh.token || "";
  $("#dockCharacter").value = state.dockCharacter || "quokka";
  $("#userName").value = state.userName || "goeun";
  state.reposDraft = [...(state.gh.repos || [])];
  state.repoEditingIndex = null;
  renderRepoList();
}
function renderRepoList() {
  const list = $("#repoList");
  const addBtn = $("#addRepoBtn");
  list.replaceChildren();
  if (addBtn) {
    addBtn.innerHTML =
      state.repoEditingIndex === null
        ? ICONS.check.replace("i-check", "i-plus")
        : ICONS.check;
    addBtn.setAttribute(
      "aria-label",
      state.repoEditingIndex === null ? "추가" : "수정 저장",
    );
  }

  if (!state.reposDraft.length) {
    renderEmptyState(list, "등록된 레포가 없어요");
    return;
  }

  state.reposDraft.forEach((repo, idx) => {
    const item = cloneTemplate("repoItemTemplate");
    const branches = Array.isArray(repo.branches)
      ? repo.branches
      : repo.base
        ? [repo.base]
        : [];

    item.classList.toggle("is-editing", state.repoEditingIndex === idx);
    $(".repo-name", item).textContent = `${repo.owner}/${repo.repo}`;
    const repoMeta = $(".repo-meta", item);
    repoMeta.replaceChildren();
    branches.forEach((branch) => {
      const tag = cloneTemplate("repoTagTemplate");
      tag.textContent = branch;
      repoMeta.appendChild(tag);
    });
    $(".edit-repo", item).innerHTML =
      state.repoEditingIndex === idx ? ICONS.check : ICONS.edit;
    $(".delete-repo", item).innerHTML = ICONS.del;

    $(".edit-repo", item).addEventListener("click", () => {
      $(".repo-edit-full", item).value = `${repo.owner}/${repo.repo}`;
      $(".repo-edit-branches", item).value = branches.join(",");
      item.classList.add("is-editing");
      $(".repo-edit-full", item).focus();
    });
    $(".cancel-repo", item).addEventListener("click", () => {
      item.classList.remove("is-editing");
    });
    $(".save-repo", item).addEventListener("click", () => {
      const full = $(".repo-edit-full", item).value.trim();
      if (!full.includes("/")) {
        showSpeech("레포는 owner/repo 형식으로 넣어줘요");
        return;
      }
      const [owner, repoName] = full.split("/");
      const nextBranches = $(".repo-edit-branches", item)
        .value.split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      state.reposDraft[idx] = {
        owner: owner.trim(),
        repo: repoName.trim(),
        branches: nextBranches,
      };
      renderRepoList();
    });

    $(".delete-repo", item).addEventListener("click", () => {
      state.reposDraft.splice(idx, 1);
      if (state.repoEditingIndex === idx) {
        state.repoEditingIndex = null;
        $("#repoFullName").value = "";
        $("#repoBranches").value = "";
      } else if (
        state.repoEditingIndex !== null &&
        state.repoEditingIndex > idx
      ) {
        state.repoEditingIndex -= 1;
      }
      renderRepoList();
    });
    list.appendChild(item);
  });
}
function addRepoFromForm() {
  const full = $("#repoFullName").value.trim();
  if (!full.includes("/"))
    return showSpeech("레포는 owner/repo 형식으로 넣어줘요");
  const [owner, repo] = full.split("/").map((v) => v.trim());
  if (!owner || !repo) return showSpeech("레포는 owner/repo 형식으로 넣어줘요");
  const branches = $("#repoBranches")
    .value.split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const nextRepo = { owner, repo, branches };
  if (state.repoEditingIndex !== null) {
    state.reposDraft[state.repoEditingIndex] = nextRepo;
    state.repoEditingIndex = null;
    showSpeech("레포 설정을 수정했어요");
  } else {
    state.reposDraft.push(nextRepo);
    showSpeech("레포를 추가했어요");
  }
  $("#repoFullName").value = "";
  $("#repoBranches").value = "";
  renderRepoList();
}
async function saveSettingsFromForm() {
  const jira = {
    baseUrl: $("#jiraUrl").value.trim(),
    pat: $("#jiraToken").value.trim(),
    doneDays: Number($("#doneDays").value || 60),
    usePersonalJira: !!$("#usePersonalJira")?.checked,
    email: $("#usePersonalJira")?.checked
      ? $("#jiraEmail")?.value.trim() || ""
      : "",
  };
  const gh = {
    baseUrl: $("#githubUrl").value.trim(),
    token: $("#githubToken").value.trim(),
    repos: state.reposDraft,
  };
  const dockCharacter = $("#dockCharacter").value || "quokka";
  const userName = $("#userName").value.trim() || "goeun";
  await window.api?.saveSettings?.(jira);
  await window.api?.saveGHSettings?.(gh);
  localStorage.setItem("dockCharacter", dockCharacter);
  localStorage.setItem("userName", userName);
  state.jira = { ...state.jira, ...jira };
  state.gh = { ...state.gh, ...gh };
  state.dockCharacter = dockCharacter;
  state.userName = userName;
  updateDockVisibility();
  showSpeech("설정 저장 완료! 메인으로 돌아왔어요");
  setView(state.previousView || "jira");
  await Promise.allSettled([
    fetchIssues({ silent: true }),
    fetchPRs({ silent: true }),
  ]);
}

let confirmOkHandler = null;
function confirm(msg, onOk) {
  $("#confirmMsg").textContent = msg;
  $("#confirmOverlay").classList.add("show");
  confirmOkHandler = onOk;
  $("#confirmOk").onclick = async (e) => {
    e.stopPropagation();
    const handler = confirmOkHandler;
    closeConfirm();
    await handler?.();
  };
}
function closeConfirm() {
  $("#confirmOverlay").classList.remove("show");
  confirmOkHandler = null;
}

boot().catch((e) => {
  console.error(e);
  showSpeech("초기화 중 오류가 났어요 🥲");
});
