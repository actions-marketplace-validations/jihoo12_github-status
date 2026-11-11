#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { fetchStats } from "./fetch.js";
import { generate } from "./generate.js";

const USAGE = `Usage: node src/index.js [options]

  -u, --user <login>     GitHub login (default: $GITHUB_REPOSITORY_OWNER)
  -o, --out <dir>        Output directory (default: generated)
  -t, --theme <theme>    Card theme: auto | light | dark (default: auto)
      --fixture <file>   Read stats from a JSON file instead of the GitHub API
  -h, --help

Environment: GITHUB_TOKEN (or GH_TOKEN) is required unless --fixture is used.`;

async function main() {
  const { values } = parseArgs({
    options: {
      user: { type: "string", short: "u" },
      out: { type: "string", short: "o", default: "generated" },
      theme: { type: "string", short: "t", default: "auto" },
      fixture: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }

  let stats;
  if (values.fixture) {
    stats = JSON.parse(await readFile(values.fixture, "utf8"));
  } else {
    const login = values.user ?? process.env.GITHUB_REPOSITORY_OWNER;
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
    if (!login) throw new Error("No user given: pass --user <login>");
    if (!token) throw new Error("No token: set GITHUB_TOKEN (or GH_TOKEN)");
    stats = await fetchStats(login, token);
  }

  const { rank, files } = await generate(stats, { out: values.out, theme: values.theme });
  console.log(
    `${stats.login}: rank ${rank.level} (top ${rank.percentile.toFixed(1)}%) — wrote ${files.length} files to ${values.out}/`,
  );
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
});
