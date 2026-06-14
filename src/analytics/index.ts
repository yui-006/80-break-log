import type { Round, RoundHole, Shot, LossCategory, ScoreStats, PracticeItem } from '../types';

const MISS_RESULTS = new Set(['右', '左', 'ショート', 'オーバー', 'トップ', 'ハーフトップ', 'チョロ', 'ダフリ', '当たりそこない', 'あまり飛ばない', 'シャンク', 'OB', 'ペナルティ', 'ホームラン', '1回で出ない']);
const IRON_CLUBS = new Set(['6i', '7i', '8i', '9i', 'pw']);

export function calcScoreStats(holes: RoundHole[]): ScoreStats {
  const scored = holes.filter(h => h.score !== undefined);
  const totalScore = scored.reduce((s, h) => s + (h.score ?? 0), 0);
  const totalPar = scored.reduce((s, h) => s + h.par, 0);
  const totalPutts = scored.reduce((s, h) => s + (h.putts ?? 0), 0);
  const totalOB = scored.reduce((s, h) => s + (h.ob ?? 0), 0);
  const totalPenalty = scored.reduce((s, h) => s + (h.penalty ?? 0), 0);

  const front = scored.filter(h => h.holeNo <= 9);
  const back = scored.filter(h => h.holeNo >= 10);
  const frontScore = front.reduce((s, h) => s + (h.score ?? 0), 0);
  const backScore = back.reduce((s, h) => s + (h.score ?? 0), 0);
  const frontPar = front.reduce((s, h) => s + h.par, 0);
  const backPar = back.reduce((s, h) => s + h.par, 0);

  const avg = (par: number) => {
    const hs = scored.filter(h => h.par === par && h.score !== undefined);
    return hs.length > 0 ? hs.reduce((s, h) => s + (h.score! - h.par), 0) / hs.length : null;
  };

  const threePuttCount = scored.filter(h => (h.putts ?? 0) >= 3).length;
  const doubleBogeysOrWorse = scored.filter(h => (h.score ?? 0) - h.par >= 2).length;

  const bogeyOnHoles = scored.filter(
    h => h.score !== undefined && h.putts !== undefined && (h.score - h.putts) <= h.par - 1
  ).length;
  const parOnHoles = scored.filter(
    h => h.score !== undefined && h.putts !== undefined && (h.score - h.putts) <= h.par - 2
  ).length;

  return {
    totalScore,
    totalPar,
    totalPutts,
    totalOB,
    totalPenalty,
    frontScore,
    backScore,
    frontPar,
    backPar,
    par3Avg: avg(3),
    par4Avg: avg(4),
    par5Avg: avg(5),
    threePuttCount,
    doubleBogeysOrWorse,
    bogeyOnRate: scored.length > 0 ? bogeyOnHoles / scored.length : 0,
    parOnRate: scored.length > 0 ? parOnHoles / scored.length : 0,
  };
}

function allShots(rounds: Round[]): { shot: Shot; hole: RoundHole }[] {
  const result: { shot: Shot; hole: RoundHole }[] = [];
  for (const round of rounds) {
    for (const hole of round.holes) {
      for (const shot of hole.shots) {
        result.push({ shot, hole });
      }
    }
  }
  return result;
}

export function calcLosses(rounds: Round[]): LossCategory[] {
  const entries = allShots(rounds);
  const recentHoles = rounds.flatMap(r => r.holes);

  const hasResult = (shot: Shot, ...vals: string[]) =>
    shot.results?.some(r => vals.includes(r)) ?? false;
  const hasType = (shot: Shot, ...types: string[]) =>
    shot.shotTypes?.some(t => types.includes(t)) ?? false;
  const hasLie = (shot: Shot, ...lies: string[]) =>
    shot.lies?.some(l => lies.includes(l)) ?? false;

  const obPenaltyCount =
    entries.filter(({ shot }) =>
      hasResult(shot, 'OB', 'ペナルティ') || (shot.penalty ?? 0) > 0
    ).length +
    recentHoles.reduce((s, h) => s + (h.ob ?? 0) + (h.penalty ?? 0), 0);

  const threePuttCount = recentHoles.filter(h => (h.putts ?? 0) >= 3).length;

  const halfMissCount = entries.filter(({ shot }) =>
    hasType(shot, 'half') && hasResult(shot, 'ショート', 'オーバー', 'トップ', 'ダフリ')
  ).length;

  const approachMissCount = entries.filter(({ shot }) =>
    hasType(shot, 'approach') && hasResult(shot, 'チョロ', 'トップ', 'ダフリ', 'オーバー', 'ショート')
  ).length;

  const woodMissCount = entries.filter(({ shot }) =>
    ['7w', '5u'].includes(shot.clubId ?? '') &&
    hasType(shot, 'full') &&
    hasResult(shot, 'チョロ', 'トップ', '右', '左', 'ダフリ')
  ).length;

  const ironDirMissCount = entries.filter(({ shot }) =>
    IRON_CLUBS.has(shot.clubId ?? '') &&
    (
      ['右', '左', '右ペラ'].includes(shot.direction ?? '') ||
      hasResult(shot, '引っかけ', '捕まらず右')
    )
  ).length;

  const slopeMissCount = entries.filter(({ shot }) =>
    hasLie(shot, '左足上がり', '左足下がり', 'つま先上がり', 'つま先下がり', 'ラフ') &&
    (shot.results?.some(r => MISS_RESULTS.has(r)) ?? false)
  ).length;

  const bunkerMissCount = entries.filter(({ shot }) =>
    hasType(shot, 'bunker') && hasResult(shot, '1回で出ない', 'ホームラン', 'オーバー')
  ).length;

  const shortPuttMissCount = entries.filter(({ shot }) =>
    hasType(shot, 'putt') && (shot.distance ?? 0) <= 2 && hasResult(shot, 'ショート', '右', '左')
  ).length;

  const raw: Array<{ key: string; label: string; count: number; lossPerCount: number }> = [
    { key: 'ob_penalty',   label: 'OB・ペナルティ',         count: obPenaltyCount,    lossPerCount: 1.5 },
    { key: 'three_putt',   label: '3パット',                 count: threePuttCount,    lossPerCount: 1   },
    { key: 'half_miss',    label: 'ハーフショット距離感',    count: halfMissCount,     lossPerCount: 1   },
    { key: 'approach',     label: 'アプローチコンタクトミス', count: approachMissCount, lossPerCount: 1   },
    { key: 'wood_miss',    label: '7W/5Uフルショットミス',   count: woodMissCount,     lossPerCount: 1   },
    { key: 'iron_dir',     label: 'アイアン方向ミス',        count: ironDirMissCount,  lossPerCount: 0.5 },
    { key: 'slope',        label: '傾斜・ライ対応',          count: slopeMissCount,    lossPerCount: 1   },
    { key: 'bunker',       label: 'バンカー失点',            count: bunkerMissCount,   lossPerCount: 1   },
    { key: 'short_putt',   label: 'ショートパットミス',      count: shortPuttMissCount, lossPerCount: 1  },
  ];

  return raw
    .map(r => ({ ...r, estimatedLoss: Math.round(r.count * r.lossPerCount * 10) / 10 }))
    .sort((a, b) => b.estimatedLoss - a.estimatedLoss);
}

export function generatePracticeMenu(losses: LossCategory[]): PracticeItem[] {
  const PRACTICE_MAP: Record<string, Omit<PracticeItem, 'priority' | 'recentMissCount'>> = {
    ob_penalty: {
      category: 'OB・ペナルティ',
      reason: 'OB・ペナルティが多く大幅に失点しています',
      content: 'OBを避けるティーショットマネジメント練習',
      checklist: ['フェアウェイ中央を狙う意識', 'セカンド地点を想定したクラブ選択', 'ティーアップ位置でリスク回避'],
    },
    three_putt: {
      category: '3パット',
      reason: '3パットが多くパット数を増やしています',
      content: '5m以上のロングパット距離感とショートパット練習',
      checklist: ['3〜5mのパットを30球連続練習', '1〜2mのショートパット確率向上', 'ラインを読む習慣をつける'],
    },
    half_miss: {
      category: 'ハーフショット距離感',
      reason: 'ハーフショットのショート・オーバーが出ています',
      content: '48°で30〜70yの距離感練習',
      checklist: ['30y・50y・70yの打ち分け', 'スイング幅を固定して距離を合わせる', '同じクラブで10球ずつ打って平均距離を確認'],
    },
    approach: {
      category: 'アプローチ',
      reason: 'アプローチのコンタクトミスが多いです',
      content: 'チップショットのコンタクト改善練習',
      checklist: ['ハンドファーストのアドレス確認', '体重を左足に乗せたままインパクト', 'ターフを取るドリル20球'],
    },
    wood_miss: {
      category: '7W/5Uフルショット',
      reason: '7W・5Uのフルショットでミスが出ています',
      content: '5U/7Wの直打ちミート率向上練習',
      checklist: ['ティーアップして正しいソールを確認', 'スイング軌道をインサイドアウトに意識', 'ハーフショットから始めてフルに戻す'],
    },
    iron_dir: {
      category: 'アイアン方向',
      reason: 'アイアンの方向性にばらつきがあります',
      content: 'アイアンの方向性改善・フェース管理練習',
      checklist: ['フェースの向きを確認してアドレス', 'グリップ・肘の形を鏡でチェック', '7iで10球連続コースセンターを狙う'],
    },
    slope: {
      category: '傾斜・ライ対応',
      reason: '傾斜地でのミスが多いです',
      content: '左足上がり・左足下がりの傾斜対応練習',
      checklist: ['傾斜に合わせた重心位置の確認', '左足上がりはロフトが増えることを意識', '傾斜地でのクラブ選択ルール化'],
    },
    bunker: {
      category: 'バンカー',
      reason: 'バンカーで1回で出ないケースがあります',
      content: 'バンカーショット脱出練習',
      checklist: ['オープンスタンス・フェースを開く', 'ボールの2cm手前の砂を取る意識', '10球連続脱出できるまで練習'],
    },
    short_putt: {
      category: 'ショートパット',
      reason: '2m以内のパットを外しています',
      content: '1〜2mのショートパット確率向上',
      checklist: ['ストロークの加速をフォローまで維持', 'ボールから目を離さない', '1mを30球連続成功してから2mへ'],
    },
  };

  return losses
    .filter(l => l.count > 0)
    .slice(0, 6)
    .map((l, i) => ({
      priority: i + 1,
      ...PRACTICE_MAP[l.key],
      recentMissCount: l.count,
    }))
    .filter(Boolean) as PracticeItem[];
}

export function calcClubStats(rounds: Round[]): { clubId: string; total: number; missCount: number }[] {
  const map = new Map<string, { total: number; missCount: number }>();
  for (const round of rounds) {
    for (const hole of round.holes) {
      for (const shot of hole.shots) {
        if (!shot.clubId) continue;
        const cur = map.get(shot.clubId) ?? { total: 0, missCount: 0 };
        cur.total++;
        if (shot.results?.some(r => MISS_RESULTS.has(r))) cur.missCount++;
        map.set(shot.clubId, cur);
      }
    }
  }
  return Array.from(map.entries())
    .map(([clubId, v]) => ({ clubId, ...v }))
    .sort((a, b) => b.total - a.total);
}
