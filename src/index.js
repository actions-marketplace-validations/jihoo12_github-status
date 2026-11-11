#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { evaluateAchievements, renderAchievements, renderBadges, TIERS } from "./achievements.js";
import { renderCard } from "./card.js";
import { fetchStats } from "./fetch.js";
import { calculateRank } from "./rank.js";
import { THEME_NAMES } from "./theme.js";

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
  if (!THEME_NAMES.includes(values.theme)) {
    throw new Error(`Unknown theme "${values.theme}" (expected auto, light or dark)`);
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

  const rank = calculateRank(stats);
  const files = {
    "stats.svg": renderCard(stats, rank, { theme: values.theme }),
    "achievements.svg": renderAchievements(stats, { theme: values.theme }),
  };
  for (const [name, svg] of Object.entries(renderBadges(stats, rank))) {
    files[path.join("badges", `${name}.svg`)] = svg;
  }
  const achievements = evaluateAchievements(stats).map(({ id, name, value, tier, next }) => ({
    id,
    name,
    value,
    tier: TIERS[tier].name,
    next,
  }));
  files["stats.json"] = `${JSON.stringify({ ...stats, rank, achievements }, null, 2)}\n`;

  for (const [file, content] of Object.entries(files)) {
    const target = path.join(values.out, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  console.log(
    `${stats.login}: rank ${rank.level} (top ${rank.percentile.toFixed(1)}%) — wrote ${Object.keys(files).length} files to ${values.out}/`,
  );
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exitCode = 1;
});
