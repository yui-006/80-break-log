import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Club, ClubSet } from '../types';
import { Card } from '../components/ui/Card';
import { Download, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { CLUB_ORDER } from '../data/initial';

function genId() { return crypto.randomUUID(); }

const INPUT_CLS = 'mt-1 w-full border border-zinc-700 bg-zinc-800 text-white rounded-xl px-3 py-2 text-sm placeholder:text-zinc-500';
const LABEL_CLS = 'text-xs text-zinc-500';

export function SettingsPage() {
  const { state, exportData, importData, clearAll, saveClub, deleteClub, saveClubSet, deleteClubSet, setActiveClubSet } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [showClear, setShowClear] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [newSetModal, setNewSetModal] = useState<{ name: string; copy: boolean } | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editingSetName, setEditingSetName] = useState('');

  const sortedClubs = [...state.clubs].sort((a, b) => {
    const ai = CLUB_ORDER.indexOf(a.id);
    const bi = CLUB_ORDER.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  async function handleExport() {
    const json = await exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `80-break-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('エクスポートしました');
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = await file.text();
      await importData(json);
      flash('インポートしました');
    } catch {
      flash('インポートに失敗しました');
    }
    e.target.value = '';
  }

  async function handleClear() {
    await clearAll();
    setShowClear(false);
    flash('データを初期化しました');
  }

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  }

  async function handleCreateSet() {
    if (!newSetModal || !newSetModal.name.trim()) return;
    const activeSet = state.clubSets.find(s => s.id === state.activeClubSetId);
    const clubs = newSetModal.copy && activeSet
      ? activeSet.clubs.map(c => ({ ...c, id: genId() }))
      : [];
    const newSet: ClubSet = { id: genId(), name: newSetModal.name.trim(), clubs, createdAt: new Date().toISOString() };
    await saveClubSet(newSet);
    setActiveClubSet(newSet.id);
    setNewSetModal(null);
    flash('新しいセットを作成し切り替えました');
  }

  async function handleRenameSet() {
    if (!editingSetId || !editingSetName.trim()) return;
    const set = state.clubSets.find(s => s.id === editingSetId);
    if (!set) return;
    await saveClubSet({ ...set, name: editingSetName.trim() });
    setEditingSetId(null);
  }

  async function handleDeleteSet(id: string) {
    if (state.clubSets.length <= 1) { flash('最後のセットは削除できません'); return; }
    await deleteClubSet(id);
    if (id === state.activeClubSetId) setActiveClubSet(state.clubSets.find(s => s.id !== id)!.id);
  }

  const CATEGORY_LABEL: Record<string, string> = {
    wood: 'ウッド', utility: 'UT', iron: 'アイアン', wedge: 'ウェッジ', putter: 'パター',
  };

  return (
    <div className="min-h-full bg-[#0f0f0f]">
      <div className="px-5 pt-12 pb-6">
        <h1 className="text-2xl font-bold text-white">設定</h1>
      </div>

      <div className="px-4 pb-4 space-y-5">
        {msg && (
          <div className="bg-lime-400/10 border border-lime-400/30 text-lime-400 text-sm px-4 py-3 rounded-2xl">{msg}</div>
        )}

        {/* ── Club Sets ─────────────────────────────────── */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white">クラブセット</h2>
            <button
              onClick={() => setNewSetModal({ name: '', copy: true })}
              className="text-lime-400 text-sm font-medium"
            >
              ＋ 新規作成
            </button>
          </div>
          <div className="space-y-2">
            {state.clubSets.map(set => {
              const isActive = set.id === state.activeClubSetId;
              const isEditing = editingSetId === set.id;
              return (
                <div key={set.id} className={`rounded-xl border p-3 ${isActive ? 'border-lime-400/40 bg-lime-400/5' : 'border-zinc-800 bg-zinc-800/40'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editingSetName}
                          onChange={e => setEditingSetName(e.target.value)}
                          onBlur={handleRenameSet}
                          onKeyDown={e => e.key === 'Enter' && handleRenameSet()}
                          className="flex-1 border border-lime-400/40 bg-zinc-800 text-white rounded-lg px-2 py-1 text-sm"
                        />
                      ) : (
                        <button
                          className="font-bold text-white text-sm text-left truncate"
                          onClick={() => { setEditingSetId(set.id); setEditingSetName(set.name); }}
                        >
                          {set.name}
                        </button>
                      )}
                      <span className="text-xs text-zinc-500 flex-shrink-0">{set.clubs.length}本</span>
                      {isActive && <span className="text-xs bg-lime-400 text-black px-2 py-0.5 rounded-full font-bold flex-shrink-0">使用中</span>}
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      {!isActive && (
                        <button
                          onClick={() => setActiveClubSet(set.id)}
                          className="text-xs text-lime-400 font-medium px-2 py-1 rounded-lg bg-lime-400/10 border border-lime-400/30"
                        >
                          使用する
                        </button>
                      )}
                      {state.clubSets.length > 1 && (
                        <button onClick={() => handleDeleteSet(set.id)} className="text-zinc-500 active:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Club list of active set ───────────────────── */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="font-bold text-white">クラブ一覧</h2>
              <p className="text-xs text-zinc-500">
                {state.clubSets.find(s => s.id === state.activeClubSetId)?.name ?? ''}
              </p>
            </div>
            <button
              onClick={() => setEditingClub({ id: genId(), name: '', category: 'iron' })}
              className="text-lime-400 text-sm font-medium"
            >
              ＋ 追加
            </button>
          </div>
          <div className="space-y-2 mt-3">
            {sortedClubs.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div>
                  <span className="font-bold text-white text-sm">{c.name}</span>
                  <span className="text-xs text-zinc-500 ml-2">{CATEGORY_LABEL[c.category] ?? c.category}</span>
                  {c.head && <span className="text-xs text-zinc-500 ml-1">{c.head}</span>}
                  <div className="text-xs text-zinc-500">
                    {[c.loft != null && `${c.loft}°`, c.shaft, c.flex].filter(Boolean).join(' / ')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingClub(c)} className="text-xs text-lime-400 px-2 py-1 rounded-lg bg-lime-400/10">編集</button>
                  <button onClick={() => deleteClub(c.id)} className="text-zinc-500 active:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {sortedClubs.length === 0 && (
              <p className="text-xs text-zinc-500 text-center py-3">クラブを追加してください</p>
            )}
          </div>
        </Card>

        {/* ── Data management ───────────────────────────── */}
        <Card className="p-4">
          <h2 className="font-bold text-white mb-3">データ管理</h2>
          <div className="space-y-3">
            <div className="text-xs text-zinc-500 flex gap-4">
              <span>コース: {state.courses.length}件</span>
              <span>ラウンド: {state.rounds.length}件</span>
            </div>
            <button onClick={handleExport} className="w-full flex items-center justify-center gap-2 bg-lime-400 text-black py-3.5 rounded-2xl font-bold text-base active:bg-lime-300">
              <Download size={18} /> JSONエクスポート
            </button>
            <button onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-zinc-800 text-zinc-300 py-3.5 rounded-2xl font-bold text-base active:bg-zinc-700">
              <Upload size={18} /> JSONインポート
            </button>
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            <p className="text-xs text-zinc-500">インポートすると現在のデータはすべて上書きされます</p>
          </div>
        </Card>

        {/* ── Clear data ────────────────────────────────── */}
        <Card className="p-4">
          <h2 className="font-bold text-white mb-3">データ初期化</h2>
          {!showClear ? (
            <button onClick={() => setShowClear(true)} className="w-full flex items-center justify-center gap-2 border border-red-900/60 text-red-400 py-3 rounded-2xl font-medium text-sm active:bg-red-900/20">
              <Trash2 size={16} /> すべてのデータを削除
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-red-900/20 p-3 rounded-xl">
                <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">全データが削除されます。この操作は元に戻せません。</p>
              </div>
              <div className="flex gap-3">
                <button onClick={handleClear} className="flex-1 bg-red-600 text-white py-3 rounded-2xl font-bold text-sm active:bg-red-700">削除する</button>
                <button onClick={() => setShowClear(false)} className="flex-1 bg-zinc-800 text-zinc-300 py-3 rounded-2xl font-bold text-sm active:bg-zinc-700">キャンセル</button>
              </div>
            </div>
          )}
        </Card>

        <div className="text-center text-xs text-zinc-600 pb-4">
          <p>80 Break Log</p>
          <p>データはこのブラウザ内にのみ保存されます</p>
        </div>
      </div>

      {/* ── Club edit modal ───────────────────────────────── */}
      {editingClub && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setEditingClub(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-zinc-900 rounded-t-3xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white text-lg">{editingClub.head ? 'クラブ編集' : 'クラブ追加'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLS}>名前</label>
                <input value={editingClub.name} onChange={e => setEditingClub({ ...editingClub, name: e.target.value })}
                  className={INPUT_CLS} placeholder="1W" />
              </div>
              <div>
                <label className={LABEL_CLS}>カテゴリー</label>
                <select value={editingClub.category} onChange={e => setEditingClub({ ...editingClub, category: e.target.value as Club['category'] })}
                  className={INPUT_CLS}>
                  <option value="wood">ウッド</option>
                  <option value="utility">ユーティリティ</option>
                  <option value="iron">アイアン</option>
                  <option value="wedge">ウェッジ</option>
                  <option value="putter">パター</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>ヘッド</label>
                <input value={editingClub.head ?? ''} onChange={e => setEditingClub({ ...editingClub, head: e.target.value })}
                  className={INPUT_CLS} placeholder="メーカー・モデル" />
              </div>
              <div>
                <label className={LABEL_CLS}>ロフト</label>
                <input type="number" value={editingClub.loft ?? ''} onChange={e => setEditingClub({ ...editingClub, loft: e.target.value ? Number(e.target.value) : undefined })}
                  className={INPUT_CLS} placeholder="°" />
              </div>
              <div>
                <label className={LABEL_CLS}>シャフト</label>
                <input value={editingClub.shaft ?? ''} onChange={e => setEditingClub({ ...editingClub, shaft: e.target.value })}
                  className={INPUT_CLS} placeholder="シャフト名" />
              </div>
              <div>
                <label className={LABEL_CLS}>フレックス</label>
                <input value={editingClub.flex ?? ''} onChange={e => setEditingClub({ ...editingClub, flex: e.target.value })}
                  className={INPUT_CLS} placeholder="R / S / X" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={async () => { if (!editingClub.name.trim()) return; await saveClub(editingClub); setEditingClub(null); }}
                disabled={!editingClub.name.trim()}
                className="flex-1 bg-lime-400 text-black py-3 rounded-2xl font-bold disabled:opacity-40 active:bg-lime-300">保存</button>
              <button onClick={() => setEditingClub(null)} className="flex-1 bg-zinc-800 text-zinc-300 py-3 rounded-2xl font-bold active:bg-zinc-700">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New set modal ─────────────────────────────────── */}
      {newSetModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setNewSetModal(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-zinc-900 rounded-t-3xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white text-lg">新規クラブセット</h3>
            <div>
              <label className={LABEL_CLS}>セット名</label>
              <input
                autoFocus
                value={newSetModal.name}
                onChange={e => setNewSetModal({ ...newSetModal, name: e.target.value })}
                className={INPUT_CLS}
                placeholder="例: 2026年セッティング"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={newSetModal.copy}
                onChange={e => setNewSetModal({ ...newSetModal, copy: e.target.checked })}
                className="w-4 h-4 accent-lime-400"
              />
              <span className="text-sm text-zinc-300">現在のセットのクラブをコピーする</span>
            </label>
            <div className="flex gap-3">
              <button onClick={handleCreateSet} disabled={!newSetModal.name.trim()}
                className="flex-1 bg-lime-400 text-black py-3 rounded-2xl font-bold disabled:opacity-40 active:bg-lime-300">作成して切り替え</button>
              <button onClick={() => setNewSetModal(null)} className="flex-1 bg-zinc-800 text-zinc-300 py-3 rounded-2xl font-bold active:bg-zinc-700">キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
