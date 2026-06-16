import type { Round, RoundHole, Shot, LossCategory, ScoreStats, PracticeItem } from '../types';

const MISS_RESULTS = new Set(['右', '左', 'ショート', 'オーバー', 'トップ', 'ハーフトップ', 'チョロ', 'ダフリ', 'ざっくり', '当たりそこない', 'あまり飛ばない', 'シャンク', 'OB', 'ペナルティ', 'ホームラン', '1回で出ない']);

const WOOD_CLUBS = new Set(['1w', '3w', '7w', '5u']);
const LONG_IRON_CLUBS = new Set(['6i', '7i']);
const SHORT_IRON_CLUBS = new Set(['8i', '9i']);
const WEDGE_CLUBS = new Set(['pw', '48', '52', '58']);

// 85打を目標とするプレイヤーが各クラブで出すべき想定キャリー距離(y)。
// この85%未満しか出なかったショットは「距離不足」として扱う。
const CLUB_EXPECTED_DISTANCE: Record<string, number> = {
  '1w': 200, '3w': 180, '7w': 160, '5u': 150,
  '6i': 140, '7i': 130, '8i': 120, '9i': 110,
  'pw': 95, '48': 80, '52': 60, '58': 40,
};

function hasResult(shot: Shot, ...vals: string[]) {
  return shot.results?.some(r => vals.includes(r)) ?? false;
}
function hasType(shot: Shot, ...types: string[]) {
  return shot.shotTypes?.some(t => types.includes(t)) ?? false;
}
function hasLie(shot: Shot, ...lies: string[]) {
  return shot.lies?.some(l => lies.includes(l)) ?? false;
}
function isObPenaltyShot(shot: Shot) {
  return hasResult(shot, 'OB', 'ペナルティ') || (shot.penalty ?? 0) > 0;
}
function isDistanceShortfall(shot: Shot) {
  const exp = CLUB_EXPECTED_DISTANCE[shot.clubId ?? ''];
  return exp != null && (shot.distance ?? 0) > 0 && (shot.distance as number) <= exp * 0.85;
}

type ShotCategoryDef = {
  key: string;
  label: string;
  // 1回あたりの推定ロス打数。「スコア85を目指すなら、このミスは1回起きると
  // 何打分のリカバリーが必要になるか」を基準に見積もった値（経験的な仮定値）。
  lossPerCount: number;
  match: (shot: Shot) => boolean;
};

const SHOT_CATEGORIES: ShotCategoryDef[] = [
  {
    // 2y以内のショートパットを外すと、ほぼ確実に+1打。
    key: 'short_putt', label: 'ショートパットミス', lossPerCount: 1.0,
    match: shot => hasType(shot, 'putt') && (shot.distance ?? 0) <= 2 && hasResult(shot, 'ショート', '右', '左'),
  },
  {
    // バンカーで1回で出られないと、ほぼそのまま+1打。
    key: 'bunker', label: 'バンカー失点', lossPerCount: 1.0,
    match: shot => hasType(shot, 'bunker') && hasResult(shot, '1回で出ない', 'ホームラン', 'オーバー'),
  },
  {
    // アプローチでチョロ・トップ・ダフリ・ざっくり = ショットが機能せず実質+1打。
    key: 'approach_contact', label: 'アプローチコンタクトミス', lossPerCount: 1.0,
    match: shot => hasType(shot, 'approach') && hasResult(shot, 'チョロ', 'トップ', 'ダフリ', 'ざっくり'),
  },
  {
    // ロングアイアンは距離があるため方向ミスでグリーンを大きく外しやすい。
    key: 'iron_dir_long', label: 'ロングアイアン方向ミス(6-7i)', lossPerCount: 0.7,
    match: shot => LONG_IRON_CLUBS.has(shot.clubId ?? '') &&
      (['右', '左', '右ペラ'].includes(shot.direction ?? '') || hasResult(shot, '引っかけ', '捕まらず右')),
  },
  {
    // 傾斜・悪いライからのミスは追加のリカバリーが必要になりやすい。
    key: 'slope', label: '傾斜・ライ対応', lossPerCount: 0.5,
    match: shot => hasLie(shot, '左足上がり', '左足下がり', 'つま先上がり', 'つま先下がり', 'ラフ') &&
      (shot.results?.some(r => MISS_RESULTS.has(r)) ?? false),
  },
  {
    // ショートアイアンは距離が短く方向ミスの影響もやや小さい。
    key: 'iron_dir_short', label: 'ショートアイアン方向ミス(8-9i)', lossPerCount: 0.5,
    match: shot => SHORT_IRON_CLUBS.has(shot.clubId ?? '') &&
      (['右', '左', '右ペラ'].includes(shot.direction ?? '') || hasResult(shot, '引っかけ', '捕まらず右')),
  },
  {
    // コントロールショットの距離ミス(寄せ切れない)はグリーンを外す程度の影響。
    key: 'half_miss', label: 'コントロールショット距離ミス', lossPerCount: 0.5,
    match: shot => hasType(shot, 'half') && hasResult(shot, 'ショート', 'オーバー', 'トップ', 'ダフリ'),
  },
  {
    // コンタクトは悪くないがオーバー・ショートのみ = ピンに寄らない程度の影響。
    key: 'approach_distance', label: 'アプローチ距離感', lossPerCount: 0.5,
    match: shot => hasType(shot, 'approach') &&
      !hasResult(shot, 'チョロ', 'トップ', 'ダフリ', 'ざっくり') &&
      hasResult(shot, 'オーバー', 'ショート'),
  },
  {
    // 7W/5Uのフルショットミスはフェアウェイを外す程度の影響。
    key: 'wood_miss', label: '7W/5Uフルショットミス', lossPerCount: 0.5,
    match: shot => ['7w', '5u'].includes(shot.clubId ?? '') &&
      hasType(shot, 'full') && hasResult(shot, 'チョロ', 'トップ', '右', '左', 'ダフリ'),
  },
  {
    // ウッドで想定距離の85%未満 = フェアウェイで大幅にショートし次打の難易度が上がる。
    key: 'distance_shortfall_wood', label: '距離不足（ウッド）', lossPerCount: 0.5,
    match: shot => isDistanceShortfall(shot) && WOOD_CLUBS.has(shot.clubId ?? ''),
  },
  {
    // ロングアイアンで想定距離の85%未満。
    key: 'distance_shortfall_iron_long', label: '距離不足（ロングアイアン6-7i）', lossPerCount: 0.5,
    match: shot => isDistanceShortfall(shot) && LONG_IRON_CLUBS.has(shot.clubId ?? ''),
  },
  {
    // ショートアイアンで想定距離の85%未満。
    key: 'distance_shortfall_iron_short', label: '距離不足（ショートアイアン8-9i）', lossPerCount: 0.5,
    match: shot => isDistanceShortfall(shot) && SHORT_IRON_CLUBS.has(shot.clubId ?? ''),
  },
  {
    // ウェッジで想定距離の85%未満。
    key: 'distance_shortfall_wedge', label: '距離不足（ウェッジPW以下）', lossPerCount: 0.5,
    match: shot => isDistanceShortfall(shot) && WEDGE_CLUBS.has(shot.clubId ?? ''),
  },
  {
    // ウェッジは距離が短くリカバリーしやすいため影響は小さい。
    key: 'iron_dir_wedge', label: 'ウェッジ方向ミス(PW以下)', lossPerCount: 0.3,
    match: shot => WEDGE_CLUBS.has(shot.clubId ?? '') &&
      (['右', '左', '右ペラ'].includes(shot.direction ?? '') || hasResult(shot, '引っかけ', '捕まらず右')),
  },
];

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

// mece=true: 1ショットにつき最も影響の大きいカテゴリ1つだけをカウント（スコアロス推定用、合計が実際の打数差に近くなるように）
// mece=false: 該当する全カテゴリを重複カウント（個人のミス傾向集計用、練習対象の特定やミスの推移確認に使う）
function buildLossList(holes: RoundHole[], mece: boolean): LossCategory[] {
  const entries: { shot: Shot; hole: RoundHole }[] = holes.flatMap(hole => hole.shots.map(shot => ({ shot, hole })));

  const obPenaltyCount = holes.reduce((s, h) => s + (h.ob ?? 0) + (h.penalty ?? 0), 0);
  const threePuttCount = holes.filter(h => (h.putts ?? 0) >= 3).length;

  const shotCounts = new Map<string, number>();
  for (const { shot } of entries) {
    if (mece) {
      if (isObPenaltyShot(shot)) continue; // OB・ペナルティ側で既にカウント済み
      const matches = SHOT_CATEGORIES.filter(c => c.match(shot));
      if (matches.length === 0) continue;
      const best = matches.reduce((a, b) => (b.lossPerCount > a.lossPerCount ? b : a));
      shotCounts.set(best.key, (shotCounts.get(best.key) ?? 0) + 1);
    } else {
      for (const c of SHOT_CATEGORIES) {
        if (c.match(shot)) shotCounts.set(c.key, (shotCounts.get(c.key) ?? 0) + 1);
      }
    }
  }

  const raw: Array<{ key: string; label: string; count: number; lossPerCount: number }> = [
    { key: 'ob_penalty', label: 'OB・ペナルティ', count: obPenaltyCount, lossPerCount: 2.0 },
    { key: 'three_putt', label: '3パット', count: threePuttCount, lossPerCount: 1.0 },
    ...SHOT_CATEGORIES.map(c => ({ key: c.key, label: c.label, count: shotCounts.get(c.key) ?? 0, lossPerCount: c.lossPerCount })),
  ];

  return raw
    .map(r => ({ ...r, estimatedLoss: Math.round(r.count * r.lossPerCount * 10) / 10 }))
    .sort((a, b) => b.estimatedLoss - a.estimatedLoss);
}

/** スコアロス推定用（MECE: 1ショット=1カテゴリのみ）。「改善ポイント」「失点ランキング」等の打数表示に使う。 */
export function calcLossesFromHoles(holes: RoundHole[]): LossCategory[] {
  return buildLossList(holes, true);
}

export function calcLosses(rounds: Round[]): LossCategory[] {
  return calcLossesFromHoles(rounds.flatMap(r => r.holes));
}

/** 個人のミス傾向集計用（重複カウントあり）。練習メニューの選定やミスの推移確認に使う。 */
export function calcMissTendenciesFromHoles(holes: RoundHole[]): LossCategory[] {
  return buildLossList(holes, false);
}

export function calcMissTendencies(rounds: Round[]): LossCategory[] {
  return calcMissTendenciesFromHoles(rounds.flatMap(r => r.holes));
}

/** ラウンドごとのミス傾向（回数）の推移。最近のラウンドでミスが減っているかを確認するために使う。 */
export function calcMissTrend(rounds: Round[]): Array<Record<string, number | string>> {
  const sorted = rounds.slice().sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map(r => {
    const tendencies = calcMissTendenciesFromHoles(r.holes);
    const row: Record<string, number | string> = { date: r.date.slice(5), roundId: r.id };
    for (const t of tendencies) row[t.key] = t.count;
    return row;
  });
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
    approach_contact: {
      category: 'アプローチ コンタクト',
      reason: 'アプローチのチョロ・トップ・ダフリ・ざっくりが多いです',
      content: 'チップショットのコンタクト改善練習',
      checklist: ['ハンドファーストのアドレス確認', '体重を左足に乗せたままインパクト', 'ターフを取るドリル20球'],
    },
    approach_distance: {
      category: 'アプローチ 距離感',
      reason: 'アプローチのオーバー・ショートが多いです（コンタクトは悪くない）',
      content: '10y/20y/30yの距離打ち分け練習',
      checklist: ['同じスイングでボール位置だけ変えて距離を打ち分ける', '10球ごとに着地点を確認', 'ピン近辺3m以内を目標にする'],
    },
    wood_miss: {
      category: '7W/5Uフルショット',
      reason: '7W・5Uのフルショットでミスが出ています',
      content: '5U/7Wの直打ちミート率向上練習',
      checklist: ['ティーアップして正しいソールを確認', 'スイング軌道をインサイドアウトに意識', 'ハーフショットから始めてフルに戻す'],
    },
    iron_dir_long: {
      category: 'ロングアイアン方向(6-7i)',
      reason: '6i・7iの方向性にばらつきがあります',
      content: 'ロングアイアンの方向性改善・フェース管理練習',
      checklist: ['フェースの向きを確認してアドレス', 'グリップ・肘の形を鏡でチェック', '7iで10球連続コースセンターを狙う'],
    },
    iron_dir_short: {
      category: 'ショートアイアン方向(8-9i)',
      reason: '8i・9iの方向性にばらつきがあります',
      content: 'ショートアイアンの方向性改善練習',
      checklist: ['フェースの向きを確認してアドレス', 'スタンス・アライメントをクラブで確認', '9iで10球連続コースセンターを狙う'],
    },
    iron_dir_wedge: {
      category: 'ウェッジ方向(PW以下)',
      reason: 'PW以下の方向性にばらつきがあります',
      content: 'ウェッジの方向性改善練習',
      checklist: ['フェースの向きを確認してアドレス', '小さい振り幅でも再現性を意識', 'PWで10球連続コースセンターを狙う'],
    },
    distance_shortfall_wood: {
      category: '距離不足（ウッド）',
      reason: 'ウッドで想定距離の85%未満しか出ていないショットが多いです',
      content: 'ウッドのミート率・最大距離確認練習',
      checklist: ['各ウッド10球打って平均キャリーを計測', 'ミート率(芯を外していないか)を確認', '無理に距離を出そうとせず80%スイングの距離も把握'],
    },
    distance_shortfall_iron_long: {
      category: '距離不足（ロングアイアン6-7i）',
      reason: '6i・7iで想定距離の85%未満しか出ていないショットが多いです',
      content: 'ロングアイアンのミート率・最大距離確認練習',
      checklist: ['6i・7iで10球打って平均キャリーを計測', 'ミート率(芯を外していないか)を確認', '無理に距離を出そうとせず80%スイングの距離も把握'],
    },
    distance_shortfall_iron_short: {
      category: '距離不足（ショートアイアン8-9i）',
      reason: '8i・9iで想定距離の85%未満しか出ていないショットが多いです',
      content: 'ショートアイアンのミート率・最大距離確認練習',
      checklist: ['8i・9iで10球打って平均キャリーを計測', 'ミート率(芯を外していないか)を確認', '無理に距離を出そうとせず80%スイングの距離も把握'],
    },
    distance_shortfall_wedge: {
      category: '距離不足（ウェッジPW以下）',
      reason: 'PW以下で想定距離の85%未満しか出ていないショットが多いです',
      content: 'ウェッジのミート率・最大距離確認練習',
      checklist: ['各ウェッジ10球打って平均キャリーを計測', 'ミート率(芯を外していないか)を確認', '無理に距離を出そうとせず80%スイングの距離も把握'],
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

export type ClubStat = {
  clubId: string;
  total: number;
  souhyoTotal: number; // 総評が記録されたショット数 (denominator for 100%)
  niceCount: number;
  okCount: number;
  yamamisuCount: number;
  misuCount: number;
};

const SOUHYO_SET = new Set(['ナイス', 'OK', '普通', 'ややミス', 'ミス']);

export function calcClubStats(rounds: Round[]): ClubStat[] {
  const map = new Map<string, Omit<ClubStat, 'clubId'>>();
  for (const round of rounds) {
    for (const hole of round.holes) {
      for (const shot of hole.shots) {
        if (!shot.clubId) continue;
        const cur = map.get(shot.clubId) ?? { total: 0, souhyoTotal: 0, niceCount: 0, okCount: 0, yamamisuCount: 0, misuCount: 0 };
        cur.total++;
        const rs = shot.results ?? [];
        const souhyo = rs.find(r => SOUHYO_SET.has(r));
        if (souhyo) {
          cur.souhyoTotal++;
          if (souhyo === 'ナイス') cur.niceCount++;
          else if (souhyo === 'OK' || souhyo === '普通') cur.okCount++;
          else if (souhyo === 'ややミス') cur.yamamisuCount++;
          else if (souhyo === 'ミス') cur.misuCount++;
        }
        map.set(shot.clubId, cur);
      }
    }
  }
  return Array.from(map.entries())
    .map(([clubId, v]) => ({ clubId, ...v }))
    .sort((a, b) => b.total - a.total);
}
