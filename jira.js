function normalizeJiraBase(baseUrl = "") {
  return String(baseUrl)
    .trim()
    .replace(/\/$/, "")
    .replace(/\/rest\/api\/2$/, "")
    .replace(/\/rest\/api\/3$/, "");
}

function isJiraCloud(baseUrl = "") {
  return normalizeJiraBase(baseUrl).includes(".atlassian.net");
}

function getJiraHeaders(baseUrl, token, email = "") {
  const isCloud = isJiraCloud(baseUrl);

  return {
    Authorization:
      isCloud && email
        ? `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`
        : `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}
function getMonthRange(monthOffset = 0) {
  const base = new Date();
  base.setDate(1);
  base.setHours(0, 0, 0, 0);
  base.setMonth(base.getMonth() + monthOffset);

  const start = new Date(base);
  const end = new Date(base);
  end.setMonth(end.getMonth() + 1);

  return { start, end };
}

function isInRange(dateValue, start, end) {
  const time = new Date(dateValue).getTime();
  return time >= start.getTime() && time < end.getTime();
}

function getOverlapSeconds(logStarted, spentSeconds, rangeStart, rangeEnd) {
  const start = new Date(logStarted).getTime();
  const end = start + (spentSeconds || 0) * 1000;
  const overlapStart = Math.max(start, rangeStart.getTime());
  const overlapEnd = Math.min(end, rangeEnd.getTime());
  return Math.max(0, Math.floor((overlapEnd - overlapStart) / 1000));
}

function getSearchUrl(baseUrl, jql, fields, maxResults = 100) {
  const jiraBase = normalizeJiraBase(baseUrl);
  const endpoint = isJiraCloud(jiraBase)
    ? "/rest/api/3/search/jql"
    : "/rest/api/2/search";

  return `${jiraBase}${endpoint}?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(fields)}&maxResults=${maxResults}`;
}

function mapIssue(baseUrl, issue) {
  const jiraBase = normalizeJiraBase(baseUrl);

  return {
    key: issue.key,
    summary: issue.fields?.summary || "",
    status: issue.fields?.status?.name || "",
    statusCategory: issue.fields.status.statusCategory?.key || "new",
    issueType: issue.fields.issuetype?.name || "Task",
    updated: issue.fields?.updated || "",
    reporter: issue.fields?.reporter?.displayName || "",
    assignee: issue.fields?.assignee?.displayName || "",
    url: `${jiraBase}/browse/${issue.key}`,
  };
}

async function fetchMyIssues(baseUrl, pat, doneDays = 60, email = "") {
  const jiraBase = normalizeJiraBase(baseUrl);
  const headers = getJiraHeaders(jiraBase, pat, email);

  let login = "";
  let initials = "JR";

  try {
    const meRes = await fetch(`${jiraBase}/rest/api/2/myself`, { headers });

    if (meRes.ok) {
      const me = await meRes.json();
      login = me.displayName || me.name || "";
      initials = login
        ? login
            .split(" ")
            .map((word) => word[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        : "JR";
    }
  } catch {}

  const jql = `(assignee=currentUser() OR watcher=currentUser()) AND (statusCategory!=Done OR (statusCategory=Done AND updated>=-${doneDays}d)) ORDER BY updated DESC`;
  const fields = "summary,status,updated,issuetype,reporter,assignee";
  const url = getSearchUrl(jiraBase, jql, fields, 100);
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API error ${res.status}: ${text}`);
  }

  const data = await res.json();

  return {
    login,
    initials,
    issues: (data.issues || []).map((issue) => mapIssue(jiraBase, issue)),
  };
}

function formatJiraDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function fetchMyWorklogs(baseUrl, pat, monthOffset = 0, email = "") {
  const jiraBase = normalizeJiraBase(baseUrl);
  const headers = getJiraHeaders(jiraBase, pat, email);

  const meRes = await fetch(`${jiraBase}/rest/api/2/myself`, { headers });
  const me = await meRes.json();

  const { start, end } = getMonthRange(monthOffset);

  const startedAfter = start.getTime();
  const startedBefore = end.getTime();

  const jql = `worklogAuthor = currentUser() AND worklogDate >= "${formatJiraDate(start)}" AND worklogDate < "${formatJiraDate(end)}"`;
  const fields = "summary";
  const searchUrl = getSearchUrl(jiraBase, jql, fields, 100);

  const issueRes = await fetch(searchUrl, { headers });
  if (!issueRes.ok) throw new Error(await issueRes.text());

  const issueData = await issueRes.json();
  const issues = issueData.issues || [];

  let totalSeconds = 0;
  const logs = [];

  for (const issue of issues) {
    const worklogUrl =
      `${jiraBase}/rest/api/2/issue/${issue.key}/worklog` +
      `?startedAfter=${startedAfter}&startedBefore=${startedBefore}&maxResults=100`;

    const worklogRes = await fetch(worklogUrl, { headers });
    if (!worklogRes.ok) continue;

    const worklogData = await worklogRes.json();

    for (const log of worklogData.worklogs || []) {
      const authorId =
        log.author?.accountId || log.author?.name || log.author?.key;
      const meId = me.accountId || me.name || me.key;
      if (authorId !== meId) continue;
      const overlapSeconds = getOverlapSeconds(
        log.started,
        log.timeSpentSeconds || 0,
        start,
        end,
      );

      if (overlapSeconds <= 0) continue;

      totalSeconds += overlapSeconds;

      logs.push({
        issueKey: issue.key,
        summary: issue.fields?.summary || "",
        started: log.started,
        timeSpent: log.timeSpent,
        timeSpentSeconds: overlapSeconds,
      });
    }
  }

  return {
    month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    totalSeconds,
    loggedDays: totalSeconds / 3600 / 8,
    logs,
  };
}

async function fetchIssuesByKeys(baseUrl, pat, keys, email = "") {
  const jiraBase = normalizeJiraBase(baseUrl);
  const headers = getJiraHeaders(jiraBase, pat, email);

  if (!Array.isArray(keys) || !keys.length) {
    return { issues: [] };
  }
  const jql = `key in (${keys.join(",")}) ORDER BY updated DESC`;
  const fields = "summary,status,updated,issuetype,reporter,assignee";
  const url = getSearchUrl(jiraBase, jql, fields, 50);
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API error ${res.status}: ${text}`);
  }

  const data = await res.json();

  return {
    issues: (data.issues || []).map((issue) => mapIssue(jiraBase, issue)),
  };
}

module.exports = { fetchMyIssues, fetchIssuesByKeys, fetchMyWorklogs };
