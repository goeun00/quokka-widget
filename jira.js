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
    statusCategory: issue.fields?.status?.statusCategory?.key || "",
    priority: issue.fields?.priority?.name || "Medium",
    issueType: issue.fields?.issuetype?.name || "",
    updated: issue.fields?.updated || "",
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
  const fields = "summary,status,priority,updated,issuetype";
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

async function fetchIssuesByKeys(baseUrl, pat, keys, email = "") {
  const jiraBase = normalizeJiraBase(baseUrl);
  const headers = getJiraHeaders(jiraBase, pat, email);

  if (!Array.isArray(keys) || !keys.length) {
    return { issues: [] };
  }

  const jql = `key in (${keys.join(",")}) ORDER BY updated DESC`;
  const fields = "summary,status,priority,updated,issuetype";
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

module.exports = { fetchMyIssues, fetchIssuesByKeys };
