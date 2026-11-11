import { icon } from "./icons.js";
import { FONT, themeCss } from "./theme.js";
import { escapeXml, formatCount, formatPercentile, textWidth } from "./util.js";

// Index = tier. Tier 0 is "not unlocked yet". Flat cel-shading colours:
// `base` with a hard `light` highlight and `dark` shadow; `disc` is the face.
export const TIERS = [
  { name: "Locked", base: "#aab2bd", light: "#d9dee4", dark: "#7b8491", disc: "#596070" },
  { name: "Bronze", base: "#f08a4b", light: "#ffc491", dark: "#b5531d", disc: "#3a2a8c" },
  { name: "Silver", base: "#c5d2e6", light: "#ffffff", dark: "#7d8cab", disc: "#2b3f9e" },
  { name: "Gold", base: "#ffc928", light: "#fff3a6", dark: "#e68a00", disc: "#6a2a9e" },
  { name: "Diamond", base: "#4fe3ff", light: "#dcfcff", dark: "#7a6bff", disc: "#3b1fa8" },
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

export const MEDAL_WIDTH = 140;
export const MEDAL_HEIGHT = 134;
const CX = 70;
const CY = 64;
const INK = "#1b1440";

// Shared by every medal in a document. Without animation support the medal
// simply rests in its first frame.
const MEDAL_CSS = `.pop{animation:pop 1.4s ease-in-out infinite;transform-origin:${CX}px ${CY}px}
.pop.b{animation-delay:-.7s}
.bob{animation:bob .9s ease-in-out infinite;transform-origin:${CX}px ${CY + 18}px}
.tw{animation:tw 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.flick{animation:flick .5s steps(1) infinite}
.flick.b{animation-delay:-.25s}
.shine{animation:shine 3.2s ease-in infinite}
.hue{animation:hue 5s linear infinite}
@keyframes pop{0%,100%{transform:rotate(-4deg) scale(1)}50%{transform:rotate(4deg) scale(1.06)}}
@keyframes bob{0%,100%{transform:translateY(0) scale(1.06,.94)}50%{transform:translateY(-4px) scale(.96,1.05)}}
@keyframes tw{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(.25) rotate(45deg)}}
@keyframes flick{50%{opacity:0}}
@keyframes shine{0%,60%{transform:translateX(0)}100%{transform:translateX(280px)}}
@keyframes hue{to{filter:hue-rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.pop,.bob,.tw,.flick,.shine,.hue{animation:none}}`;

const polar = (radius, degrees) => {
  const a = (degrees * Math.PI) / 180;
  return `${(CX + radius * Math.sin(a)).toFixed(1)},${(CY - radius * Math.cos(a)).toFixed(1)}`;
};

/** Comic impact burst: spikes alternate between two lengths. */
function burst(spikes, { rotate = 0, long = 54, short = 50, inner = 44.5 } = {}) {
  const points = [];
  for (let i = 0; i < spikes; i++) {
    const step = 360 / spikes;
    points.push(polar(i % 2 ? short : long, rotate + i * step), polar(inner, rotate + (i + 0.5) * step));
  }
  return points.join(" ");
}

/** Manga focus lines: thin wedges pointing at the centre. */
function focusLines(offset) {
  let d = "";
  for (let i = 0; i < 9; i++) {
    const angle = offset + i * 40 + (i % 3) * 6;
    d += `M${polar(36, angle - 2.6)}L${polar(18 + (i % 4) * 3, angle)}L${polar(36, angle + 2.6)}Z`;
  }
  return d;
}

/** Four-pointed twinkle. */
const sparkle = (x, y, s) =>
  `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`;

/** Five-pointed star. */
function star(x, y, r) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    const radius = i % 2 ? r * 0.45 : r;
    points.push(`${(x + radius * Math.sin(a)).toFixed(1)},${(y - radius * Math.cos(a)).toFixed(1)}`);
  }
  return points.join(" ");
}

// [x, y, size] — the first `tier + 2` are drawn.
const SPARKLES = [
  [17, 24, 8],
  [124, 88, 7],
  [14, 86, 6],
  [128, 112, 5],
  [40, 7, 5],
  [130, 50, 5],
];

/**
 * Medal artwork without the <svg> wrapper, so several can share one document.
 * `uid` keeps ids unique. `center` is the SVG drawn on the face.
 *
 * Drawn like a cartoon sticker: flat colours, hard cel shading, thick ink
 * outlines and a white die-cut border so it reads on any background.
 * Higher tiers pile on more: gloss sweep, emphasis marks, a second burst,
 * colour cycling.
 */
function medal({ uid, tier, center, label }) {
  const { base, light, dark, disc } = TIERS[tier];
  const unlocked = tier > 0;
  const parts = [];

  const w = Math.max(42, Math.round(textWidth(label, 13)) + 20);
  const left = CX - w / 2;
  const right = CX + w / 2;
  const tails = `M${left + 5} 107h-16l7 9.5-7 9.5h16zM${right - 5} 107h16l-7 9.5 7 9.5h-16z`;
  const band = `<rect x="${left}" y="100" width="${w}" height="23" rx="5"`;
  const border = `fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round"`;

  parts.push(`<defs>
<clipPath id="${uid}c"><circle cx="${CX}" cy="${CY}" r="34"/></clipPath>
<pattern id="${uid}h" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="3" cy="3" r="1.3" fill="${light}"/></pattern>
</defs>`);

  // White die-cut border under everything.
  parts.push(`<circle cx="${CX}" cy="${CY}" r="43" ${border}/><path d="${tails}" ${border}/>${band} ${border}/>`);

  // Impact bursts, popping in and out.
  if (unlocked) {
    const spikes = 8 + tier * 2;
    const hue = tier >= 4 ? " hue" : "";
    if (tier >= 3) {
      const accent = tier >= 4 ? "#ff7ad9" : light;
      // A bigger one behind, offset by half a spike so it shows between the front spikes.
      const back = burst(spikes, { rotate: 180 / spikes, long: 59, short: 59, inner: 47 });
      parts.push(`<g class="pop b${hue}"><polygon points="${back}" ${border}/><polygon points="${back}" fill="${accent}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></g>`);
    }
    parts.push(`<g class="pop${hue}"><polygon points="${burst(spikes)}" ${border}/><polygon points="${burst(spikes)}" fill="${base}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></g>`);
  }

  // Rim: flat colour, one hard highlight and one hard shadow.
  parts.push(`<circle cx="${CX}" cy="${CY}" r="43" fill="${base}" stroke="${INK}" stroke-width="3"/>
<path d="M${polar(39, 205)}A39 39 0 0 1 ${polar(39, 300)}" fill="none" stroke="${light}" stroke-width="4.5" stroke-linecap="round"/>
<path d="M${polar(39, 320)}A39 39 0 0 1 ${polar(39, 335)}" fill="none" stroke="${light}" stroke-width="4.5" stroke-linecap="round"/>
<path d="M${polar(39, 40)}A39 39 0 0 1 ${polar(39, 150)}" fill="none" stroke="${dark}" stroke-width="4.5" stroke-linecap="round"/>`);

  // Face: cel-shaded disc with halftone dots and flickering focus lines.
  parts.push(`<circle cx="${CX}" cy="${CY}" r="34" fill="${disc}"/>
<g clip-path="url(#${uid}c)">
<circle cx="${CX}" cy="${CY}" r="34" fill="${INK}" fill-opacity=".45"/>
<circle cx="${CX - 5}" cy="${CY - 6}" r="34" fill="${disc}"/>
<circle cx="${CX}" cy="${CY}" r="34" fill="url(#${uid}h)" fill-opacity=".22"/>
${unlocked ? `<path class="flick" d="${focusLines(0)}" fill="#fff" fill-opacity=".3"/><path class="flick b" d="${focusLines(20)}" fill="${light}" fill-opacity=".3"/>` : ""}
</g>
<circle cx="${CX}" cy="${CY}" r="34" fill="none" stroke="${INK}" stroke-width="3"/>`);

  // Tier pips: stars across the top of the face.
  for (let i = 0; i < tier; i++) {
    const x = CX + (i - (tier - 1) / 2) * 10;
    parts.push(`<polygon points="${star(x, CY - 24.5, 4.6)}" fill="#ffe14d" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`);
  }

  parts.push(unlocked ? `<g class="bob">${center}</g>` : center);

  // Anime gloss: two hard white blobs, plus a sweeping band from silver up.
  parts.push(`<ellipse cx="${CX - 21}" cy="${CY - 15}" rx="8" ry="3.6" transform="rotate(-48 ${CX - 21} ${CY - 15})" fill="#fff" fill-opacity="${unlocked ? 0.9 : 0.5}"/>
<circle cx="${CX - 26}" cy="${CY - 4}" r="2" fill="#fff" fill-opacity="${unlocked ? 0.9 : 0.5}"/>`);
  if (tier >= 2) {
    parts.push(`<g clip-path="url(#${uid}c)"><g class="shine"><path d="M-70 ${CY + 60}l40-120h18l-40 120zM-38 ${CY + 60}l40-120h6l-40 120z" fill="#fff" fill-opacity=".5"/></g></g>`);
  }

  // Ribbon.
  parts.push(`<path d="${tails}" fill="${dark}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
${band} fill="${base}" stroke="${INK}" stroke-width="2.5"/>
<path d="M${left + 5} 104.5h${w - 10}" stroke="${light}" stroke-width="3" stroke-linecap="round"/>
<text x="${CX}" y="117" text-anchor="middle" font-family='${FONT}' font-size="13" font-weight="800" fill="${INK}">${escapeXml(label)}</text>`);

  // Emphasis marks, blinking (silver and up).
  if (tier >= 2) {
    const marks = [28, 40, 52].map((a) => `M${polar(61, a)}L${polar(a === 40 ? 70 : 67, a)}`).join("");
    parts.push(`<g class="flick"><path d="${marks}" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/><path d="${marks}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>`);
  }

  // Twinkles on top of everything.
  if (unlocked) {
    SPARKLES.slice(0, tier + 2).forEach(([x, y, size], i) => {
      parts.push(`<path class="tw" style="animation-delay:${-i * 0.4}s" d="${sparkle(x, y, size)}" fill="${i % 2 ? "#ffe14d" : "#fff"}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`);
    });
  }

  return parts.join("\n");
}

function achievementMedal(a, uid) {
  const at = { x: CX - 18, y: CY - 13, size: 36 };
  return medal({
    uid,
    tier: a.tier,
    // Sticker-style icon: white line on a thick ink outline.
    center:
      icon(a.icon, { ...at, stroke: INK, strokeWidth: 6.5, opacity: a.tier ? 1 : 0.6 }) +
      icon(a.icon, { ...at, stroke: a.tier ? "#fff" : TIERS[0].light, strokeWidth: 2.6 }),
    label: a.tier ? formatCount(a.value) : `${formatCount(a.value)}/${formatCount(a.next)}`,
  });
}

function standalone(label, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${MEDAL_WIDTH}" height="${MEDAL_HEIGHT}" viewBox="0 0 ${MEDAL_WIDTH} ${MEDAL_HEIGHT}" role="img" aria-label="${escapeXml(label)}">
<title>${escapeXml(label)}</title>
<style>
${MEDAL_CSS}
</style>
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
        center: `<text x="${CX}" y="${CY + 16}" text-anchor="middle" font-family='${FONT}' font-size="30" font-weight="800" fill="#fff" stroke="${INK}" stroke-width="6.5" stroke-linejoin="round" paint-order="stroke">${rank.level}</text>`,
        label: top,
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
  const cellHeight = 132;
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
<text class="name" x="${mid}" y="109" text-anchor="middle">${escapeXml(a.name)}</text>
<text class="tier" x="${mid}" y="124" text-anchor="middle">${status}</text>
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
${MEDAL_CSS}
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
