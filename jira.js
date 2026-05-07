function normalizeJiraBase(baseUrl = "") {
  return String(baseUrl)
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/api\/2$/, "")
    .replace(/\/rest\/api\/3$/, "");
}

function isJiraCloud(baseUrl = "") {
  return normalizeJiraBase(baseUrl).includes(".atlassian.net");
}

function getJiraHeaders(baseUrl, token, email = "") {
  const jiraBase = normalizeJiraBase(baseUrl);
  const isCloud = isJiraCloud(jiraBase);

  return {
    Authorization:
      isCloud && email
        ? `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`
        : `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

const REPORT_FIELD_NAMES = {
  targetStart: "Target start",
  targetEnd: "Target end",
  expectedDeliveryDate: "Expected Delivery Date",
};

let cachedReportFieldIds = null;

async function getReportFieldIds(jiraBase, headers) {
  if (cachedReportFieldIds) return cachedReportFieldIds;
  const fieldIds = {
    targetStart: "",
    targetEnd: "",
    expectedDeliveryDate: "",
  };
  try {
    const res = await fetch(`${jiraBase}/rest/api/2/field`, { headers });
    if (!res.ok) {
      cachedReportFieldIds = fieldIds;
      return fieldIds;
    }
    const fields = await res.json();
    const nameMap = new Map(
      (fields || []).map((field) => [
        String(field.name || "")
          .trim()
          .toLowerCase(),
        field.id,
      ]),
    );
    Object.entries(REPORT_FIELD_NAMES).forEach(([key, name]) => {
      fieldIds[key] = nameMap.get(name.toLowerCase()) || "";
    });
    const candidates = (fields || [])
      .filter((field) =>
        /target|start|시작|업무|delivery|expected|end|종료/i.test(
          field.name || "",
        ),
      )
      .map((field) => `${field.id} : ${field.name}`);
    if (candidates.length) {
      console.log("[Jira report field candidates]\n" + candidates.join("\n"));
    }
    console.log("[Jira selected report field ids]", fieldIds);
  } catch (error) {
    console.warn("Jira report field lookup failed:", error);
  }
  cachedReportFieldIds = fieldIds;
  return fieldIds;
}
function getReportFields(fieldIds = {}) {
  return [
    fieldIds.targetStart,
    fieldIds.targetEnd,
    fieldIds.expectedDeliveryDate,
  ]
    .filter(Boolean)
    .join(",");
}

function pickReportDate(fields = {}, fieldId = "") {
  const value = fieldId ? fields?.[fieldId] : "";

  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value?.value) return String(value.value).slice(0, 10);
  if (value?.startDate) return String(value.startDate).slice(0, 10);
  if (value?.date) return String(value.date).slice(0, 10);
  if (value?.name) return String(value.name).slice(0, 10);

  return "";
}

function mapReportDates(fields = {}, fieldIds = {}) {
  return {
    targetStart: pickReportDate(fields, fieldIds.targetStart),
    targetEnd: pickReportDate(fields, fieldIds.targetEnd),
    expectedDeliveryDate: pickReportDate(fields, fieldIds.expectedDeliveryDate),
  };
}
function mapIssue(baseUrl, issue, fieldIds = {}) {
  const jiraBase = normalizeJiraBase(baseUrl);
  const fields = issue.fields || {};

  return {
    key: issue.key,
    issueKey: issue.key,
    summary: fields.summary || "",
    status: fields.status?.name || "",
    statusCategory:
      fields.status?.statusCategory?.key ||
      fields.status?.statusCategory?.name ||
      "",
    issueType: fields.issuetype?.name || "",
    reporter: fields.reporter?.displayName || "",
    assignee: fields.assignee?.displayName || "",
    components: fields.components || [],
    updated: fields.updated || "",
    url: `${jiraBase}/browse/${issue.key}`,
    ...mapReportDates(fields, fieldIds),
  };
}
function getMonthRange(monthOffset = 0) {
  const base = new Date();
  base.setDate(1);
  base.setHours(0, 0, 0, 0);
  base.setMonth(base.getMonth() + Number(monthOffset || 0));
  const start = new Date(base);
  const end = new Date(base);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

function formatJiraDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isStartedInRange(started, start, end) {
  if (!started) return false;

  const time = new Date(started).getTime();
  if (Number.isNaN(time)) return false;

  return time >= start.getTime() && time < end.getTime();
}

function getSearchUrl(baseUrl, jql, fields, maxResults = 100) {
  const jiraBase = normalizeJiraBase(baseUrl);
  const endpoint = isJiraCloud(jiraBase)
    ? "/rest/api/3/search/jql"
    : "/rest/api/2/search";

  return `${jiraBase}${endpoint}?jql=${encodeURIComponent(jql)}&fields=${encodeURIComponent(fields)}&maxResults=${maxResults}`;
}

async function fetchSearchAll(
  jiraBase,
  headers,
  jql,
  fields,
  maxResults = 100,
) {
  const issues = [];
  const isCloud = isJiraCloud(jiraBase);
  const baseSearchUrl = getSearchUrl(jiraBase, jql, fields, maxResults);

  if (isCloud) {
    let nextPageToken = undefined;

    while (true) {
      const url = nextPageToken
        ? `${baseSearchUrl}&nextPageToken=${encodeURIComponent(nextPageToken)}`
        : baseSearchUrl;

      const res = await fetch(url, { headers });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Jira API error ${res.status}: ${text}`);
      }

      const data = await res.json();
      const pageIssues = data.issues || [];
      issues.push(...pageIssues);

      if (!pageIssues.length || !data.nextPageToken) break;
      nextPageToken = data.nextPageToken;
    }
    return issues;
  }
  let startAt = 0;

  while (true) {
    const url = `${baseSearchUrl}&startAt=${startAt}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira API error ${res.status}: ${text}`);
    }
    const data = await res.json();
    const pageIssues = data.issues || [];
    issues.push(...pageIssues);

    startAt += pageIssues.length;
    if (!pageIssues.length || startAt >= (data.total ?? startAt)) break;
  }
  return issues;
}

async function fetchWorklogsForIssue(jiraBase, headers, issueKey, start, end) {
  const startedAfter = start.getTime();
  const startedBefore = end.getTime();
  const worklogs = [];
  let startAt = 0;

  while (true) {
    const url =
      `${jiraBase}/rest/api/2/issue/${issueKey}/worklog` +
      `?startedAfter=${startedAfter}` +
      `&startedBefore=${startedBefore}` +
      `&startAt=${startAt}` +
      `&maxResults=100`;

    const res = await fetch(url, { headers });
    if (!res.ok) break;

    const data = await res.json();
    const pageWorklogs = data.worklogs || [];
    worklogs.push(...pageWorklogs);

    startAt += pageWorklogs.length;
    if (!pageWorklogs.length || startAt >= Number(data.total || 0)) break;
  }

  return worklogs;
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

  const reportFieldIds = await getReportFieldIds(jiraBase, headers);
  const reportFields = getReportFields(reportFieldIds);
  const fields = [
    "summary,status,updated,issuetype,reporter,assignee,components",
    reportFields,
  ]
    .filter(Boolean)
    .join(",");

  const jql = `(assignee=currentUser() OR watcher=currentUser()) AND (statusCategory!=Done OR (statusCategory=Done AND updated>=-${doneDays}d)) ORDER BY updated DESC`;
  const issues = await fetchSearchAll(jiraBase, headers, jql, fields, 100);

  return {
    login,
    initials,
    issues: issues.map((issue) => mapIssue(jiraBase, issue, reportFieldIds)),
  };
}

async function fetchIssuesByKeys(baseUrl, pat, keys, email = "") {
  const jiraBase = normalizeJiraBase(baseUrl);
  const headers = getJiraHeaders(jiraBase, pat, email);

  if (!Array.isArray(keys) || !keys.length) {
    return { issues: [] };
  }

  const reportFieldIds = await getReportFieldIds(jiraBase, headers);
  const reportFields = getReportFields(reportFieldIds);
  const fields = [
    "summary,status,updated,issuetype,reporter,assignee,components",
    reportFields,
  ]
    .filter(Boolean)
    .join(",");

  const jql = `key in (${keys.join(",")}) ORDER BY updated DESC`;
  const issues = await fetchSearchAll(jiraBase, headers, jql, fields, 100);

  return {
    issues: issues.map((issue) => mapIssue(jiraBase, issue, reportFieldIds)),
  };
}

async function fetchMyWorklogs(baseUrl, pat, monthOffset = 0, email = "") {
  const jiraBase = normalizeJiraBase(baseUrl);
  const headers = getJiraHeaders(jiraBase, pat, email);

  const meRes = await fetch(`${jiraBase}/rest/api/2/myself`, { headers });
  if (!meRes.ok) {
    const text = await meRes.text();
    throw new Error(`Jira myself API error ${meRes.status}: ${text}`);
  }

  const me = await meRes.json();
  const meId = me.accountId || me.name || me.key;

  const { start, end } = getMonthRange(monthOffset);
  const reportFieldIds = await getReportFieldIds(jiraBase, headers);
  const reportFields = getReportFields(reportFieldIds);
  const fields = [
    "summary,status,updated,issuetype,reporter,assignee,components",
    reportFields,
  ]
    .filter(Boolean)
    .join(",");

  const jql =
    `worklogAuthor = currentUser() ` +
    `AND worklogDate >= "${formatJiraDate(start)}" ` +
    `AND worklogDate < "${formatJiraDate(end)}" ` +
    `ORDER BY updated DESC`;
  const issues = await fetchSearchAll(jiraBase, headers, jql, fields, 100);

  let totalSeconds = 0;
  const logs = [];
  const issueMap = new Map();

  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(5);

  await Promise.all(
    issues.map((issue) =>
      limit(async () => {
        const issueInfo = mapIssue(jiraBase, issue, reportFieldIds);
        const worklogs = await fetchWorklogsForIssue(
          jiraBase,
          headers,
          issue.key,
          start,
          end,
        );

        for (const log of worklogs) {
          const authorId =
            log.author?.accountId || log.author?.name || log.author?.key;

          if (meId && authorId !== meId) continue;

          // 최종 기준: Date Started만 사용
          if (!isStartedInRange(log.started, start, end)) continue;

          const seconds = Number(log.timeSpentSeconds || 0);
          if (seconds <= 0) continue;

          totalSeconds += seconds;
          issueMap.set(issue.key, issueInfo);

          logs.push({
            ...issueInfo,
            issueKey: issue.key,
            started: log.started,
            timeSpent: log.timeSpent,
            timeSpentSeconds: seconds,
            worklogId: log.id || "",
          });
        }
      }),
    ),
  );

  logs.sort((a, b) => new Date(b.started || 0) - new Date(a.started || 0));

  const issuesFromLogs = [...issueMap.values()].sort((a, b) => {
    const aLatest = logs.find((log) => log.issueKey === a.key)?.started || "";
    const bLatest = logs.find((log) => log.issueKey === b.key)?.started || "";
    return new Date(bLatest || 0) - new Date(aLatest || 0);
  });

  return {
    month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    label: `${start.getFullYear()}.${String(start.getMonth() + 1).padStart(2, "0")}`,
    range: {
      start: formatJiraDate(start),
      end: formatJiraDate(end),
    },
    totalSeconds,
    loggedDays: totalSeconds / 28800,
    logs,
    issues: issuesFromLogs,
  };
}

module.exports = {
  fetchMyIssues,
  fetchIssuesByKeys,
  fetchMyWorklogs,
};
