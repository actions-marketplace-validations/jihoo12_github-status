export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** 987 -> "987", 1234 -> "1.2k", 45678 -> "45.7k", 2500000 -> "2.5M" */
export function formatCount(n) {
  const abs = Math.abs(n);
  if (abs < 1000) return String(n);
  const [div, suffix] = abs < 1_000_000 ? [1000, "k"] : [1_000_000, "M"];
  // Truncate rather than round so 999,950 doesn't become "1000.0k".
  const scaled = Math.trunc((n / div) * 10) / 10;
  return `${scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(1)}${suffix}`;
}

/** "Top 0.4%", "Top 12%" */
export function formatPercentile(p) {
  if (p < 1) return `Top ${Math.max(0.1, Math.ceil(p * 10) / 10).toFixed(1)}%`;
  return `Top ${Math.min(100, Math.ceil(p))}%`;
}

/**
 * Approximate rendered width of text in an 11px Verdana-like sans font.
 * Only needs to be close: SVG `textLength` pins the final width.
 */
export function textWidth(text, fontSize = 11) {
  let width = 0;
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (code > 0x2e7f) width += 11; // CJK / emoji: full width
    else if ("ilj.,:;'|!".includes(ch)) width += 3.3;
    else if ("ftrI()[]- ".includes(ch)) width += 4.6;
    else if ("mwMW%@".includes(ch)) width += 10.4;
    else if (ch >= "A" && ch <= "Z") width += 7.8;
    else if (ch === "+") width += 8.5;
    else width += 6.8;
  }
  return (width * fontSize) / 11;
}
