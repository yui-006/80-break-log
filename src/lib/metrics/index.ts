/**
 * lib/metrics — Single Source of Truth for all 17 metrics (#1–#17).
 * Pages must NOT recompute score/GIR/putts inline — call these functions.
 *
 * Field mapping (actual codebase):
 *   spec shot.types      → shot.shotTypes
 *   spec shot.club       → shot.clubId
 *   spec shot.lie        → shot.lies
 *   spec shot.eval       → shot.results[] (ナイス/OK/ややミス/ミス 抽出)
 *   spec shot.result.direction → shot.direction
 *   spec "control" type  → "half" ShotType
 */
import type { Round, RoundHole } from '../../types';

// ─── Scope ────────────────────────────────────────────────────────────────
export type Scope = 'thisRound' | 'last3' | 'allTime';

export function filterScope(rounds: Round[], scope: Scope): Round[] {
  const done = rounds
    .filter(r => r.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date));
  if (scope === 'thisRound') return done.slice(0, 1);
  if (scope === 'last3')     return done.slice(0, 3);
  return done;
}

export function scopeLabel(scope: Scope): string {
  if (scope === 'thisRound') return 'このR';
  if (scope === 'last3')     return '直近3R';
  return '通算';
}

// ─── Hole-level helpers ───────────────────────────────────────────────────

/** ストロークトゥグリーン = score − putts */
export function strokesToGreen(h: RoundHole): number {
  return (h.score ?? 0) - (h.putts ?? 0);
}

/** GIR: score と putts が両方記録されているホールのみ有効 */
export function isGIR(h: RoundHole): boolean {
  if (h.score == null || h.putts == null) return false;
  return strokesToGreen(h) <= h.par - 2;
}

/** PW以下（ウェッジカテゴリのクラブID）か */
const WEDGE_IDS = new Set(['pw', '48', '52', '58']);
export function isWedgeOrShorter(clubId: string | undefined): boolean {
  return clubId != null && WEDGE_IDS.has(clubId);
}

// ─── Display helpers ──────────────────────────────────────────────────────

/** パー差を "+3" / "E" / "−1" / "−" 形式で返す */
export function fmtParDiff(v: number | null | undefined): string {
  if (v == null) return '−';
  if (v === 0)   return 'E';
  return v > 0 ? `+${v}` : `${v}`;
}

/**
 * 比率を "hit/total (XX%)" 形式で返す。
 * total < minN のとき % は省略（小サンプル抑制）
 */
export function fmtRatio(hit: number, total: number, minN = 3): string {
  if (total === 0) return '−';
  if (total < minN) return `${hit}/${total}`;
  return `${hit}/${total} (${Math.round(hit / total * 100)}%)`;
}

export function fmtNum(v: number | null | undefined, d = 1): string {
  return v == null ? '−' : v.toFixed(d);
}

// ─── #1 合計スコア（前半・後半含む） ─────────────────────────────────────
export type M1 = { total: number; front: number; back: number; par: number } | null;

export function m1Score(holes: RoundHole[]): M1 {
  const s = holes.filter(h => h.score != null);
  if (!s.length) return null;
  return {
    total: s.reduce((a, h) => a + h.score!, 0),
    front: s.filter(h => h.holeNo <= 9).reduce((a, h) => a + h.score!, 0),
    back:  s.filter(h => h.holeNo >= 10).reduce((a, h) => a + h.score!, 0),
    par:   s.reduce((a, h) => a + h.par, 0),
  };
}

// ─── #2 パー差 ────────────────────────────────────────────────────────────
export function m2ParDiff(holes: RoundHole[]): number | null {
  const r = m1Score(holes);
  return r ? r.total - r.par : null;
}

// ─── #3 目標スコア達成率 ──────────────────────────────────────────────────
export type M3 = { hit: number; n: number } | null;

/**
 * 各ラウンドの targetScore、未設定時は defaultThreshold を使用。
 * 判定は score < threshold（スコアが目標を下回ったら達成）。
 */
export function m3TargetRate(rounds: Round[], defaultThreshold = 95): M3 {
  if (!rounds.length) return null;
  const hit = rounds.filter(r => {
    const th    = r.targetScore ?? defaultThreshold;
    const score = m1Score(r.holes)?.total;
    return score != null && score < th;
  }).length;
  return { hit, n: rounds.length };
}

// ─── #4 総パット数 ────────────────────────────────────────────────────────
export function m4Putts(holes: RoundHole[]): number | null {
  const s = holes.filter(h => h.score != null && h.putts != null);
  return s.length ? s.reduce((a, h) => a + h.putts!, 0) : null;
}

// ─── #5 3パット率（= 3パット数 / ホール数） ──────────────────────────────
export type M5 = { count: number; n: number } | null;

export function m5ThreePutt(holes: RoundHole[]): M5 {
  const s = holes.filter(h => h.score != null && h.putts != null);
  return s.length
    ? { count: s.filter(h => h.putts! >= 3).length, n: s.length }
    : null;
}

// ─── #6 GIR平均パット ─────────────────────────────────────────────────────
export function m6GirAvgPutts(holes: RoundHole[]): number | null {
  const g = holes.filter(h => h.score != null && h.putts != null && isGIR(h));
  return g.length ? g.reduce((a, h) => a + h.putts!, 0) / g.length : null;
}

// ─── #7 パーオン率（GIR） ─────────────────────────────────────────────────
export type M7 = { hit: number; n: number } | null;

export function m7GIR(holes: RoundHole[]): M7 {
  const s = holes.filter(h => h.score != null && h.putts != null);
  return s.length ? { hit: s.filter(isGIR).length, n: s.length } : null;
}

// ─── #8 ボギーオン率 ──────────────────────────────────────────────────────
export type M8 = { hit: number; n: number } | null;

export function m8BogeyOn(holes: RoundHole[]): M8 {
  const s = holes.filter(h => h.score != null && h.putts != null);
  return s.length
    ? { hit: s.filter(h => strokesToGreen(h) <= h.par - 1).length, n: s.length }
    : null;
}

// ─── #9 フェアウェイキープ率（ライ入力依存） ─────────────────────────────
export type M9 = { hit: number; n: number; coverage: number } | null;

/**
 * Par4以上のホールの第2打ライが 'FW' または '花道' かを集計。
 * coverage < 0.5 の場合はデータ不足として null を返す。
 */
export function m9FairwayHit(holes: RoundHole[]): M9 {
  const par4plus = holes.filter(h => h.par >= 4 && h.score != null);
  if (!par4plus.length) return null;
  const withLie = par4plus.filter(h => {
    const s2 = h.shots[1];
    return s2?.lies != null && s2.lies.length > 0;
  });
  const coverage = withLie.length / par4plus.length;
  if (coverage < 0.5) return null;
  const hit = withLie.filter(h =>
    h.shots[1]?.lies?.some(l => l === 'FW' || l === '花道')
  ).length;
  return { hit, n: withLie.length, coverage };
}

// ─── #10 パーセーブ率 ─────────────────────────────────────────────────────
export type M10 = { saved: number; n: number } | null;

export function m10ParSave(holes: RoundHole[]): M10 {
  const missed = holes.filter(h => h.score != null && h.putts != null && !isGIR(h));
  return missed.length
    ? { saved: missed.filter(h => h.score! <= h.par).length, n: missed.length }
    : null;
}

// ─── #11 サンドセーブ率（ライ入力依存・任意） ────────────────────────────
export type M11 = { saved: number; n: number } | null;

/** 第2打以降でライに 'バンカー' が含まれるホールを対象とする近似指標 */
export function m11SandSave(holes: RoundHole[]): M11 {
  const b = holes.filter(h =>
    h.score != null &&
    h.shots.some((s, i) => i > 0 && s.lies?.includes('バンカー'))
  );
  return b.length
    ? { saved: b.filter(h => h.score! <= h.par).length, n: b.length }
    : null;
}

// ─── #12 OB数 ─────────────────────────────────────────────────────────────
export function m12OB(holes: RoundHole[]): number {
  return holes.reduce((a, h) => a + (h.ob ?? 0), 0);
}

// ─── #13 ペナルティ数 ─────────────────────────────────────────────────────
export function m13Penalty(holes: RoundHole[]): number {
  return holes.reduce((a, h) => a + (h.penalty ?? 0), 0);
}

// ─── #14 推定ロス（距離不足 PW以下） ─────────────────────────────────────
const WEDGE_EXPECTED: Record<string, number> = { pw: 105, '48': 90, '52': 70, '58': 50 };

/**
 * PW以下クラブのフル/コントロール(half)ショットで
 * 想定距離の85%未満だった回数 × 0.5打 を1ラウンド平均で返す。
 */
export function m14LossDistShort(rounds: Round[]): number {
  if (!rounds.length) return 0;
  let total = 0;
  for (const r of rounds)
    for (const h of r.holes)
      for (const s of h.shots) {
        const exp = WEDGE_EXPECTED[s.clubId ?? ''];
        if (!exp) continue;
        if (!s.shotTypes?.some(t => t === 'full' || t === 'half')) continue;
        if (s.distance == null || s.distance <= 0) continue;
        if (s.distance < exp * 0.85) total += 0.5;
      }
  return Math.round(total / rounds.length * 10) / 10;
}

// ─── #15 推定ロス（方向ミス PW以下） ─────────────────────────────────────
const DIR_MISS = new Set(['右', '左', '右ペラ', 'ひっかけ']);

/**
 * PW以下クラブの方向ミス（direction または results の引っかけ/捕まらず右）
 * × 0.3打 を1ラウンド平均で返す。
 */
export function m15LossDirection(rounds: Round[]): number {
  if (!rounds.length) return 0;
  let total = 0;
  for (const r of rounds)
    for (const h of r.holes)
      for (const s of h.shots) {
        if (!WEDGE_IDS.has(s.clubId ?? '')) continue;
        const dirMiss = s.direction != null && DIR_MISS.has(s.direction);
        const resMiss = s.results?.some(r => r === '引っかけ' || r === '捕まらず右') ?? false;
        if (dirMiss || resMiss) total += 0.3;
      }
  return Math.round(total / rounds.length * 10) / 10;
}

// ─── #16 クラブ別総評（results[] から ナイス/OK/ややミス/ミス を抽出） ───
export type ClubEvalStat = {
  clubId: string;
  total: number;
  evalN: number;     // 総評記録済みショット数（=分母）
  nice: number;
  ok: number;
  slightMiss: number;
  miss: number;
};

const EVAL_MAP: Record<string, keyof Pick<ClubEvalStat, 'nice' | 'ok' | 'slightMiss' | 'miss'>> = {
  'ナイス': 'nice', 'OK': 'ok', '普通': 'ok', 'ややミス': 'slightMiss', 'ミス': 'miss',
};

export function m16ClubEval(rounds: Round[]): ClubEvalStat[] {
  const map = new Map<string, ClubEvalStat>();
  for (const r of rounds)
    for (const h of r.holes)
      for (const s of h.shots) {
        if (!s.clubId) continue;
        const cur = map.get(s.clubId) ?? {
          clubId: s.clubId, total: 0, evalN: 0,
          nice: 0, ok: 0, slightMiss: 0, miss: 0,
        };
        cur.total++;
        const ev = s.results?.find(r => r in EVAL_MAP);
        if (ev) { cur.evalN++; cur[EVAL_MAP[ev]]++; }
        map.set(s.clubId, cur);
      }
  return Array.from(map.values());
}

// ─── #17 クラブ別飛距離（ティー・フルショット） ───────────────────────────
export type ClubDistStat = {
  clubId: string;
  count: number;
  max: number;
  min: number;
  avg: number;
  median: number;
};

export function m17ClubDist(rounds: Round[]): ClubDistStat[] {
  const map = new Map<string, number[]>();
  for (const r of rounds)
    for (const h of r.holes)
      for (const s of h.shots) {
        if (!s.clubId) continue;
        if (!s.shotTypes?.some(t => t === 'tee' || t === 'full')) continue;
        if (s.distance == null || s.distance <= 0) continue;
        const list = map.get(s.clubId) ?? [];
        list.push(s.distance);
        map.set(s.clubId, list);
      }
  return Array.from(map.entries()).map(([clubId, ds]) => {
    const sorted = ds.slice().sort((a, b) => a - b);
    const mid    = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
    return {
      clubId, count: sorted.length,
      max: sorted[sorted.length - 1], min: sorted[0],
      avg: Math.round(sorted.reduce((a, d) => a + d, 0) / sorted.length * 10) / 10,
      median,
    };
  });
}
