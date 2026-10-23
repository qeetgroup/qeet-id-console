export interface RankCandidate {
  id: string;
  title: string;
  subtitle?: string;
  category?: string;
  keywords?: string[];
  url?: string;
}

export interface RankContext {
  /** Recent item ids; with no query, only recents and favorites are listed. */
  recentIds: ReadonlySet<string>;
  /** Open count per recent id, for the frequency boost. */
  recentAccessCounts: ReadonlyMap<string, number>;
  favoriteIds: ReadonlySet<string>; // Pinned item ids, for the favorites boost
  currentPathname: string; // The current route, for the shared-path-segment boost
}

export interface RankedItem<T extends RankCandidate> {
  item: T;
  score: number; // Composite score ≥ 0. Higher is better
}

/**
 * Scores `query` against `text` from 0 (no match) to 100: exact 100, prefix 90, first-word prefix
 * 80, later-word prefix 70, substring 60, subsequence 1–40 by density, then a typo match 5–30
 * (edit distance ≤ 2) for queries of 3+ characters.
 */
export function scoreText(query: string, text: string): number {
  if (!query || !text) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (t === q) return 100;
  if (t.startsWith(q)) return 90;

  const wb = _wordBoundaryScore(q, t);
  if (wb > 0) return wb;

  if (t.includes(q)) return 60;

  const ss = _subsequenceScore(q, t);
  if (ss > 0) return ss;

  if (q.length >= 3) return _typoTolerantScore(q, t);

  return 0;
}

function _wordBoundaryScore(q: string, t: string): number {
  const words = t.split(/[\s\-_./]+/);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w?.startsWith(q)) return i === 0 ? 80 : 70;
  }
  return 0;
}

function _subsequenceScore(q: string, t: string): number {
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (q[qi] === t[ti]) qi++;
  }
  if (qi < q.length) return 0; // not all chars matched
  const density = q.length / t.length;
  return Math.max(1, Math.round(40 * density));
}

/** Returns the Levenshtein distance between `a` and `b`, using O(n) space. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? (prev[j - 1] as number)
          : 1 + Math.min(prev[j] as number, curr[j - 1] as number, prev[j - 1] as number);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n] as number;
}

function _typoTolerantScore(q: string, t: string): number {
  const maxDist = q.length <= 4 ? 1 : 2;
  for (let i = 0; i <= t.length - q.length; i++) {
    const window = t.slice(i, i + q.length);
    const dist = editDistance(q, window);
    if (dist <= maxDist) return Math.max(5, 30 - dist * 10);
  }
  return 0;
}

/**
 * Scores a candidate by its best field, weighting title 1.0, keywords 0.9, subtitle 0.7 and
 * category 0.5, so a category match can't outrank a strong title match. 0 means no match.
 */
export function score(query: string, candidate: RankCandidate): number {
  if (!query) return 0;

  let best = scoreText(query, candidate.title);

  for (const kw of candidate.keywords ?? []) {
    const s = scoreText(query, kw) * 0.9;
    if (s > best) best = s;
  }

  if (candidate.subtitle) {
    const s = scoreText(query, candidate.subtitle) * 0.7;
    if (s > best) best = s;
  }

  if (candidate.category) {
    const s = scoreText(query, candidate.category) * 0.5;
    if (s > best) best = s;
  }

  return best;
}

/**
 * Ranks candidates best first. With a query only matches are kept; without one, only favorites
 * and recents, from a base score of 50. Favorites get +30, frequently opened items up to +25,
 * and items sharing path segments with the current route +2 per segment.
 */
export function rankItems<T extends RankCandidate>(
  items: T[],
  query: string,
  ctx: RankContext,
): Array<RankedItem<T>> {
  const results: Array<RankedItem<T>> = [];

  for (const item of items) {
    let baseScore: number;

    if (query) {
      baseScore = score(query, item);
      if (baseScore === 0) continue;
    } else {
      const isFav = ctx.favoriteIds.has(item.id);
      const isRecent = ctx.recentIds.has(item.id);
      if (!isFav && !isRecent) continue;
      baseScore = 50;
    }

    if (ctx.favoriteIds.has(item.id)) baseScore += 30;

    const accessCount = ctx.recentAccessCounts.get(item.id) ?? 0;
    if (accessCount > 0) {
      baseScore += Math.min(25, Math.floor(Math.log2(accessCount + 1) * 10));
    }

    if (item.url && ctx.currentPathname) {
      const pathSegs = new Set(ctx.currentPathname.split("/").filter(Boolean));
      const itemSegs = item.url.split("/").filter(Boolean);
      const shared = itemSegs.filter((s) => pathSegs.has(s)).length;
      if (shared > 0) baseScore += shared * 2;
    }

    results.push({ item, score: baseScore });
  }

  return results.sort((a, b) => b.score - a.score);
}
