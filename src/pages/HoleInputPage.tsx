import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { RoundHole, Shot, ShotType } from '../types';
import { Counter } from '../components/ui/Counter';
import { SelectButtons } from '../components/ui/SelectButtons';
import { Modal } from '../components/ui/Modal';
import {
  RESULT_CATEGORIES,
  SHOT_TYPE_LABELS, INITIAL_CLUBS, CLUB_ORDER,
} from '../data/initial';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, TableProperties } from 'lucide-react';

function genId() { return crypto.randomUUID(); }
function nowStr() { return new Date().toISOString(); }

// ── 総評オプション (単一選択) ────────────────────────────────
const SOUHYO_OPTS = ['ナイス', 'OK', 'ややミス', 'ミス'];
const DETAIL_CATEGORIES = RESULT_CATEGORIES.filter(c => c.label !== '総評');

// ── ライアイコン ─────────────────────────────────────────────
const LIE_OPTS = [
  { v: 'ティー',       icon: '⛳', label: 'ティー' },
  { v: 'FW',           icon: '🌿', label: 'FW' },
  { v: 'ラフ',         icon: '🌱', label: 'ラフ' },
  { v: '左足上がり',   icon: '↗',  label: '左足上' },
  { v: '左足下がり',   icon: '↘',  label: '左足下' },
  { v: 'つま先上がり', icon: '↑',  label: 'つま上' },
  { v: 'つま先下がり', icon: '↓',  label: 'つま下' },
  { v: 'バンカー',     icon: '🏖', label: 'バンカー' },
  { v: 'グリーン周り', icon: '🟢', label: 'G周り' },
  { v: '花道',         icon: '✨', label: '花道' },
];

// ── 方向アイコン (ひっかけ追加) ──────────────────────────────
const DIR_OPTS = [
  { v: '真っ直ぐ', arrow: '↑' },
  { v: '右',       arrow: '↗' },
  { v: '左',       arrow: '↖' },
  { v: '右ペラ',   arrow: '→' },
  { v: 'ひっかけ', arrow: '←' },
];

// ショットログ表示で隠す方向値 (旧データの 普通 含む)
const HIDDEN_DIRECTIONS = new Set(['真っ直ぐ', '普通']);
// 良い評価の結果
const GOOD_RESULTS = new Set(['ナイス', 'OK', '普通', '狙い通り', 'ナイスアウト']);

// ─── Shot Input Modal ────────────────────────────────────────────────────────
function ShotInputModal({
  initial,
  holeId,
  shotNo,
  clubs,
  onSave,
  onDelete,
  onClose,
}: {
  initial: Partial<Shot>;
  holeId: string;
  shotNo: number;
  clubs: typeof INITIAL_CLUBS;
  onSave: (shot: Shot) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [shotTypes, setShotTypes] = useState<ShotType[]>(initial.shotTypes ?? []);
  const [clubId, setClubId] = useState(initial.clubId ?? '');
  // 総評は単一選択で管理
  const [souhyo, setSouhyo] = useState(
    initial.results?.find(r => SOUHYO_OPTS.includes(r)) ?? ''
  );
  // それ以外の結果 (距離/打感/その他)
  const [results, setResults] = useState<string[]>(
    initial.results?.filter(r => !SOUHYO_OPTS.includes(r)) ?? []
  );
  const [lies, setLies] = useState<string[]>(initial.lies ?? []);
  const [direction, setDirection] = useState(initial.direction ?? '');
  const [distance, setDistance] = useState(initial.distance?.toString() ?? '');
  const [memo, setMemo] = useState(initial.memo ?? '');
  const [penalty, setPenalty] = useState(initial.penalty ?? 0);

  const allShotTypes: ShotType[] = ['tee', 'full', 'half', 'approach', 'bunker', 'putt'];

  const availableClubs = clubs
    .slice()
    .sort((a, b) => CLUB_ORDER.indexOf(a.id) - CLUB_ORDER.indexOf(b.id));

  function save() {
    const allResults = souhyo ? [souhyo, ...results] : results;
    const shot: Shot = {
      id: initial.id ?? genId(),
      roundHoleId: holeId,
      shotNo,
      shotTypes: shotTypes.length > 0 ? shotTypes : undefined,
      clubId: clubId || undefined,
      distance: distance ? Number(distance) : undefined,
      lies: lies.length > 0 ? lies : undefined,
      results: allResults.length > 0 ? allResults : undefined,
      direction: direction || undefined,
      penalty: penalty || undefined,
      memo: memo || undefined,
    };
    onSave(shot);
  }

  return (
    <Modal title={`ショット ${shotNo}`} onClose={onClose}>
      <div className="space-y-5 pt-4">

        {/* ════ エリア1: ラウンド中の入力 ════ */}
        <div className="bg-zinc-800/50 rounded-2xl p-3 space-y-4">
          <p className="text-xs font-bold text-lime-400 tracking-wider">ラウンド中の入力</p>

          {/* ショット種別 */}
          <div>
            <p className="text-sm font-bold text-white mb-2">ショット種別 <span className="font-normal text-zinc-500 text-xs">複数可</span></p>
            <div className="flex gap-1.5 flex-wrap">
              {allShotTypes.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setShotTypes(prev =>
                    prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                  )}
                  className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    shotTypes.includes(t) ? 'bg-lime-400 text-black' : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {SHOT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* クラブ */}
          <div>
            <p className="text-sm font-bold text-white mb-2">クラブ</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-3 px-3">
              {availableClubs.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClubId(prev => prev === c.id ? '' : c.id)}
                  className={`flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                    clubId === c.id ? 'bg-lime-400 text-black' : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* 総評 (単一選択) */}
          <div>
            <p className="text-sm font-bold text-white mb-2">総評</p>
            <div className="grid grid-cols-4 gap-2">
              {SOUHYO_OPTS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSouhyo(prev => prev === opt ? '' : opt)}
                  className={`py-2.5 rounded-xl text-sm font-medium ${
                    souhyo === opt ? 'bg-lime-400 text-black' : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ════ エリア2: ラウンド後・振り返り入力 ════ */}
        <div className="border border-zinc-800 rounded-2xl p-3 space-y-4">
          <p className="text-xs font-bold text-zinc-500 tracking-wider">ラウンド後・振り返り入力</p>

          {/* ライ */}
          <div>
            <p className="text-sm font-bold text-white mb-2">ライ <span className="font-normal text-zinc-500 text-xs">複数可</span></p>
            <div className="grid grid-cols-5 gap-1.5">
              {LIE_OPTS.map(({ v, icon, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLies(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
                  className={`flex flex-col items-center py-2 rounded-xl text-xs gap-0.5 ${
                    lies.includes(v) ? 'bg-lime-400 text-black' : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  <span className="text-base leading-none">{icon}</span>
                  <span className="leading-tight text-center">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 結果詳細 (距離/打感/その他) */}
          <div>
            <p className="text-sm font-bold text-white mb-2">結果詳細 <span className="font-normal text-zinc-500 text-xs">複数可</span></p>
            <div className="space-y-3">
              {DETAIL_CATEGORIES.map(cat => (
                <div key={cat.label}>
                  <p className="text-xs font-medium text-zinc-500 mb-1.5">{cat.label}</p>
                  <SelectButtons
                    options={cat.options}
                    value={results}
                    onChange={v => setResults(v as string[])}
                    cols={4}
                    multiSelect
                  />
                </div>
              ))}
            </div>
          </div>

          {/* 方向 */}
          <div>
            <p className="text-sm font-bold text-white mb-2">方向</p>
            <div className="flex gap-1.5">
              {DIR_OPTS.map(({ v, arrow }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDirection(prev => prev === v ? '' : v)}
                  className={`flex-1 flex flex-col items-center py-2 rounded-xl text-xs gap-0.5 ${
                    direction === v ? 'bg-lime-400 text-black' : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  <span className="text-lg leading-none">{arrow}</span>
                  <span className="leading-tight">{v}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 距離 & ペナルティ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-zinc-300">距離 (y)</label>
              <input
                type="number"
                value={distance}
                onChange={e => setDistance(e.target.value)}
                className="mt-1 w-full border border-zinc-700 bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-base placeholder:text-zinc-500"
                placeholder="例: 180"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-300">ペナルティ</label>
              <div className="flex items-center gap-2 mt-1">
                <button type="button" onClick={() => setPenalty(Math.max(0, penalty - 1))} className="w-9 h-9 bg-zinc-800 text-white rounded-full font-bold active:bg-zinc-700">−</button>
                <span className="w-6 text-center font-bold text-white">{penalty}</span>
                <button type="button" onClick={() => setPenalty(penalty + 1)} className="w-9 h-9 bg-lime-400 text-black rounded-full font-bold active:bg-lime-300">+</button>
              </div>
            </div>
          </div>

          {/* メモ */}
          <div>
            <label className="text-sm font-medium text-zinc-300">メモ</label>
            <input
              value={memo}
              onChange={e => setMemo(e.target.value)}
              className="mt-1 w-full border border-zinc-700 bg-zinc-800 text-white rounded-xl px-3 py-2.5 text-base placeholder:text-zinc-500"
              placeholder="任意"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={save} className="flex-1 bg-lime-400 text-black py-3.5 rounded-2xl font-bold text-base active:bg-lime-300">
            保存
          </button>
          {onDelete && (
            <button onClick={onDelete} className="px-4 py-3.5 rounded-2xl bg-red-900/40 text-red-400 font-bold active:bg-red-900/60">
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── HoleInputPage ─────────────────────────────────────────────────────────────
export function HoleInputPage() {
  const { roundId, holeNo: holeNoStr } = useParams<{ roundId: string; holeNo: string }>();
  const navigate = useNavigate();
  const { state, saveRound } = useApp();
  const [shotModal, setShotModal] = useState<{ shot: Partial<Shot>; idx: number | null } | null>(null);

  const round = state.rounds.find(r => r.id === roundId);
  const holeNo = Number(holeNoStr ?? '1');
  const holeIdx = holeNo - 1;
  const hole = round?.holes[holeIdx];

  const updateHole = useCallback(async (updated: RoundHole) => {
    if (!round) return;
    const holes = round.holes.map((h, i) => i === holeIdx ? updated : h);
    await saveRound({ ...round, holes, updatedAt: nowStr() });
  }, [round, holeIdx, saveRound]);

  if (!round || !hole) {
    return <div className="flex items-center justify-center h-full text-zinc-500">ラウンドが見つかりません</div>;
  }

  function setField<K extends keyof RoundHole>(key: K, value: RoundHole[K]) {
    updateHole({ ...hole!, [key]: value });
  }

  function navigateHole(n: number) {
    navigate(`/rounds/${roundId}/hole/${n}`);
  }

  function addShot() { setShotModal({ shot: { roundHoleId: hole!.id }, idx: null }); }
  function editShot(idx: number) { setShotModal({ shot: hole!.shots[idx], idx }); }

  function saveShot(shot: Shot) {
    const shots = shotModal!.idx === null
      ? [...hole!.shots, shot]
      : hole!.shots.map((s, i) => i === shotModal!.idx ? shot : s);
    updateHole({ ...hole!, shots });
    setShotModal(null);
  }

  function deleteShot() {
    if (shotModal?.idx === null || shotModal?.idx === undefined) return;
    const shots = hole!.shots.filter((_, i) => i !== shotModal.idx);
    updateHole({ ...hole!, shots });
    setShotModal(null);
  }

  const clubs = state.clubs.length > 0 ? state.clubs : INITIAL_CLUBS;
  const totalHoles = round.holes.length;
  const isLast = holeNo === totalHoles;

  function finishRound() {
    if (!round) return;
    saveRound({ ...round, status: 'completed' as const, updatedAt: nowStr() });
    navigate(`/rounds/${roundId}/scorecard`);
  }

  const scoreDiff = (hole.score ?? 0) - hole.par;
  const scoreDiffLabel = scoreDiff === 0 ? 'イーブン'
    : scoreDiff === -1 ? 'バーディー'
    : scoreDiff === -2 ? 'イーグル'
    : scoreDiff === 1 ? 'ボギー'
    : scoreDiff === 2 ? 'ダブルボギー'
    : scoreDiff > 2 ? `+${scoreDiff}` : `${scoreDiff}`;

  return (
    <div className="min-h-full bg-[#0f0f0f] flex flex-col">
      {/* Header */}
      <div className="bg-zinc-950 text-white px-4 pt-12 pb-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-1">
          <p className="text-zinc-500 text-xs">{round.date} · {round.courseName}</p>
          <button onClick={() => navigate(`/rounds/${roundId}/scorecard`)}
            className="flex items-center gap-1 text-zinc-500 text-xs active:text-lime-400">
            <TableProperties size={14} /> スコアカード
          </button>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-4xl font-black text-white">Hole {holeNo}</span>
            <span className="text-zinc-500 ml-2 text-sm">{holeNo} / {totalHoles}</span>
          </div>
          <div className="text-right">
            <p className="text-zinc-500 text-xs">Par {hole.par}</p>
            {hole.yardage && <p className="text-zinc-500 text-xs">{hole.yardage}y</p>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Score card */}
        <div className="bg-zinc-900 rounded-2xl p-4">
          <div className="mb-1">
            <Counter label="スコア" value={hole.score ?? 0} onChange={v => setField('score', v || undefined)}
              min={1} max={20} defaultValue={hole.par} />
            {hole.score != null && (
              <p className={`text-xs text-right font-medium mt-0.5 ${
                scoreDiff < 0 ? 'text-blue-400' : scoreDiff === 0 ? 'text-lime-400' : scoreDiff === 1 ? 'text-zinc-400' : 'text-red-400'
              }`}>{scoreDiffLabel}</p>
            )}
          </div>
          <div className="border-t border-zinc-800 pt-2">
            <Counter label="パット数" value={hole.putts ?? 0} onChange={v => setField('putts', v || undefined)} />
          </div>
          <div className="pt-1 pb-1 flex items-center justify-between">
            <span className="text-zinc-500 text-xs pl-1">パットトータル距離 (y)</span>
            <input type="number" inputMode="numeric" value={hole.puttDistance ?? ''}
              onChange={e => setField('puttDistance', e.target.value ? Number(e.target.value) : undefined)}
              className="w-20 border border-zinc-700 bg-zinc-800 text-white rounded-lg px-2 py-1 text-sm text-right font-medium"
              placeholder="−" />
          </div>
          <div className="border-t border-zinc-800 pt-2 grid grid-cols-2 gap-2">
            <Counter label="OB" value={hole.ob ?? 0} onChange={v => setField('ob', v)} compact />
            <Counter label="ペナ" value={hole.penalty ?? 0} onChange={v => setField('penalty', v)} compact />
          </div>
        </div>

        {/* Memo */}
        <div className="bg-zinc-900 rounded-2xl px-4 py-3">
          <input value={hole.memo ?? ''} onChange={e => setField('memo', e.target.value || undefined)}
            className="w-full text-sm text-zinc-300 placeholder-zinc-600 outline-none bg-transparent"
            placeholder="ホールメモ（任意）" />
        </div>

        {/* Shot log */}
        <div className="bg-zinc-900 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-white">ショットログ</h3>
            <button onClick={addShot}
              className="flex items-center gap-1 bg-lime-400 text-black px-3 py-1.5 rounded-xl text-sm font-medium active:bg-lime-300">
              <Plus size={14} /> 追加
            </button>
          </div>
          {hole.shots.length === 0 && (
            <p className="text-xs text-zinc-600 text-center py-2">ショットを追加してください</p>
          )}
          <div className="space-y-2">
            {hole.shots.map((shot, i) => {
              const club = clubs.find(c => c.id === shot.clubId);
              const souhyoR = shot.results?.find(r => SOUHYO_OPTS.includes(r));
              const otherR = shot.results?.filter(r => !SOUHYO_OPTS.includes(r)) ?? [];
              return (
                <div key={shot.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-zinc-600 font-mono w-4">{i + 1}</span>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {shot.shotTypes?.map(t => (
                          <span key={t} className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-medium">
                            {SHOT_TYPE_LABELS[t]}
                          </span>
                        ))}
                        {club && <span className="text-sm font-bold text-white">{club.name}</span>}
                        {shot.distance && <span className="text-xs text-zinc-500">{shot.distance}y</span>}
                        {souhyoR && (
                          <span className={`text-xs font-bold ${GOOD_RESULTS.has(souhyoR) ? 'text-lime-400' : 'text-red-400'}`}>
                            {souhyoR}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {shot.lies?.map(l => (
                          <span key={l} className="text-xs text-zinc-500">
                            {LIE_OPTS.find(o => o.v === l)?.icon ?? ''} {l}
                          </span>
                        ))}
                        {otherR.map(r => (
                          <span key={r} className={`text-xs font-medium ${GOOD_RESULTS.has(r) ? 'text-lime-400' : 'text-red-400'}`}>
                            {r}
                          </span>
                        ))}
                        {shot.direction && !HIDDEN_DIRECTIONS.has(shot.direction) && (
                          <span className="text-xs text-orange-400">
                            {DIR_OPTS.find(d => d.v === shot.direction)?.arrow ?? ''} {shot.direction}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => editShot(i)} className="p-1.5 text-zinc-600 active:text-lime-400">
                    <Pencil size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="bg-zinc-950 border-t border-zinc-800 px-4 pt-3 pb-3 space-y-1.5">
        <div className="grid grid-cols-9 gap-1">
          {round.holes.slice(0, 9).map(h => (
            <button key={h.holeNo} onClick={() => navigateHole(h.holeNo)}
              className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                h.holeNo === holeNo ? 'bg-lime-400 text-black'
                  : h.score != null ? 'bg-zinc-800 text-lime-400'
                  : 'bg-zinc-800 text-zinc-500'
              }`}>{h.holeNo}</button>
          ))}
        </div>
        {round.holes.length > 9 && (
          <div className="grid grid-cols-9 gap-1">
            {round.holes.slice(9).map(h => (
              <button key={h.holeNo} onClick={() => navigateHole(h.holeNo)}
                className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                  h.holeNo === holeNo ? 'bg-lime-400 text-black'
                    : h.score != null ? 'bg-zinc-800 text-lime-400'
                    : 'bg-zinc-800 text-zinc-500'
                }`}>{h.holeNo}</button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between pt-0.5">
          <button onClick={() => navigateHole(holeNo - 1)} disabled={holeNo === 1}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-sm font-medium disabled:opacity-30 active:bg-zinc-700">
            <ChevronLeft size={16} /> 前のホール
          </button>
          {isLast ? (
            <button onClick={finishRound} className="bg-lime-400 text-black px-5 py-2 rounded-xl text-sm font-bold active:bg-lime-300">
              ラウンド完了
            </button>
          ) : (
            <button onClick={() => navigateHole(holeNo + 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-lime-400 text-black text-sm font-medium active:bg-lime-300">
              次のホール <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      {shotModal && (
        <ShotInputModal
          initial={shotModal.shot}
          holeId={hole.id}
          shotNo={shotModal.idx === null ? hole.shots.length + 1 : hole.shots[shotModal.idx].shotNo}
          clubs={clubs}
          onSave={saveShot}
          onDelete={shotModal.idx !== null ? deleteShot : undefined}
          onClose={() => setShotModal(null)}
        />
      )}
    </div>
  );
}
