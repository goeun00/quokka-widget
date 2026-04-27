function getApiBase(baseUrl = "") {
  const normalized = String(baseUrl)
    .trim()
    .replace(/\/$/, "")
    .replace(/\/api\/v3$/, "");

  if (normalized === "https://github.com") {
    return "https://api.github.com";
  }

  return `${normalized}/api/v3`;
}

function toWebBase(baseUrl = "") {
  return String(baseUrl)
    .trim()
    .replace(/\/$/, "")
    .replace(/\/api\/v3$/, "");
}

async function ghFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}${text ? `: ${text}` : ""}`);
  }
  return res;
}

async function fetchMyPRs(baseUrl, token, repos = []) {
  const apiBase = getApiBase(baseUrl);
  const webBase = toWebBase(baseUrl);

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const meRes = await ghFetch(`${apiBase}/user`, { headers });
  const me = await meRes.json();
  const login = me.login;
  const avatarUrl = me.avatar_url || "";

  const threshold = new Date(Date.now() - 90 * 86400000);
  const BATCH = 4;
  const chunks = [];

  for (let i = 0; i < repos.length; i += BATCH) {
    const batch = await Promise.all(
      repos.slice(i, i + BATCH).map(async ({ owner, repo }) => {
        try {
          const res = await ghFetch(
            `${apiBase}/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100`,
            { headers },
          );
          const prs = await res.json();

          return prs
            .filter((pr) => pr.user?.login === login)
            .filter((pr) => {
              if (pr.state === "open") return true;
              const refDate = new Date(
                pr.closed_at || pr.updated_at || pr.created_at,
              );
              return refDate >= threshold;
            })
            .map((pr) => {
              const stateLabel =
                pr.state === "open"
                  ? "Open"
                  : pr.merged_at
                    ? "Merged"
                    : "Closed";

              return {
                owner,
                repo,
                number: pr.number,
                title: pr.title,
                url:
                  pr.html_url ||
                  `${webBase}/${owner}/${repo}/pull/${pr.number}`,
                base: pr.base?.ref || "",
                head: pr.head?.ref || "",
                updatedAt: pr.updated_at,
                createdAt: pr.created_at,
                closedAt: pr.closed_at,
                mergedAt: pr.merged_at,
                stateLabel,
                stateGroup: pr.state === "open" ? "open" : "done",
              };
            });
        } catch (error) {
          console.warn(`PR fetch failed for ${owner}/${repo}:`, error.message);
          return [];
        }
      }),
    );
    chunks.push(...batch);
  }

  return {
    login,
    avatarUrl,
    prs: chunks
      .flat()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
  };
}

module.exports = { fetchMyPRs };
