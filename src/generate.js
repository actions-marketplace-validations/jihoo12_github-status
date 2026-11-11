import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluateAchievements, renderAchievements, renderBadges, TIERS } from "./achievements.js";
import { renderCard } from "./card.js";
import { calculateRank } from "./rank.js";
import { THEME_NAMES } from "./theme.js";

/**
 * Render every output file for `stats` and write them under `out`.
 * @param {object} stats  see fetchStats()
 * @param {{out?: string, theme?: "auto" | "light" | "dark"}} [options]
 * @returns {Promise<{rank: ReturnType<typeof calculateRank>, achievements: object[], files: string[]}>}
 */
export async function generate(stats, { out = "generated", theme = "auto" } = {}) {
  if (!THEME_NAMES.includes(theme)) {
    throw new Error(`Unknown theme "${theme}" (expected auto, light or dark)`);
  }

  const rank = calculateRank(stats);
  const files = {
    "stats.svg": renderCard(stats, rank, { theme }),
    "achievements.svg": renderAchievements(stats, { theme }),
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
    const target = path.join(out, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return { rank, achievements, files: Object.keys(files) };
}
