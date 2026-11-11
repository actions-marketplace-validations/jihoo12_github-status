import { icon } from "./icons.js";
import { FONT, themeCss } from "./theme.js";
import { escapeXml, formatCount, formatPercentile } from "./util.js";

// The six metrics that feed the rank; each row's bar is that metric's score.
const ROWS = [
  ["stars", "star", "Stars"],
  ["commits", "commit", "Commits"],
  ["prs", "pr", "Pull Requests"],
  ["issues", "issue", "Issues"],
  ["reviews", "review", "Reviews"],
  ["followers", "followers", "Followers"],
];

const plural = (n, one, many) => `${formatCount(n)} ${n === 1 ? one : many}`;

/**
 * @param {object} stats  see fetchStats()
 * @param {ReturnType<import("./rank.js").calculateRank>} rank
 * @param {{theme?: "auto" | "light" | "dark"}} [options]
 */
export function renderCard(stats, rank, { theme = "auto" } = {}) {
  const width = 495;
  const height = 262;
  const title = stats.name || stats.login;
  const subtitle = stats.name ? `@${stats.login} · GitHub Stats` : "GitHub Stats";

  const barX = 226;
  const barLen = 80;
  const rows = ROWS.map(([key, iconName, label], i) => {
    const y = 98 + i * 25;
    const by = y - 4.5;
    const filled = (barLen * rank.metrics[key]).toFixed(1);
    return `<g class="row" style="animation-delay:${i * 90}ms">
${icon(iconName, { x: 24, y: y - 12, size: 15, stroke: "var(--a1)" })}
<text class="label" x="48" y="${y}">${label}</text>
<text class="value" x="212" y="${y}" text-anchor="end">${formatCount(stats[key])}</text>
<line x1="${barX}" y1="${by}" x2="${barX + barLen}" y2="${by}" stroke="var(--track)" stroke-width="6" stroke-linecap="round"/>
<line class="bar" x1="${barX}" y1="${by}" x2="${barX + Number(filled)}" y2="${by}" stroke="url(#bar)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${filled}" style="--len:${filled};animation-delay:${i * 90 + 200}ms"/>
</g>`;
  }).join("\n");

  const cx = 400;
  const cy = 150;
  const r = 50;
  const circumference = 2 * Math.PI * r;
  const offset = (circumference * (100 - rank.score)) / 100;
  const top = formatPercentile(rank.percentile);
  const footer = [
    plural(stats.repos, "repo", "repos"),
    `contributed to ${formatCount(stats.contributedTo)}`,
    plural(stats.forks, "fork", "forks"),
  ].join("  ·  ");
  const desc = `${ROWS.map(([key, , label]) => `${label}: ${stats[key]}`).join(", ")}, Rank: ${rank.level} (${top})`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t d">
<title id="t">${escapeXml(`${title} — GitHub Stats`)}</title>
<desc id="d">${escapeXml(desc)}</desc>
<style>
${themeCss(theme)}
text{font-family:${FONT}}
.title{font-size:20px;font-weight:700;fill:var(--text)}
.sub{font-size:12px;fill:var(--muted)}
.label{font-size:13px;fill:var(--muted)}
.value{font-size:13px;font-weight:600;fill:var(--text)}
.level{font-size:34px;font-weight:800;fill:var(--text)}
.top{font-size:11px;font-weight:600;letter-spacing:.08em;fill:var(--muted)}
.foot{font-size:11px;fill:var(--muted)}
.a1{stop-color:var(--a1)}.a2{stop-color:var(--a2)}
.row{animation:in .5s ease-out both}
.bar{animation:draw .8s ease-out both}
.ring{animation:ring 1.2s ease-out both}
@keyframes in{from{opacity:0;transform:translateX(-8px)}}
@keyframes draw{from{stroke-dashoffset:var(--len)}}
@keyframes ring{from{stroke-dashoffset:${circumference.toFixed(2)}}}
@media(prefers-reduced-motion:reduce){.row,.bar,.ring{animation:none}}
</style>
<defs>
<clipPath id="clip"><rect width="${width}" height="${height}" rx="10"/></clipPath>
<linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="a1"/><stop offset="1" class="a2"/></linearGradient>
<linearGradient id="bar" gradientUnits="userSpaceOnUse" x1="${barX}" y1="0" x2="${barX + barLen}" y2="0"><stop offset="0" class="a1"/><stop offset="1" class="a2"/></linearGradient>
<radialGradient id="glow"><stop offset="0" class="a2" stop-opacity=".2"/><stop offset="1" class="a2" stop-opacity="0"/></radialGradient>
</defs>
<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="10" fill="var(--bg)" stroke="var(--border)"/>
<g clip-path="url(#clip)">
<circle cx="${cx}" cy="${cy}" r="170" fill="url(#glow)"/>
<rect width="${width}" height="4" fill="url(#acc)"/>
</g>
<text class="title" x="24" y="44">${escapeXml(title)}</text>
<text class="sub" x="24" y="64">${escapeXml(subtitle)}</text>
${rows}
<text class="foot" x="24" y="244">${escapeXml(footer)}</text>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--track)" stroke-width="9"/>
<circle class="ring" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#acc)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>
<text class="level" x="${cx}" y="${cy + 6}" text-anchor="middle">${rank.level}</text>
<text class="top" x="${cx}" y="${cy + 26}" text-anchor="middle">${top.toUpperCase()}</text>
</svg>
`;
}
