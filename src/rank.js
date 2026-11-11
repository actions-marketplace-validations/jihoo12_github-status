// Rank = weighted percentile over several activity metrics.
// Same scoring model as anuraghazra/github-readme-stats: each metric is
// normalised against a "median" value with a CDF, then weighted.

const METRICS = [
  { key: "commits", median: 1000, weight: 2, cdf: exponentialCdf },
  { key: "prs", median: 50, weight: 3, cdf: exponentialCdf },
  { key: "issues", median: 25, weight: 1, cdf: exponentialCdf },
  { key: "reviews", median: 2, weight: 1, cdf: exponentialCdf },
  { key: "stars", median: 50, weight: 4, cdf: logNormalCdf },
  { key: "followers", median: 10, weight: 1, cdf: logNormalCdf },
];

// Upper bound (percentile, lower is better) for each level.
const LEVELS = [
  [1, "S"],
  [12.5, "A+"],
  [25, "A"],
  [37.5, "A-"],
  [50, "B+"],
  [62.5, "B"],
  [75, "B-"],
  [87.5, "C+"],
  [100, "C"],
];

function exponentialCdf(x) {
  return 1 - 2 ** -x;
}

function logNormalCdf(x) {
  return x / (1 + x);
}

/**
 * @param {Record<string, number>} stats
 * @returns {{ level: string, percentile: number, score: number, metrics: Record<string, number> }}
 *   percentile: 0–100, "top N%" (lower is better). score: 0–100 (higher is better).
 *   metrics: each metric's own 0–1 score, before weighting.
 */
export function calculateRank(stats) {
  let total = 0;
  let weights = 0;
  const metrics = {};
  for (const { key, median, weight, cdf } of METRICS) {
    const value = Math.max(0, Number(stats[key]) || 0);
    metrics[key] = cdf(value / median);
    total += weight * metrics[key];
    weights += weight;
  }
  const percentile = (1 - total / weights) * 100;
  const level = LEVELS.find(([max]) => percentile <= max)[1];
  return { level, percentile, score: 100 - percentile, metrics };
}
