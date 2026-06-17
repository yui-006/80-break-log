/**
 * SG (Strokes Gained) Loss Attribution — §6 of design spec.
 * Estimates per-round loss vs benchmark for 4 categories.
 * This is an approximation, not true SG (no per-shot positioning data).
 */
import type { Round } from '../../types';
import { m9FairwayHit } from './index';
import { calcScoreStats } from '../../analytics';

type BenchKey = '100' | '95' | '90' | '85' | '80';

export const GOAL_STEPS = [100, 95, 90, 85, 80] as const;
export type GoalThreshold = (typeof GOAL_STEPS)[number];

const BENCHMARKS: Record<BenchKey, {
  avgScore: number; parOnRate: number; fwRate: number;
  threePuttPerRound: number; parSaveRate: number; penaltyPerRound: number;
}> = {
  '100': { avgScore: 100, parOnRate: 0.19, fwRate: 0.43, threePuttPerRound: 4.5, parSaveRate: 0.20, penaltyPerRound: 3.5 },
  '95':  { avgScore: 95,  parOnRate: 0.22, fwRate: 0.43, threePuttPerRound: 3.5, parSaveRate: 0.22, penaltyPerRound: 2.8 },
  '90':  { avgScore: 90,  parOnRate: 0.26, fwRate: 0.47, threePuttPerRound: 3.0, parSaveRate: 0.25, penaltyPerRound: 2.3 },
  '85':  { avgScore: 85,  parOnRate: 0.33, fwRate: 0.49, threePuttPerRound: 2.5, parSaveRate: 0.30, penaltyPerRound: 1.8 },
  '80':  { avgScore: 80,  parOnRate: 0.41, fwRate: 0.50, threePuttPerRound: 2.0, parSaveRate: 0.34, penaltyPerRound: 1.3 },
};

const COST = {
  perMissedGreen: 0.5,
  perFailedParSave: 1.0,
  perThreePutt: 1.0,
  perPenalty: 1.0,
  perMissedFairway: 0.25,
};

export const SG_CAT_LABEL: Record<string, string> = {
  tee: 'ティーショット',
  approach: 'アプローチ',
  shortGame: 'ショートゲーム',
  putting: 'パッティング',
};

export type SGAttribution = {
  tee: number;
  approach: number;
  shortGame: number;
  putting: number;
  benchKey: BenchKey;
  goalThreshold: number;
  roundsUsed: number;
  allNegative: boolean;
};

function benchKeyFromGoal(goal: number): BenchKey {
  // Use the benchmark one step above current goal
  if (goal >= 100) return '100';
  if (goal >= 95)  return '95';
  if (goal >= 90)  return '90';
  if (goal >= 85)  return '85';
  return '80';
}

export function computeSGAttribution(rounds: Round[], goalThreshold = 95): SGAttribution | null {
  if (rounds.length < 3) return null;

  const benchKey = benchKeyFromGoal(goalThreshold);
  const bench = BENCHMARKS[benchKey];
  const n = rounds.length;

  let sumScore = 0;
  let sumThreePutt = 0;
  let sumPuttsHoles = 0;
  let sumPenalty = 0;
  let sumParOn = 0;
  let sumParOnHoles = 0;
  let sumNonParOn = 0;
  let sumParSaved = 0;
  let sumFwHit = 0;
  let sumFwN = 0;
  let sumPar45 = 0;

  for (const r of rounds) {
    const st = calcScoreStats(r.holes);
    sumScore += st.totalScore;
    sumPenalty += st.totalOB + st.totalPenalty;

    for (const h of r.holes) {
      if (h.par >= 4) sumPar45++;
      if (h.score == null || h.putts == null) continue;
      sumPuttsHoles++;
      if (h.putts >= 3) sumThreePutt++;
      const girHit = (h.score - h.putts) <= h.par - 2;
      sumParOnHoles++;
      if (girHit) {
        sumParOn++;
      } else {
        sumNonParOn++;
        if (h.score <= h.par) sumParSaved++;
      }
    }

    const fw = m9FairwayHit(r.holes);
    if (fw) { sumFwHit += fw.hit; sumFwN += fw.n; }
  }

  // Player averages (fall back to benchmark when no data)
  const parOnRate     = sumParOnHoles > 0 ? sumParOn / sumParOnHoles : bench.parOnRate;
  const parSaveRate   = sumNonParOn   > 0 ? sumParSaved / sumNonParOn : bench.parSaveRate;
  const threePuttPerR = n > 0 ? sumThreePutt / n : bench.threePuttPerRound;
  const penaltyPerR   = n > 0 ? sumPenalty / n : bench.penaltyPerRound;
  const fwRate        = sumFwN > 0 ? sumFwHit / sumFwN : null;
  const nonParOnPerR  = sumNonParOn / n;
  const par45PerR     = sumPar45 / n;

  const approachLost  = (bench.parOnRate - parOnRate) * 18 * COST.perMissedGreen;
  const shortGameLost = (bench.parSaveRate - parSaveRate) * nonParOnPerR * COST.perFailedParSave;
  const puttingLost   = (threePuttPerR - bench.threePuttPerRound) * COST.perThreePutt;
  const fwLost        = fwRate != null
    ? Math.max(0, bench.fwRate - fwRate) * par45PerR * COST.perMissedFairway
    : 0;
  const teeLost       = (penaltyPerR - bench.penaltyPerRound) * COST.perPenalty + fwLost;

  const attr: SGAttribution = {
    tee:       Math.round(teeLost       * 10) / 10,
    approach:  Math.round(approachLost  * 10) / 10,
    shortGame: Math.round(shortGameLost * 10) / 10,
    putting:   Math.round(puttingLost   * 10) / 10,
    benchKey,
    goalThreshold,
    roundsUsed: n,
    allNegative: false,
  };

  attr.allNegative = attr.tee <= 0 && attr.approach <= 0 && attr.shortGame <= 0 && attr.putting <= 0;

  return attr;
}
