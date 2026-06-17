import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { Club, ClubSet } from '../types';
import { Card } from '../components/ui/Card';
import { Download, Upload, Trash2, AlertTriangle, Cloud, CloudOff, LogOut, RefreshCw } from 'lucide-react';
import { CLUB_ORDER } from '../data/initial';
import { CLUB_EXPECTED_DISTANCE } from '../analytics';

function genId() { return crypto.randomUUID(); }

const INPUT_CLS = 'mt-1 w-full border border-ll-line bg-ll-s2 text-ll-ink rounded-xl px-3 py-2 text-sm placeholder:text-ll-dim';
const LABEL_CLS = 'text-xs text-ll-mute';

export function SettingsPage() {
  const { state, goalThreshold, setGoalThreshold, user, syncStatus, signOut, exportData, importData, clearAll, saveClub, deleteClub, saveClubSet, deleteClubSet, setActiveClubSet } = useApp();
  const navigate = useNavigate();
  const GOAL_OPTIONS = [100, 95, 90, 85, 80] as const;
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
    <div className="min-h-full bg-ll-bg">
      <div className="px-5 pt-12 pb-6">
        <h1 className="text-2xl font-bold text-ll-ink">設定</h1>
      </div>

      <div className="px-4 pb-4 space-y-5">
        {msg && (
          <div className="bg-ll-weak border border-ll-acc/30 text-ll-acc text-sm px-4 py-3 rounded-2xl">{msg}</div>
        )}

        {/* Cloud sync */}
        <Card className="p-4">
          <h2 className="font-bold text-ll-ink mb-3">クラウド同期</h2>
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-ll-weak border border-ll-acc/30 rounded-xl">
                {syncStatus === 'syncing'
                  ? <RefreshCw size={18} className="text-ll-acc animate-spin flex-shrink-0" />
                  : syncStatus === 'error'
                  ? <CloudOff size={18} className="text-ll-loss flex-shrink-0" />
                  : <Cloud size={18} className="text-ll-acc flex-shrink-0" />
                }
                <div className="min-w-0">
                  <p className="text-ll-ink text-sm font-bold truncate">{user.email}</p>
                  <p className="text-ll-mute text-xs">
                    {syncStatus === 'syncing' ? '同期中…'
                      : syncStatus === 'error' ? '同期エラー（次回接続時に再試行）'
                      : 'データを自動バックアップ中'}
                  </p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center justify-center gap-2 bg-ll-s2 text-ll-mute py-3 rounded-xl text-sm font-medium border border-ll-line active:bg-ll-line"
              >
                <LogOut size={15} /> ログアウト
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-ll-s2 border border-ll-line rounded-xl">
                <CloudOff size={18} className="text-ll-dim flex-shrink-0" />
                <div>
                  <p className="text-ll-ink text-sm font-bold">未ログイン（ローカルのみ）</p>
                  <p className="text-ll-mute text-xs">ログインするとデータが複数端末で同期されます</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/auth')}
                className="w-full flex items-center justify-center gap-2 bg-ll-acc text-white py-3.5 rounded-xl text-sm font-bold active:opacity-80"
              >
                <Cloud size={16} /> ログインして同期を有効にする
              </button>
            </div>
          )}
        </Card>

        {/* Goal threshold */}
        <Card className="p-4">
          <h2 className="font-bold text-ll-ink mb-1">目標スコア</h2>
          <p className="text-xs text-ll-mute mb-3">ホーム画面の達成率・SG分析のベンチマークに使用されます</p>
          <div className="flex gap-2">
            {GOAL_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setGoalThreshold(opt)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                  goalThreshold === opt
                    ? 'bg-ll-acc text-white border-ll-acc'
                    : 'bg-ll-s2 text-ll-ink border-ll-line active:bg-ll-line'
                }`}
              >
                {opt}打
              </button>
            ))}
          </div>
        </Card>

        {/* Club Sets */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-ll-ink">クラブセット</h2>
            <button onClick={() => setNewSetModal({ name: '', copy: true })} className="text-ll-acc text-sm font-medium">
              ＋ 新規作成
            </button>
          </div>
          <div className="space-y-2">
            {state.clubSets.map(set => {
              const isActive = set.id === state.activeClubSetId;
              const isEditing = editingSetId === set.id;
              return (
                <div key={set.id} className={`rounded-xl border p-3 ${isActive ? 'border-ll-acc/40 bg-ll-weak' : 'border-ll-line bg-ll-s2'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editingSetName}
                          onChange={e => setEditingSetName(e.target.value)}
                          onBlur={handleRenameSet}
                          onKeyDown={e => e.key === 'Enter' && handleRenameSet()}
                          className="flex-1 border border-ll-acc/40 bg-ll-surf text-ll-ink rounded-lg px-2 py-1 text-sm"
                        />
                      ) : (
                        <button
                          className="font-bold text-ll-ink text-sm text-left truncate"
                          onClick={() => { setEditingSetId(set.id); setEditingSetName(set.name); }}
                        >
                          {set.name}
                        </button>
                      )}
                      <span className="text-xs text-ll-mute flex-shrink-0">{set.clubs.length}本</span>
                      {isActive && <span className="text-xs bg-ll-acc text-white px-2 py-0.5 rounded-full font-bold flex-shrink-0">使用中</span>}
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      {!isActive && (
                        <button
                          onClick={() => setActiveClubSet(set.id)}
                          className="text-xs text-ll-acc font-medium px-2 py-1 rounded-lg bg-ll-weak border border-ll-acc/30"
                        >
                          使用する
                        </button>
                      )}
                      {state.clubSets.length > 1 && (
                        <button onClick={() => handleDeleteSet(set.id)} className="text-ll-dim active:text-ll-loss">
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

        {/* Club list */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="font-bold text-ll-ink">クラブ一覧</h2>
              <p className="text-xs text-ll-mute">
                {state.clubSets.find(s => s.id === state.activeClubSetId)?.name ?? ''}
              </p>
            </div>
            <button
              onClick={() => setEditingClub({ id: genId(), name: '', category: 'iron' })}
              className="text-ll-acc text-sm font-medium"
            >
              ＋ 追加
            </button>
          </div>
          <div className="space-y-2 mt-3">
            {sortedClubs.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-ll-line last:border-0">
                <div>
                  <span className="font-bold text-ll-ink text-sm">{c.name}</span>
                  <span className="text-xs text-ll-mute ml-2">{CATEGORY_LABEL[c.category] ?? c.category}</span>
                  {c.head && <span className="text-xs text-ll-mute ml-1">{c.head}</span>}
                  {CLUB_EXPECTED_DISTANCE[c.id] != null && (
                    <span className="text-xs text-ll-good ml-1">想定 {CLUB_EXPECTED_DISTANCE[c.id]}y</span>
                  )}
                  <div className="text-xs text-ll-mute">
                    {[c.loft != null && `${c.loft}°`, c.shaft, c.flex].filter(Boolean).join(' / ')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingClub(c)} className="text-xs text-ll-acc px-2 py-1 rounded-lg bg-ll-weak">編集</button>
                  <button onClick={() => deleteClub(c.id)} className="text-ll-dim active:text-ll-loss"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {sortedClubs.length === 0 && (
              <p className="text-xs text-ll-mute text-center py-3">クラブを追加してください</p>
            )}
          </div>
        </Card>

        {/* Data management */}
        <Card className="p-4">
          <h2 className="font-bold text-ll-ink mb-3">データ管理</h2>
          <div className="space-y-3">
            <div className="text-xs text-ll-mute flex gap-4">
              <span>コース: {state.courses.length}件</span>
              <span>ラウンド: {state.rounds.length}件</span>
            </div>
            <button onClick={handleExport} className="w-full flex items-center justify-center gap-2 bg-ll-acc text-white py-3.5 rounded-2xl font-bold text-base active:opacity-80">
              <Download size={18} /> JSONエクスポート
            </button>
            <button onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-ll-s2 text-ll-ink py-3.5 rounded-2xl font-bold text-base border border-ll-line active:bg-ll-line">
              <Upload size={18} /> JSONインポート
            </button>
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            <p className="text-xs text-ll-mute">インポートすると現在のデータはすべて上書きされます</p>
          </div>
        </Card>

        {/* Clear data */}
        <Card className="p-4">
          <h2 className="font-bold text-ll-ink mb-3">データ初期化</h2>
          {!showClear ? (
            <button onClick={() => setShowClear(true)} className="w-full flex items-center justify-center gap-2 border border-ll-loss/40 text-ll-loss py-3 rounded-2xl font-medium text-sm active:bg-ll-loss/5">
              <Trash2 size={16} /> すべてのデータを削除
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-ll-loss/10 p-3 rounded-xl">
                <AlertTriangle size={18} className="text-ll-loss flex-shrink-0" />
                <p className="text-sm text-ll-loss">全データが削除されます。この操作は元に戻せません。</p>
              </div>
              <div className="flex gap-3">
                <button onClick={handleClear} className="flex-1 bg-ll-loss text-white py-3 rounded-2xl font-bold text-sm active:opacity-80">削除する</button>
                <button onClick={() => setShowClear(false)} className="flex-1 bg-ll-s2 text-ll-ink py-3 rounded-2xl font-bold text-sm border border-ll-line active:bg-ll-line">キャンセル</button>
              </div>
            </div>
          )}
        </Card>

        <div className="text-center text-xs text-ll-dim pb-4">
          <p>80 Break Log</p>
          <p>データはこのブラウザ内にのみ保存されます</p>
        </div>
      </div>

      {/* Club edit modal */}
      {editingClub && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setEditingClub(null)}>
          <div className="absolute inset-0 bg-ll-ink/40" />
          <div className="relative bg-ll-surf rounded-t-3xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-ll-ink text-lg">{editingClub.head ? 'クラブ編集' : 'クラブ追加'}</h3>
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
                className="flex-1 bg-ll-acc text-white py-3 rounded-2xl font-bold disabled:opacity-40 active:opacity-80">保存</button>
              <button onClick={() => setEditingClub(null)} className="flex-1 bg-ll-s2 text-ll-ink py-3 rounded-2xl font-bold border border-ll-line active:bg-ll-line">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* New set modal */}
      {newSetModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setNewSetModal(null)}>
          <div className="absolute inset-0 bg-ll-ink/40" />
          <div className="relative bg-ll-surf rounded-t-3xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-ll-ink text-lg">新規クラブセット</h3>
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
                className="w-4 h-4 accent-ll-acc"
              />
              <span className="text-sm text-ll-ink">現在のセットのクラブをコピーする</span>
            </label>
            <div className="flex gap-3">
              <button onClick={handleCreateSet} disabled={!newSetModal.name.trim()}
                className="flex-1 bg-ll-acc text-white py-3 rounded-2xl font-bold disabled:opacity-40 active:opacity-80">作成して切り替え</button>
              <button onClick={() => setNewSetModal(null)} className="flex-1 bg-ll-s2 text-ll-ink py-3 rounded-2xl font-bold border border-ll-line active:bg-ll-line">キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
