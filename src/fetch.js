const ENDPOINT = "https://api.github.com/graphql";

const USER_QUERY = `
query ($login: String!, $after: String) {
  user(login: $login) {
    login
    name
    createdAt
    followers { totalCount }
    pullRequests { totalCount }
    issues { totalCount }
    repositoriesContributedTo(contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) { totalCount }
    contributionsCollection { contributionYears }
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, isFork: false, orderBy: { field: STARGAZERS, direction: DESC }) {
      totalCount
      nodes { stargazerCount forkCount }
      pageInfo { hasNextPage endCursor }
    }
  }
}`;

const RETRIES = 3;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function graphql(query, variables, token) {
  for (let attempt = 1; ; attempt++) {
    let res;
    let body = null;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `bearer ${token}`,
          "content-type": "application/json",
          "user-agent": "github-status",
        },
        body: JSON.stringify({ query, variables }),
      });
      body = await res.json().catch(() => null);
    } catch (err) {
      if (attempt >= RETRIES) throw new Error(`GitHub API request failed: ${err.message}`);
    }
    if (res?.ok) {
      if (body?.errors?.length) {
        throw new Error(`GitHub API error: ${body.errors.map((e) => e.message).join("; ")}`);
      }
      if (!body?.data) throw new Error("GitHub API returned an empty response");
      return body.data;
    }
    // Network errors and 5xx (GitHub's GraphQL API times out now and then) are worth retrying.
    if (res && (res.status < 500 || attempt >= RETRIES)) {
      throw new Error(`GitHub API responded ${res.status}: ${body?.message ?? res.statusText}`);
    }
    await sleep(attempt * 2000);
  }
}

/** contributionsCollection only spans one year, so alias one per year for all-time totals. */
function yearsQuery(years, now) {
  const fields = years.map((year) => {
    const from = `${year}-01-01T00:00:00Z`;
    const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    const to = (end > now ? now : end).toISOString();
    return `y${year}: contributionsCollection(from: "${from}", to: "${to}") { totalCommitContributions totalPullRequestReviewContributions }`;
  });
  return `query ($login: String!) { user(login: $login) { ${fields.join("\n")} } }`;
}

/**
 * Fetch all-time public stats for a user (plus private ones the token can see).
 * @returns {Promise<{login: string, name: string | null, stars: number, forks: number,
 *   commits: number, prs: number, issues: number, reviews: number, followers: number,
 *   repos: number, contributedTo: number}>}
 */
export async function fetchStats(login, token) {
  let data = await graphql(USER_QUERY, { login, after: null }, token);
  if (!data.user) throw new Error(`GitHub user "${login}" not found`);
  const user = data.user;

  let stars = 0;
  let forks = 0;
  for (let page = user.repositories; ; ) {
    for (const repo of page.nodes) {
      stars += repo.stargazerCount;
      forks += repo.forkCount;
    }
    if (!page.pageInfo.hasNextPage) break;
    data = await graphql(USER_QUERY, { login, after: page.pageInfo.endCursor }, token);
    page = data.user.repositories;
  }

  let commits = 0;
  let reviews = 0;
  const years = user.contributionsCollection.contributionYears;
  if (years.length) {
    const perYear = await graphql(yearsQuery(years, new Date()), { login }, token);
    for (const y of Object.values(perYear.user)) {
      commits += y.totalCommitContributions;
      reviews += y.totalPullRequestReviewContributions;
    }
  }

  return {
    login: user.login,
    name: user.name,
    stars,
    forks,
    commits,
    prs: user.pullRequests.totalCount,
    issues: user.issues.totalCount,
    reviews,
    followers: user.followers.totalCount,
    repos: user.repositories.totalCount,
    contributedTo: user.repositoriesContributedTo.totalCount,
  };
}
