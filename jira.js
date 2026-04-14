async function fetchMyIssues(baseUrl, pat, doneDays = 60) {
  const headers = {
    Authorization: `Bearer ${pat}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  // 유저 정보
  let login = "";
  let initials = "JR";
  try {
    const meRes = await fetch(`${baseUrl}/rest/api/2/myself`, { headers });
    if (meRes.ok) {
      const me = await meRes.json();
      login = me.displayName || me.name || "";
      initials = login
        ? login
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        : "JR";
    }
  } catch {}

  const jql = `(assignee = currentUser() AND statusCategory != Done) OR (assignee = currentUser() AND statusCategory = Done AND updated >= -${doneDays}d) ORDER BY updated DESC`;
  const fields = "summary,status,priority,updated,issuetype";
  const url = `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=${fields}&maxResults=100`;

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Jira API error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  return {
    login,
    initials,
    issues: (data.issues || []).map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary || "",
      status: issue.fields?.status?.name || "",
      statusCategory: issue.fields?.status?.statusCategory?.key || "",
      priority: issue.fields?.priority?.name || "Medium",
      issueType: issue.fields?.issuetype?.name || "",
      updated: issue.fields?.updated || "",
      url: `${baseUrl}/browse/${issue.key}`,
    })),
  };
}

async function fetchIssuesByKeys(baseUrl, pat, keys) {
  const headers = {
    Authorization: `Bearer ${pat}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const jql = `key in (${keys.join(",")}) ORDER BY updated DESC`;
  const fields = "summary,status,priority,updated,issuetype";
  const url = `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=${fields}&maxResults=50`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Jira API error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  return {
    issues: (data.issues || []).map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary || "",
      status: issue.fields?.status?.name || "",
      statusCategory: issue.fields?.status?.statusCategory?.key || "",
      priority: issue.fields?.priority?.name || "Medium",
      issueType: issue.fields?.issuetype?.name || "",
      updated: issue.fields?.updated || "",
      url: `${baseUrl}/browse/${issue.key}`,
    })),
  };
}

module.exports = { fetchMyIssues, fetchIssuesByKeys };
