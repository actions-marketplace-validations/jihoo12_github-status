import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { evaluateAchievements, renderAchievements, renderBadges } from "../src/achievements.js";
import { renderCard } from "../src/card.js";
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
