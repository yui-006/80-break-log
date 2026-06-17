import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { calcMissTendencies, generatePracticeMenu } from '../analytics';
import type { PracticeLogEntry } from '../types';
import { Flame, Plus, Pencil, Trash2 } from 'lucide-react';
import { Modal } from '../components/ui/Modal';

const HEATMAP_WEEKS = 10;

function genId() { return crypto.randomUUID(); }

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayStr(): string { return fmtDate(new Date()); }
function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}
function addWeeks(dateStr: string, n: number): string { return addDays(dateStr, n * 7); }
function getWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return fmtDate(d);
}
function calcWeeklyStreak(logs: PracticeLogEntry[]): number {
  if (logs.length === 0) return 0;
  const weeksWithLogs = new Set(logs.map(l => getWeekStart(l.date)));
  const thisWeek = getWeekStart(todayStr());
  let cursor = weeksWithLogs.has(thisWeek) ? thisWeek : addWeeks(thisWeek, -1);
  if (!weeksWithLogs.has(cursor)) return 0;
  let streak = 0;
  while (weeksWithLogs.has(cursor)) { streak++; cursor = addWeeks(cursor, -1); }
  return streak;
}

function Checkmark() {
  return (
    <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none">
      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type EditForm = { date: string; menuName: string; ballCount: string };

export function PracticePage() {
  const { state, savePracticeMenuItem, deletePracticeMenuItem, savePracticeLog, deletePracticeLog } = useApp();
  const [newMenuName, setNewMenuName] = useState('');
  const [ballInputs, setBallInputs] = useState<Record<string, string>>({});
  const [editingLog, setEditingLog] = useState<PracticeLogEntry | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ date: '', menuName: '', ballCount: '' });

  const recentRounds = state.rounds
    .filter(r => r.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const suggestedMenu = recentRounds.length > 0
    ? generatePracticeMenu(calcMissTendencies(recentRounds))
    : [];

  const today = todayStr();
  const todaysLogs = state.practiceLogs.filter(l => l.date === today);
  const logDates = new Set(state.practiceLogs.map(l => l.date));
  const streak = calcWeeklyStreak(state.practiceLogs);
  const thisWeekStart = getWeekStart(today);
  const weekBallTotal = state.practiceLogs
    .filter(l => getWeekStart(l.date) === thisWeekStart)
    .reduce((s, l) => s + (l.ballCount ?? 0), 0);
  const weekStarts = Array.from({ length: HEATMAP_WEEKS }, (_, i) =>
    addWeeks(thisWeekStart, -(HEATMAP_WEEKS - 1 - i))
  );

  const allLogDays = Array.from(new Set(state.practiceLogs.map(l => l.date)))
    .sort((a, b) => b.localeCompare(a));

  const todayCheckedCount = todaysLogs.length;
  const todayTotalBalls = todaysLogs.reduce((s, l) => s + (l.ballCount ?? 0), 0);

  function findTodayEntry(menuName: string) {
    return todaysLogs.find(l => l.menuName === menuName);
  }

  function getBallInput(menuName: string, entry: PracticeLogEntry | undefined): string {
    if (menuName in ballInputs) return ballInputs[menuName];
    return entry?.ballCount != null ? String(entry.ballCount) : '';
  }

  async function toggleMenu(menuName: string) {
    const existing = findTodayEntry(menuName);
    if (existing) {
      setBallInputs(prev => { const n = { ...prev }; delete n[menuName]; return n; });
      await deletePracticeLog(existing.id);
    } else {
      await savePracticeLog({ id: genId(), date: today, menuName, createdAt: new Date().toISOString() });
    }
  }

  async function commitBallCount(menuName: string) {
    const value = ballInputs[menuName];
    if (value === undefined) return;
    const existing = findTodayEntry(menuName);
    if (!existing) return;
    await savePracticeLog({ ...existing, ballCount: value === '' ? undefined : Number(value) });
    setBallInputs(prev => { const n = { ...prev }; delete n[menuName]; return n; });
  }

  async function handleAddCustomMenu() {
    const name = newMenuName.trim();
    if (!name) return;
    await savePracticeMenuItem({ id: genId(), name, createdAt: new Date().toISOString() });
    setNewMenuName('');
  }

  function openEditModal(log: PracticeLogEntry) {
    setEditingLog(log);
    setEditForm({
      date: log.date,
      menuName: log.menuName,
      ballCount: log.ballCount != null ? String(log.ballCount) : '',
    });
  }

  async function handleSaveEdit() {
    if (!editingLog) return;
    const ballCount = editForm.ballCount === '' ? undefined : Number(editForm.ballCount);
    await savePracticeLog({ ...editingLog, date: editForm.date, menuName: editForm.menuName.trim(), ballCount });
    setEditingLog(null);
  }

  async function handleDeleteEdit() {
    if (!editingLog) return;
    await deletePracticeLog(editingLog.id);
    setEditingLog(null);
  }

  return (
    <div className="min-h-full bg-ll-bg">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ll-ink">練習</h1>
          <p className="text-ll-mute text-xs mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-ll-surf border border-ll-line rounded-xl px-3 py-2">
          <Flame size={15} className={streak > 0 ? 'text-ll-warn' : 'text-ll-dim'} />
          <span className={`text-sm font-bold ${streak > 0 ? 'text-ll-ink' : 'text-ll-dim'}`}>
            {streak > 0 ? `${streak}週` : '−'}
          </span>
        </div>
      </div>

      <div className="px-4 pb-6 space-y-4">

        {/* 今日の練習チェックリスト */}
        <div className="bg-ll-surf border border-ll-line rounded-[22px] overflow-hidden shadow-card">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-ll-line">
            <h2 className="font-bold text-ll-ink text-sm">今日の練習</h2>
            <div className="flex items-center gap-2">
              {todayCheckedCount > 0 && (
                <span className="text-xs text-ll-mute">{todayCheckedCount}件完了</span>
              )}
              {todayTotalBalls > 0 && (
                <span className="text-xs text-ll-good font-bold">{todayTotalBalls}球</span>
              )}
            </div>
          </div>

          {/* AI提案メニュー */}
          {suggestedMenu.map((item, i) => {
            const entry = findTodayEntry(item.category);
            const checked = !!entry;
            return (
              <div
                key={`ai-${i}`}
                className={`flex items-center px-4 border-b border-ll-line/50 min-h-[56px] ${checked ? 'bg-ll-weak' : ''}`}
              >
                <button
                  onClick={() => toggleMenu(item.category)}
                  className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center mr-3 active:scale-95 transition-transform ${checked ? 'bg-ll-acc border-ll-acc' : 'border-ll-line'}`}
                >
                  {checked && <Checkmark />}
                </button>
                <span className={`flex-1 text-sm font-medium min-w-0 truncate ${checked ? 'text-ll-acc' : 'text-ll-ink'}`}>
                  {item.category}
                </span>
                <span className="text-[10px] bg-ll-weak text-ll-acc px-1.5 py-0.5 rounded font-bold mr-2 flex-shrink-0 border border-ll-acc/30">
                  提案
                </span>
                {checked && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={getBallInput(item.category, entry)}
                      onChange={e => setBallInputs(prev => ({ ...prev, [item.category]: e.target.value }))}
                      onBlur={() => commitBallCount(item.category)}
                      placeholder="球数"
                      className="w-16 bg-ll-s2 text-ll-ink text-sm rounded-lg px-2 py-1.5 border border-ll-line text-right placeholder:text-ll-dim"
                    />
                    <span className="text-xs text-ll-mute">球</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* カスタムメニュー */}
          {state.practiceMenuItems.map((m) => {
            const entry = findTodayEntry(m.name);
            const checked = !!entry;
            return (
              <div
                key={m.id}
                className={`flex items-center px-4 border-b border-ll-line/50 min-h-[56px] ${checked ? 'bg-ll-weak' : ''}`}
              >
                <button
                  onClick={() => toggleMenu(m.name)}
                  className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center mr-3 active:scale-95 transition-transform ${checked ? 'bg-ll-acc border-ll-acc' : 'border-ll-line'}`}
                >
                  {checked && <Checkmark />}
                </button>
                <span className={`flex-1 text-sm font-medium min-w-0 truncate ${checked ? 'text-ll-acc' : 'text-ll-ink'}`}>
                  {m.name}
                </span>
                {checked ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={getBallInput(m.name, entry)}
                      onChange={e => setBallInputs(prev => ({ ...prev, [m.name]: e.target.value }))}
                      onBlur={() => commitBallCount(m.name)}
                      placeholder="球数"
                      className="w-16 bg-ll-s2 text-ll-ink text-sm rounded-lg px-2 py-1.5 border border-ll-line text-right placeholder:text-ll-dim"
                    />
                    <span className="text-xs text-ll-mute">球</span>
                  </div>
                ) : (
                  <button
                    onClick={() => deletePracticeMenuItem(m.id)}
                    className="text-ll-dim active:text-ll-loss p-2 flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}

          {suggestedMenu.length === 0 && state.practiceMenuItems.length === 0 && (
            <div className="px-4 py-6 text-center text-ll-dim text-sm">
              下の入力欄からメニューを追加しよう
            </div>
          )}

          {/* メニュー追加 */}
          <div className="flex items-center gap-2 px-4 py-3.5">
            <Plus size={16} className="text-ll-mute flex-shrink-0" />
            <input
              value={newMenuName}
              onChange={e => setNewMenuName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCustomMenu()}
              placeholder="メニューを追加..."
              className="flex-1 bg-transparent text-ll-ink text-sm placeholder:text-ll-dim outline-none"
            />
            {newMenuName.trim() && (
              <button onClick={handleAddCustomMenu} className="text-ll-acc text-sm font-bold flex-shrink-0">
                追加
              </button>
            )}
          </div>
        </div>

        {/* ヒートマップ */}
        <div className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame size={15} className={streak > 0 ? 'text-ll-warn' : 'text-ll-dim'} />
              <span className={`text-sm font-bold ${streak > 0 ? 'text-ll-ink' : 'text-ll-mute'}`}>
                {streak > 0 ? `${streak}週連続で練習中` : '今週から記録を始めよう'}
              </span>
            </div>
            {weekBallTotal > 0 && (
              <span className="text-xs text-ll-mute">今週 {weekBallTotal}球</span>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {weekStarts.map(ws => (
              <div key={ws} className="flex flex-col gap-1 flex-shrink-0">
                {Array.from({ length: 7 }, (_, i) => {
                  const ds = addDays(ws, i);
                  const isFuture = ds > today;
                  const has = logDates.has(ds);
                  return (
                    <div
                      key={ds}
                      title={ds}
                      className={`w-3 h-3 rounded-sm ${isFuture ? 'bg-transparent' : has ? 'bg-ll-acc' : 'bg-ll-s2 border border-ll-line'}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 練習履歴 */}
        {allLogDays.length > 0 && (
          <div className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
            <h2 className="font-bold text-ll-ink text-sm mb-3">練習履歴</h2>
            <div>
              {allLogDays.map((date, di) => {
                const dayLogs = state.practiceLogs
                  .filter(l => l.date === date)
                  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
                return (
                  <div key={date} className={`py-2.5 ${di < allLogDays.length - 1 ? 'border-b border-ll-line' : ''}`}>
                    <p className="text-xs text-ll-mute mb-1.5">{date}</p>
                    <div className="space-y-1.5">
                      {dayLogs.map(log => (
                        <button
                          key={log.id}
                          onClick={() => openEditModal(log)}
                          className="w-full flex items-center justify-between gap-3 active:opacity-60"
                        >
                          <span className="text-sm text-ll-ink text-left flex-1 truncate">{log.menuName}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {log.ballCount != null && (
                              <span className="text-xs text-ll-good">{log.ballCount}球</span>
                            )}
                            <Pencil size={13} className="text-ll-dim" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 編集モーダル */}
      {editingLog && (
        <Modal title="練習記録を編集" onClose={() => setEditingLog(null)}>
          <div className="py-4 space-y-4">
            <div>
              <label className="block text-xs text-ll-mute mb-1.5">日付</label>
              <input
                type="date"
                value={editForm.date}
                onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                className="w-full bg-ll-s2 text-ll-ink rounded-xl px-3 py-2.5 border border-ll-line"
              />
            </div>
            <div>
              <label className="block text-xs text-ll-mute mb-1.5">メニュー名</label>
              <input
                type="text"
                value={editForm.menuName}
                onChange={e => setEditForm(f => ({ ...f, menuName: e.target.value }))}
                className="w-full bg-ll-s2 text-ll-ink rounded-xl px-3 py-2.5 border border-ll-line placeholder:text-ll-dim"
              />
            </div>
            <div>
              <label className="block text-xs text-ll-mute mb-1.5">球数</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editForm.ballCount}
                onChange={e => setEditForm(f => ({ ...f, ballCount: e.target.value }))}
                placeholder="未入力"
                className="w-full bg-ll-s2 text-ll-ink rounded-xl px-3 py-2.5 border border-ll-line placeholder:text-ll-dim"
              />
            </div>
            <button
              onClick={handleSaveEdit}
              disabled={!editForm.date || !editForm.menuName.trim()}
              className="w-full bg-ll-acc text-white py-3 rounded-xl font-bold disabled:opacity-40 active:opacity-80"
            >
              保存
            </button>
            <button
              onClick={handleDeleteEdit}
              className="w-full text-ll-loss py-2.5 rounded-xl text-sm font-medium active:opacity-70"
            >
              この記録を削除
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
