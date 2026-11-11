import { icon } from "./icons.js";
import { FONT, themeCss } from "./theme.js";
import { escapeXml, formatCount, formatPercentile, textWidth } from "./util.js";

// Index = tier. Tier 0 is "not unlocked yet".
export const TIERS = [
  { name: "Locked", hi: "#9aa4af", lo: "#57606a" },
  { name: "Bronze", hi: "#f0b27a", lo: "#9c5a2a" },
  { name: "Silver", hi: "#f1f5f9", lo: "#8793a1" },
  { name: "Gold", hi: "#ffe58f", lo: "#d4930a" },
  { name: "Diamond", hi: "#a5f3fc", lo: "#6366f1" },
];

// `goals[i]` is the value needed to reach tier i + 1.
const ACHIEVEMENTS = [
  { id: "stars", name: "Star Collector", icon: "star", key: "stars", goals: [10, 50, 200, 1000] },
  { id: "commits", name: "Committer", icon: "commit", key: "commits", goals: [100, 500, 2000, 10000] },
  { id: "prs", name: "Merge Maker", icon: "pr", key: "prs", goals: [10, 50, 200, 1000] },
  { id: "issues", name: "Issue Scout", icon: "issue", key: "issues", goals: [10, 50, 200, 500] },
  { id: "reviews", name: "Keen Reviewer", icon: "review", key: "reviews", goals: [5, 25, 100, 500] },
  { id: "followers", name: "Crowd Magnet", icon: "followers", key: "followers", goals: [10, 50, 200, 1000] },
  { id: "repos", name: "Repo Builder", icon: "repo", key: "repos", goals: [5, 20, 50, 100] },
  { id: "contributions", name: "Collaborator", icon: "network", key: "contributedTo", goals: [3, 10, 30, 100] },
];

/** Work out which tier of each achievement the stats have reached. */
export function evaluateAchievements(stats) {
  return ACHIEVEMENTS.map(({ key, goals, ...rest }) => {
    const value = Math.max(0, Number(stats[key]) || 0);
    const tier = goals.filter((goal) => value >= goal).length;
    return { ...rest, value, tier, next: goals[tier] ?? null };
  });
}

const RANK_TIER = { S: 4, "A+": 3, A: 3, "A-": 3, "B+": 2, B: 2, "B-": 2, "C+": 1, C: 1 };

export const MEDAL_WIDTH = 120;
export const MEDAL_HEIGHT = 124;

/**
 * Medal artwork without the <svg> wrapper, so several can share one document.
 * `uid` keeps gradient ids unique. `center` is the SVG drawn inside the disc.
 */
function medal({ uid, tier, center, pill }) {
  const { hi, lo } = TIERS[tier];
  const pillWidth = Math.round(textWidth(pill, 12)) + 22;
  const pips = Array.from({ length: tier }, (_, i) => {
    const x = 60 + (i - (tier - 1) / 2) * 9;
    return `<circle cx="${x}" cy="27" r="2.2" fill="${hi}"/>`;
  }).join("");
  return `<defs>
<linearGradient id="${uid}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
<radialGradient id="${uid}d" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#2b3550"/><stop offset="1" stop-color="#0d1117"/></radialGradient>
</defs>
<circle cx="60" cy="56" r="52" fill="url(#${uid}r)"/>
<circle cx="60" cy="56" r="44" fill="url(#${uid}d)"/>
<circle cx="60" cy="56" r="39" fill="none" stroke="${hi}" stroke-opacity=".35" stroke-dasharray="2 5" stroke-linecap="round"/>
${pips}
${center}
<rect x="${60 - pillWidth / 2}" y="98" width="${pillWidth}" height="22" rx="11" fill="url(#${uid}r)" stroke="#0d1117" stroke-width="3"/>
<text x="60" y="113.5" text-anchor="middle" font-family='${FONT}' font-size="12" font-weight="700" fill="#0d1117">${escapeXml(pill)}</text>`;
}

function achievementMedal(a, uid) {
  const { hi } = TIERS[a.tier];
  return medal({
    uid,
    tier: a.tier,
    center: icon(a.icon, { x: 40, y: 38, size: 40, stroke: hi, strokeWidth: 1.8, opacity: a.tier ? 1 : 0.6 }),
    pill: a.tier ? formatCount(a.value) : `${formatCount(a.value)}/${formatCount(a.next)}`,
  });
}

function standalone(label, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${MEDAL_WIDTH}" height="${MEDAL_HEIGHT}" viewBox="0 0 ${MEDAL_WIDTH} ${MEDAL_HEIGHT}" role="img" aria-label="${escapeXml(label)}">
<title>${escapeXml(label)}</title>
${body}
</svg>
`;
}

const describe = (a) => `${a.name}: ${TIERS[a.tier].name} (${formatCount(a.value)})`;

/**
 * One standalone medal per achievement plus one for the rank,
 * keyed by output file name (without .svg).
 * @returns {Record<string, string>}
 */
export function renderBadges(stats, rank) {
  const tier = RANK_TIER[rank.level];
  const top = formatPercentile(rank.percentile);
  const badges = {
    rank: standalone(
      `Rank ${rank.level} (${top})`,
      medal({
        uid: "m",
        tier,
        center: `<text x="60" y="${tier ? 69 : 66}" text-anchor="middle" font-family='${FONT}' font-size="30" font-weight="800" fill="${TIERS[tier].hi}">${rank.level}</text>`,
        pill: top,
      }),
    ),
  };
  for (const a of evaluateAchievements(stats)) {
    badges[a.id] = standalone(describe(a), achievementMedal(a, "m"));
  }
  return badges;
}

/** All achievements on one card. */
export function renderAchievements(stats, { theme = "auto" } = {}) {
  const list = evaluateAchievements(stats);
  const columns = 4;
  const width = 495;
  const cellWidth = (width - 48) / columns;
  const cellHeight = 128;
  const scale = 0.7;
  const rowsCount = Math.ceil(list.length / columns);
  const height = 56 + rowsCount * cellHeight + 6;
  const unlocked = list.filter((a) => a.tier > 0).length;

  const cells = list
    .map((a, i) => {
      const x = 24 + (i % columns) * cellWidth;
      const y = 56 + Math.floor(i / columns) * cellHeight;
      const mid = cellWidth / 2;
      const status = a.tier ? TIERS[a.tier].name : "Locked";
      return `<g transform="translate(${x.toFixed(2)} ${y})">
<g transform="translate(${(mid - (MEDAL_WIDTH * scale) / 2).toFixed(2)} 0) scale(${scale})">
${achievementMedal(a, `a${i}`)}
</g>
<text class="name" x="${mid}" y="104" text-anchor="middle">${escapeXml(a.name)}</text>
<text class="tier" x="${mid}" y="119" text-anchor="middle">${status}</text>
</g>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t d">
<title id="t">Achievements</title>
<desc id="d">${escapeXml(list.map(describe).join(", "))}</desc>
<style>
${themeCss(theme)}
text{font-family:${FONT}}
.title{font-size:16px;font-weight:700;fill:var(--text)}
.count{font-size:12px;fill:var(--muted)}
.name{font-size:12px;font-weight:600;fill:var(--text)}
.tier{font-size:11px;fill:var(--muted)}
.a1{stop-color:var(--a1)}.a2{stop-color:var(--a2)}
</style>
<defs>
<clipPath id="clip"><rect width="${width}" height="${height}" rx="10"/></clipPath>
<linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="a1"/><stop offset="1" class="a2"/></linearGradient>
</defs>
<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="10" fill="var(--bg)" stroke="var(--border)"/>
<rect width="${width}" height="4" fill="url(#acc)" clip-path="url(#clip)"/>
<text class="title" x="24" y="36">Achievements</text>
<text class="count" x="${width - 24}" y="36" text-anchor="end">${unlocked} / ${list.length} unlocked</text>
${cells}
</svg>
`;
}
