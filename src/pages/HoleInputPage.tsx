import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { RoundHole, Shot, ShotType } from '../types';
import { Counter } from '../components/ui/Counter';
import { SelectButtons } from '../components/ui/SelectButtons';
import { Modal } from '../components/ui/Modal';
import {
  LIE_OPTIONS, RESULT_CATEGORIES,
  DIRECTION_OPTIONS, SHOT_TYPE_LABELS, INITIAL_CLUBS, CLUB_ORDER,
} from '../data/initial';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, TableProperties } from 'lucide-react';

function genId() { return crypto.randomUUID(); }
function nowStr() { return new Date().toISOString(); }

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
  const [lies, setLies] = useState<string[]>(initial.lies ?? []);
  const [results, setResults] = useState<string[]>(initial.results ?? []);
  const [direction, setDirection] = useState(initial.direction ?? '');
  const [distance, setDistance] = useState(initial.distance?.toString() ?? '');
  const [memo, setMemo] = useState(initial.memo ?? '');
  const [penalty, setPenalty] = useState(initial.penalty ?? 0);

  const allShotTypes: ShotType[] = ['tee', 'full', 'half', 'approach', 'bunker', 'putt'];

  const availableClubs = clubs
    .slice()
    .sort((a, b) => CLUB_ORDER.indexOf(a.id) - CLUB_ORDER.indexOf(b.id));

  function save() {
    const shot: Shot = {
      id: initial.id ?? genId(),
      roundHoleId: holeId,
      shotNo,
      shotTypes: shotTypes.length > 0 ? shotTypes : undefined,
      clubId: clubId || undefined,
      distance: distance ? Number(distance) : undefined,
      lies: lies.length > 0 ? lies : undefined,
      results: results.length > 0 ? results : undefined,
      direction: direction || undefined,
      penalty: penalty || undefined,
      memo: memo || undefined,
    };
    onSave(shot);
  }

  return (
    <Modal title={`ショット ${shotNo}`} onClose={onClose}>
      <div className="space-y-5 pt-4">
        {/* Shot type（複数選択可） */}
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">スイングタイプ <span className="font-normal text-gray-400 text-xs">複数選択可</span></p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {allShotTypes.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setShotTypes(prev =>
                    prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                  );
                }}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  shotTypes.includes(t) ? 'bg-green-800 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {SHOT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Club（W→U→アイアン→ウェッジ→パター順） */}
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">クラブ</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {availableClubs.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClubId(prev => prev === c.id ? '' : c.id)}
                className={`flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  clubId === c.id ? 'bg-green-800 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* ライ（複数選択可） */}
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">ライ <span className="font-normal text-gray-400 text-xs">複数選択可</span></p>
          <SelectButtons
            options={LIE_OPTIONS}
            value={lies}
            onChange={v => setLies(v as string[])}
            cols={3}
            multiSelect
          />
        </div>

        {/* 結果（カテゴリ別・複数選択可） */}
        <div>
          <p className="text-sm font-bold text-gray-700 mb-3">結果 <span className="font-normal text-gray-400 text-xs">複数選択可</span></p>
          <div className="space-y-3">
            {RESULT_CATEGORIES.map(cat => (
              <div key={cat.label}>
                <p className="text-xs font-medium text-gray-400 mb-1.5">{cat.label}</p>
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

        {/* 方向（単一選択） */}
        <div>
          <p className="text-sm font-bold text-gray-700 mb-2">方向</p>
          <SelectButtons
            options={DIRECTION_OPTIONS}
            value={direction}
            onChange={v => setDirection(v as string)}
            cols={3}
          />
        </div>

        {/* 距離 & ペナルティ */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700">距離 (y)</label>
            <input
              type="number"
              value={distance}
              onChange={e => setDistance(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base"
              placeholder="例: 180"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">ペナルティ</label>
            <div className="flex items-center gap-2 mt-1">
              <button type="button" onClick={() => setPenalty(Math.max(0, penalty - 1))} className="w-9 h-9 bg-gray-100 rounded-full font-bold">−</button>
              <span className="w-6 text-center font-bold">{penalty}</span>
              <button type="button" onClick={() => setPenalty(penalty + 1)} className="w-9 h-9 bg-green-800 rounded-full text-white font-bold">+</button>
            </div>
          </div>
        </div>

        {/* メモ */}
        <div>
          <label className="text-sm font-medium text-gray-700">メモ</label>
          <input
            value={memo}
            onChange={e => setMemo(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base"
            placeholder="任意"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={save}
            className="flex-1 bg-green-800 text-white py-3.5 rounded-2xl font-bold text-base active:bg-green-900"
          >
            保存
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-3.5 rounded-2xl bg-red-50 text-red-600 font-bold active:bg-red-100"
            >
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
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        ラウンドが見つかりません
      </div>
    );
  }

  function setField<K extends keyof RoundHole>(key: K, value: RoundHole[K]) {
    updateHole({ ...hole!, [key]: value });
  }

  function navigateHole(n: number) {
    navigate(`/rounds/${roundId}/hole/${n}`);
  }

  function addShot() {
    setShotModal({ shot: { roundHoleId: hole!.id }, idx: null });
  }

  function editShot(idx: number) {
    setShotModal({ shot: hole!.shots[idx], idx });
  }

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
    : scoreDiff > 2 ? `+${scoreDiff}`
    : `${scoreDiff}`;

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-green-800 text-white px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-1">
          {/* ▼ 日付を追加 */}
          <p className="text-green-200 text-xs">{round.date} · {round.courseName}</p>
          <button
            onClick={() => navigate(`/rounds/${roundId}/scorecard`)}
            className="flex items-center gap-1 text-green-200 text-xs"
          >
            <TableProperties size={14} /> スコアカード
          </button>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-4xl font-black">Hole {holeNo}</span>
            <span className="text-green-300 ml-2 text-sm">{holeNo} / {totalHoles}</span>
          </div>
          <div className="text-right">
            <p className="text-green-200 text-xs">Par {hole.par}</p>
            {hole.yardage && <p className="text-green-200 text-xs">{hole.yardage}y</p>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Score card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="mb-1">
            <Counter
              label="スコア"
              value={hole.score ?? 0}
              onChange={v => setField('score', v || undefined)}
              min={1}
              max={20}
              defaultValue={hole.par}
            />
            {hole.score != null && (
              <p className={`text-xs text-right font-medium mt-0.5 ${
                scoreDiff < 0 ? 'text-blue-600' : scoreDiff === 0 ? 'text-green-700' : scoreDiff === 1 ? 'text-yellow-600' : 'text-red-500'
              }`}>
                {scoreDiffLabel}
              </p>
            )}
          </div>
          <div className="border-t border-gray-100 pt-2">
            <Counter label="パット数" value={hole.putts ?? 0} onChange={v => setField('putts', v || undefined)} />
          </div>
          <div className="border-t border-gray-100 pt-3 pb-1 flex items-center justify-between">
            <span className="text-gray-700 font-medium text-base">1打目距離 (y)</span>
            <input
              type="number"
              inputMode="numeric"
              value={hole.puttDistance ?? ''}
              onChange={e => setField('puttDistance', e.target.value ? Number(e.target.value) : undefined)}
              className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-base text-right font-bold"
              placeholder="−"
            />
          </div>
          <div className="border-t border-gray-100 pt-2 grid grid-cols-2 gap-2">
            <Counter label="OB" value={hole.ob ?? 0} onChange={v => setField('ob', v)} compact />
            <Counter label="ペナルティ" value={hole.penalty ?? 0} onChange={v => setField('penalty', v)} compact />
          </div>
        </div>

        {/* Memo */}
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
          <input
            value={hole.memo ?? ''}
            onChange={e => setField('memo', e.target.value || undefined)}
            className="w-full text-sm text-gray-700 placeholder-gray-300 outline-none"
            placeholder="ホールメモ（任意）"
          />
        </div>

        {/* Shot log */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900">ショットログ</h3>
            <button
              onClick={addShot}
              className="flex items-center gap-1 bg-green-800 text-white px-3 py-1.5 rounded-xl text-sm font-medium active:bg-green-900"
            >
              <Plus size={14} /> 追加
            </button>
          </div>
          {hole.shots.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">ショットを追加してください</p>
          )}
          <div className="space-y-2">
            {hole.shots.map((shot, i) => {
              const club = clubs.find(c => c.id === shot.clubId);
              return (
                <div
                  key={shot.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 font-mono w-4">{i + 1}</span>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {shot.shotTypes?.map(t => (
                          <span key={t} className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full font-medium">
                            {SHOT_TYPE_LABELS[t]}
                          </span>
                        ))}
                        {club && <span className="text-sm font-bold text-gray-900">{club.name}</span>}
                        {shot.distance && <span className="text-xs text-gray-500">{shot.distance}y</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {shot.lies?.map(l => (
                          <span key={l} className="text-xs text-gray-500">{l}</span>
                        ))}
                        {shot.results?.map(r => (
                          <span key={r} className={`text-xs font-medium ${
                            ['ナイス', '普通', 'ナイスアウト'].includes(r) ? 'text-green-700' : 'text-red-500'
                          }`}>
                            {r}
                          </span>
                        ))}
                        {shot.direction && shot.direction !== '真っ直ぐ' && (
                          <span className="text-xs text-orange-500">{shot.direction}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => editShot(i)} className="p-1.5 text-gray-400 active:text-green-700">
                    <Pencil size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="bg-white border-t border-gray-200 px-4 pt-3 pb-3 space-y-1.5">
        {/* Holes 1-9 */}
        <div className="grid grid-cols-9 gap-1">
          {round.holes.slice(0, 9).map(h => (
            <button
              key={h.holeNo}
              onClick={() => navigateHole(h.holeNo)}
              className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                h.holeNo === holeNo ? 'bg-green-800 text-white'
                  : h.score != null ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {h.holeNo}
            </button>
          ))}
        </div>
        {/* Holes 10-18 */}
        {round.holes.length > 9 && (
          <div className="grid grid-cols-9 gap-1">
            {round.holes.slice(9).map(h => (
              <button
                key={h.holeNo}
                onClick={() => navigateHole(h.holeNo)}
                className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                  h.holeNo === holeNo ? 'bg-green-800 text-white'
                    : h.score != null ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {h.holeNo}
              </button>
            ))}
          </div>
        )}
        {/* Prev / Next */}
        <div className="flex items-center justify-between pt-0.5">
          <button
            onClick={() => navigateHole(holeNo - 1)}
            disabled={holeNo === 1}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium disabled:opacity-30 active:bg-gray-200"
          >
            <ChevronLeft size={16} /> 前のホール
          </button>
          {isLast ? (
            <button
              onClick={finishRound}
              className="bg-green-800 text-white px-5 py-2 rounded-xl text-sm font-bold active:bg-green-900"
            >
              ラウンド完了
            </button>
          ) : (
            <button
              onClick={() => navigateHole(holeNo + 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-green-800 text-white text-sm font-medium active:bg-green-900"
            >
              次のホール <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Shot modal */}
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
