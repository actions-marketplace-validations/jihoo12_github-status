import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { evaluateAchievements, renderAchievements, renderBadges } from "../src/achievements.js";
import { booleanInput, input, summary } from "../src/action.js";
import { renderCard } from "../src/card.js";
import { generate } from "../src/generate.js";
import { calculateRank } from "../src/rank.js";
import { formatCount, formatPercentile } from "../src/util.js";

const stats = JSON.parse(readFileSync(new URL("./fixture.json", import.meta.url), "utf8"));

test("rank: no activity is the lowest rank", () => {
  const rank = calculateRank({});
  assert.equal(rank.level, "C");
  assert.equal(rank.percentile, 100);
});

test("rank: exactly median activity lands at the 50th percentile", () => {
  const rank = calculateRank({ commits: 1000, prs: 50, issues: 25, reviews: 2, stars: 50, followers: 10 });
  assert.equal(rank.percentile, 50);
  assert.equal(rank.level, "B+");
});

test("rank: huge activity reaches S and more activity never ranks lower", () => {
  const big = { commits: 1e5, prs: 1e4, issues: 1e4, reviews: 1e4, stars: 1e6, followers: 1e5 };
  assert.equal(calculateRank(big).level, "S");
  assert.ok(calculateRank({ ...stats, stars: stats.stars + 100 }).percentile < calculateRank(stats).percentile);
});

test("formatCount / formatPercentile", () => {
  assert.equal(formatCount(987), "987");
  assert.equal(formatCount(1000), "1k");
  assert.equal(formatCount(1234), "1.2k");
  assert.equal(formatCount(999_950), "999.9k");
  assert.equal(formatCount(2_500_000), "2.5M");
  assert.equal(formatPercentile(0.32), "Top 0.4%");
  assert.equal(formatPercentile(12.1), "Top 13%");
  assert.equal(formatPercentile(100), "Top 100%");
});

test("card shows the stats and rank, and escapes the name", () => {
  const rank = calculateRank(stats);
  const svg = renderCard(stats, rank);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.ok(svg.includes(">The Octocat &lt;&amp;&gt;</text>"));
  assert.ok(svg.includes(">@octocat · GitHub Stats</text>"));
  assert.ok(!svg.includes("<&>"));
  assert.ok(svg.includes(">1.2k</text>"));
  assert.ok(svg.includes(`>${rank.level}</text>`));
  assert.ok(svg.includes("prefers-color-scheme:dark"));
  assert.ok(!renderCard(stats, rank, { theme: "dark" }).includes("prefers-color-scheme"));
});

test("card falls back to login when the user has no display name", () => {
  const svg = renderCard({ ...stats, name: null }, calculateRank(stats));
  assert.ok(svg.includes(">octocat</text>"));
});

test("achievement tiers follow their goals", () => {
  const byId = Object.fromEntries(evaluateAchievements(stats).map((a) => [a.id, a]));
  assert.equal(byId.stars.tier, 4); // 1234 >= 1000
  assert.equal(byId.stars.next, null);
  assert.equal(byId.commits.tier, 3); // 2150: past 2000, short of 10000
  assert.equal(byId.commits.next, 10000);
  assert.equal(byId.reviews.tier, 1); // 15: past 5, short of 25

  const none = evaluateAchievements({});
  assert.ok(none.every((a) => a.tier === 0));
  assert.equal(none[0].next, 10);
  assert.equal(evaluateAchievements({ stars: 10 })[0].tier, 1); // goals are inclusive
});

test("badges: one medal per achievement plus the rank", () => {
  const badges = renderBadges(stats, calculateRank(stats));
  assert.deepEqual(Object.keys(badges), [
    "rank", "stars", "commits", "prs", "issues", "reviews", "followers", "repos", "contributions",
  ]);
  assert.ok(badges.stars.includes('aria-label="Star Collector: Diamond (1.2k)"'));
  assert.match(badges.rank, /aria-label="Rank [SABC][+-]? \(Top [\d.]+%\)"/);

  const locked = renderBadges({ ...stats, issues: 7 }, calculateRank(stats));
  assert.ok(locked.issues.includes("Issue Scout: Locked"));
  assert.ok(locked.issues.includes(">7/10</text>"));
});

test("achievements card lists every achievement with unique gradient ids", () => {
  const svg = renderAchievements({ ...stats, issues: 0 });
  assert.ok(svg.includes("7 / 8 unlocked"));
  assert.ok(svg.includes(">Merge Maker</text>"));
  const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test("generate writes every file", async () => {
  const out = mkdtempSync(path.join(tmpdir(), "github-status-"));
  try {
    const { rank, files } = await generate(stats, { out });
    assert.equal(files.length, 12);
    for (const file of files) assert.ok(existsSync(path.join(out, file)), file);
    const json = JSON.parse(readFileSync(path.join(out, "stats.json"), "utf8"));
    assert.equal(json.rank.level, rank.level);
    assert.equal(json.achievements.length, 8);
    await assert.rejects(generate(stats, { out, theme: "neon" }), /Unknown theme/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("action: inputs and run summary", () => {
  const env = { "INPUT_OUTPUT-DIR": " assets ", INPUT_COMMIT: "True" };
  assert.equal(input("output-dir", env), "assets");
  assert.equal(input("user", env), "");
  assert.equal(booleanInput("commit", env), true);
  assert.equal(booleanInput("missing", env), false);
  assert.throws(() => booleanInput("output-dir", env), /must be true or false/);

  const rank = calculateRank(stats);
  const md = summary(stats, rank, [{ name: "Star Collector", value: 1234, tier: "Diamond", next: null }]);
  assert.ok(md.includes("@octocat"));
  assert.ok(md.includes(`**Rank ${rank.level}**`));
  assert.ok(md.includes("| Star Collector | 1.2k | Diamond | — |"));
});

test("action.yml inputs match what the action reads", () => {
  const yml = readFileSync(new URL("../action.yml", import.meta.url), "utf8");
  const src = readFileSync(new URL("../src/action.js", import.meta.url), "utf8");
  const declared = [...yml.split("\noutputs:")[0].matchAll(/^  ([a-z-]+):$/gm)].map((m) => m[1]).filter((n) => n !== "icon" && n !== "color");
  const read = [...src.matchAll(/[iI]nput\("([a-z-]+)"\)/g)].map((m) => m[1]);
  assert.deepEqual(declared.sort(), [...new Set(read)].sort());
});
