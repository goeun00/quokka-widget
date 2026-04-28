"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function cloneTemplate(id) {
  const template = document.getElementById(id);
  if (!template) throw new Error(`Template not found: #${id}`);
  return template.content.firstElementChild.cloneNode(true);
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
  view: "jira",
  previousView: "jira",
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
    jira: `@${name} · Jira`,
    pr: `@${name} · Pull Requests`,
    settings: `@${name} · Settings`,
  };
  $("#dynamicTitle").textContent = titles[view] || titles.jira;
  if (view === "settings") loadSettingsIntoForm();
  if (view === "jira") renderIssues();
  if (view === "pr") renderPRs();
}
function setLoading(kind, msg) {
  const el = kind === "jira" ? $("#jiraState") : $("#prState");
  el.hidden = !msg;
  el.textContent = msg || "";
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
function issueCat(issue) {
  if (issue.statusCategory === "done") return "done";
  const n = String(issue.status || "").toLowerCase();
  if (/(progress|wip|testing|review|doing)/.test(n)) return "wip";
  return "todo";
}
function badgeClass(cat) {
  return cat === "done" ? "done" : cat === "wip" ? "doing" : "todo";
}
function typeInfo(type = "") {
  const t = String(type).toLowerCase();
  if (t.includes("bug")) return { cls: "bug", icon: ICONS.bug };
  if (t.includes("story")) return { cls: "story", icon: ICONS.story };
  if (t.includes("epic")) return { cls: "epic", icon: ICONS.epic };
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
    priority: ["priority"],
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
    priority: issue.priority || "",
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
  bindChrome();
  bindFilters();
  await loadLocalState();
  await loadSettings();
  await Promise.allSettled([
    fetchIssues({ silent: true }),
    fetchPRs({ silent: true }),
  ]);
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
    if (state.view === "pr") await fetchPRs();
    else if (state.view === "settings")
      await Promise.all([fetchIssues(), fetchPRs()]);
    else await fetchIssues();
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
  const done = state.prs.length - open;
  $("#nPrAll").textContent = state.prs.length;
  $("#nPrOpen").textContent = open;
  $("#nPrDone").textContent = done;
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
  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = `<div class="empty-inline">${state.issues.length ? "조건에 맞는 이슈가 없어요" : "이슈가 없어요 🎉"}</div>`;
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

  const typeButton = $(".type-icon", card);
  typeButton.classList.add(type.cls);
  typeButton.innerHTML = type.icon;

  $(".issue-key", card).innerHTML = hl(key, query);
  $(".issue-title", card).innerHTML = hl(issue.summary, query);
  $(".pin button", card).innerHTML = state.pins.has(key)
    ? ICONS.pin
    : ICONS.pin.replace("fill", "");

  const status = $(".issue-status", card);
  status.classList.add(badgeClass(cat));
  status.textContent = issue.status || cat;
  $(".issue-priority", card).textContent = issue.priority || "Medium";
  $(".issue-date", card).textContent = fmtDate(issue.updated);
  $(".branch-input", card).placeholder = `feature/${key}/base`;
  $(".memo-label", card).innerHTML = `${ICONS.doc} Memo`;
  $(".memo-text", card).innerHTML = state.memos[key]
    ? hl(state.memos[key], query)
    : "";
  $(".memo-inline-textarea", card).value = state.memos[key] || "";

  renderBranches(card, issue);
  renderLinks(card, issue);

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
  $(".branch-edit-toggle", card).addEventListener("click", (e) => {
    e.stopPropagation();
    const button = e.currentTarget;
    const isEditing = card.classList.contains("is-branch-editing");
    if (isEditing) {
      card.classList.remove("is-branch-editing");
      button.innerHTML = ICONS.edit;
    } else {
      card.classList.add("is-branch-editing");
      button.innerHTML = ICONS.check;
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
    $(".branch-edit-toggle", card).innerHTML = ICONS.edit;
    renderBranches(card, issue);
    showSpeech(`${key} 브랜치를 저장했어요`);
  });
  $(".branch-input", card).addEventListener("keydown", (e) => {
    if (e.key === "Enter") $(".branch-save-btn", card).click();
    if (e.key === "Escape") {
      $(".branch-add-row .branch-input", card).value = "";
      card.classList.remove("is-branch-editing");
      $(".branch-edit-toggle", card).innerHTML = ICONS.edit;
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
      $(".memo-edit-actions", card).innerHTML = `
        <button class="memo-save-btn row-btn" type="button" aria-label="저장">${ICONS.check}</button>
        <button class="memo-cancel-btn row-btn" type="button" aria-label="취소">${ICONS.x}</button>
      `;

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
        $(".saved-link-add-panel", card).classList.remove("is-open");
        $(".memo-edit-actions", card).innerHTML =
          `<button class="memo-link-toggle" type="button" aria-label="메모 편집">${ICONS.edit}</button>`;
        bindMemoToggle(card, key);
        showSpeech("메모를 저장했어요");
      });

      $(".memo-cancel-btn", card).addEventListener("click", (e) => {
        e.stopPropagation();
        const textarea = $(".memo-inline-textarea", card);
        textarea.value = state.memos[key] || "";
        card.classList.remove("is-memo-editing");
        $(".saved-link-add-panel", card).classList.remove("is-open");
        $(".memo-edit-actions", card).innerHTML =
          `<button class="memo-link-toggle" type="button" aria-label="메모 편집">${ICONS.edit}</button>`;
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
  picker.innerHTML = "";
  LINK_ICON_OPTIONS.forEach((item) => {
    const btn = document.createElement("button");
    btn.className = `link-ico ${item.id === selectedId ? "is-picked" : ""}`;
    btn.type = "button";
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
}
function renderPRs() {
  updateCounts();
  const list = $("#prList");
  const query = $("#prSearch").value.trim().toLowerCase();
  let items = state.prs.filter((pr) =>
    state.prFilter === "all" ? true : pr.stateGroup === state.prFilter,
  );
  if (query)
    items = items.filter((pr) => matchesQuery(prSearchFields(pr), query));
  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = `<div class="empty-inline">${state.prs.length ? "조건에 맞는 PR이 없어요" : "PR이 없어요 🎉"}</div>`;
    return;
  }
  items.forEach((pr) => list.appendChild(createPRCard(pr)));
}
function createPRCard(pr) {
  const query = $("#prSearch")?.value.trim() || "";
  const card = cloneTemplate("prCardTemplate");
  const statusClass = pr.stateGroup === "open" ? "doing" : "done";
  const jiraKey =
    (pr.title + " " + pr.head).match(/[A-Z][A-Z0-9]+-\d+/)?.[0] || "";
  const prUrl = pr.url || "";
  const diffUrl = prUrl ? `${prUrl}/files` : "";

  $(".pr-repo", card).innerHTML =
    `${hl(pr.owner, query)} / ${hl(pr.repo, query)}`;
  $(".pr-title", card).innerHTML = hl(pr.title, query);
  const status = $(".pr-state", card);
  status.classList.add(statusClass);
  status.textContent = pr.stateLabel || "";
  $(".pr-number", card).textContent = `#${pr.number || ""}`;
  $(".pr-date", card).textContent = fmtDate(pr.updatedAt);

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
  list.innerHTML = "";
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
    list.innerHTML = `<div class="empty-inline">등록된 레포가 없어요</div>`;
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
    $(".repo-meta", item).innerHTML = branches
      .map((b) => `<span class="repo-tag base">${esc(b)}</span>`)
      .join("");
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
