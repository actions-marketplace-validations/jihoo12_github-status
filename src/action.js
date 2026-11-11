// Entry point when this repository is used as a GitHub Action (see action.yml).
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

import { fetchStats } from "./fetch.js";
import { generate } from "./generate.js";
import { formatCount, formatPercentile } from "./util.js";

/** Action inputs arrive as INPUT_<NAME> environment variables. */
export function input(name, env = process.env) {
  return (env[`INPUT_${name.replaceAll(" ", "_").toUpperCase()}`] ?? "").trim();
}

export function booleanInput(name, env = process.env) {
  const value = input(name, env).toLowerCase();
  if (value === "true") return true;
  if (value === "false" || value === "") return false;
  throw new Error(`Input "${name}" must be true or false, got "${value}"`);
}

/** Markdown for the workflow run's summary page. */
export function summary(stats, rank, achievements) {
  const rows = achievements.map(
    (a) => `| ${a.name} | ${formatCount(a.value)} | ${a.tier} | ${a.next === null ? "—" : formatCount(a.next)} |`,
  );
  return `### GitHub stats for @${stats.login}

**Rank ${rank.level}** (${formatPercentile(rank.percentile)})

| Achievement | Value | Tier | Next goal |
| --- | ---: | --- | ---: |
${rows.join("\n")}
`;
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

function succeeds(...args) {
  try {
    execFileSync("git", args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Commit and push `dir` if it changed. Returns whether a commit was made. */
function commit(dir, message) {
  git("add", "--", dir);
  if (succeeds("diff", "--cached", "--quiet", "--", dir)) {
    console.log("Stats unchanged, nothing to commit.");
    return false;
  }
  if (!succeeds("symbolic-ref", "-q", "HEAD")) {
    console.log("::warning::Not on a branch (detached HEAD), so the generated files were not committed.");
    return false;
  }
  git(
    "-c", "user.name=github-actions[bot]",
    "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com",
    "commit", "-m", message, "--", dir,
  );
  git("push");
  return true;
}

async function main() {
  const token = input("token");
  const login = input("user") || process.env.GITHUB_REPOSITORY_OWNER;
  const out = input("output-dir") || "generated";
  if (!token) throw new Error('Input "token" is empty');
  if (!login) throw new Error('Input "user" is empty and GITHUB_REPOSITORY_OWNER is not set');
  const shouldCommit = booleanInput("commit");

  const stats = await fetchStats(login, token);
  const { rank, achievements, files } = await generate(stats, { out, theme: input("theme") || "auto" });
  console.log(`${stats.login}: rank ${rank.level} (${formatPercentile(rank.percentile)}), wrote ${files.length} files to ${out}/`);

  const changed = shouldCommit && commit(out, input("commit-message") || "Update GitHub stats");

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `rank=${rank.level}\npercentile=${rank.percentile.toFixed(2)}\ncommitted=${changed}\n`,
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(stats, rank, achievements));
  }
}

// Only run when executed directly, so tests can import the helpers.
if (import.meta.main) {
  main().catch((err) => {
    console.log(`::error::${err.message}`);
    process.exitCode = 1;
  });
}
