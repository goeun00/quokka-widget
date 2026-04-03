async function fetchMyIssues(baseUrl, pat, doneDays = 60) {
  const jql = `(assignee = currentUser() AND statusCategory != Done) OR (assignee = currentUser() AND statusCategory = Done AND updated >= -${doneDays}d) ORDER BY updated DESC`;
  const fields = "summary,status,priority,updated,issuetype";
  const url = `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=${fields}&maxResults=100`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Jira API error ${res.status}: ${txt}`);
  }

  const data = await res.json();
  return (data.issues || []).map((issue) => ({
    key: issue.key,
    summary: issue.fields?.summary || "",
    status: issue.fields?.status?.name || "",
    statusCategory: issue.fields?.status?.statusCategory?.key || "",
    priority: issue.fields?.priority?.name || "Medium",
    issueType: issue.fields?.issuetype?.name || "",
    updated: issue.fields?.updated || "",
    url: `${baseUrl}/browse/${issue.key}`,
  }));
}

module.exports = { fetchMyIssues };
