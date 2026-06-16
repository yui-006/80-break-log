import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { calcLosses, calcMissTendencies, generatePracticeMenu } from '../analytics';
import type { PracticeLogEntry } from '../types';
import { Target, CheckCircle2, Circle, Flame, Plus, Trash2 } from 'lucide-react';

const PRIORITY_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-blue-500', 'bg-purple-500'];
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

// 当週(未記録でも可)または前週まで遡って、連続して練習記録のある週数を数える
function calcWeeklyStreak(logs: PracticeLogEntry[]): number {
  if (logs.length === 0) return 0;
  const weeksWithLogs = new Set(logs.map(l => getWeekStart(l.date)));
  const thisWeek = getWeekStart(todayStr());
  let cursor = weeksWithLogs.has(thisWeek) ? thisWeek : addWeeks(thisWeek, -1);
  if (!weeksWithLogs.has(cursor)) return 0;
  let streak = 0;
  while (weeksWithLogs.has(cursor)) {
    streak++;
    cursor = addWeeks(cursor, -1);
  }
  return streak;
}

export function PracticePage() {
  const { state, savePracticeMenuItem, deletePracticeMenuItem, savePracticeLog, deletePracticeLog } = useApp();
  const [newMenuName, setNewMenuName] = useState('');

  const recentRounds = state.rounds
    .filter(r => r.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const losses = recentRounds.length > 0 ? calcLosses(recentRounds) : [];
  const menu = recentRounds.length > 0 ? generatePracticeMenu(calcMissTendencies(recentRounds)) : [];

  const today = todayStr();
  const todaysLogs = state.practiceLogs.filter(l => l.date === today);
  const logDates = new Set(state.practiceLogs.map(l => l.date));
  const streak = calcWeeklyStreak(state.practiceLogs);
  const thisWeekStart = getWeekStart(today);
  const weekBallTotal = state.practiceLogs
    .filter(l => getWeekStart(l.date) === thisWeekStart)
    .reduce((s, l) => s + (l.ballCount ?? 0), 0);
  const weekStarts = Array.from({ length: HEATMAP_WEEKS }, (_, i) => addWeeks(thisWeekStart, -(HEATMAP_WEEKS - 1 - i)));

  function findTodayEntry(menuName: string) {
    return todaysLogs.find(l => l.menuName === menuName);
  }

  async function toggleMenu(menuName: string) {
    const existing = findTodayEntry(menuName);
    if (existing) {
      await deletePracticeLog(existing.id);
    } else {
      await savePracticeLog({ id: genId(), date: today, menuName, createdAt: new Date().toISOString() });
    }
  }

  async function updateBallCount(menuName: string, value: string) {
    const existing = findTodayEntry(menuName);
    if (!existing) return;
    await savePracticeLog({ ...existing, ballCount: value === '' ? undefined : Number(value) });
  }

  async function handleAddCustomMenu() {
    const name = newMenuName.trim();
    if (!name) return;
    await savePracticeMenuItem({ id: genId(), name, createdAt: new Date().toISOString() });
    setNewMenuName('');
  }

  const recentLogDays = Array.from(new Set(state.practiceLogs.map(l => l.date)))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 14);

  return (
    <div className="min-h-full bg-[#0f0f0f]">
      <div className="px-5 pt-12 pb-5">
        <h1 className="text-2xl font-bold text-white">練習</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {recentRounds.length > 0 ? `直近${recentRounds.length}ラウンドの分析から自動生成` : 'ラウンドを記録すると分析からも練習メニューが提案されます'}
        </p>
      </div>

      <div className="px-4 pb-6 space-y-4">
        {/* Streak & heatmap */}
        <div className="bg-zinc-900 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame size={18} className={streak > 0 ? 'text-orange-400' : 'text-zinc-600'} />
              <span className="text-white font-bold text-sm">{streak > 0 ? `${streak}週連続で練習中` : '今週から記録を始めよう'}</span>
            </div>
            <span className="text-xs text-zinc-500">今週 {weekBallTotal}球</span>
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
                      className={`w-3 h-3 rounded-sm ${isFuture ? 'bg-transparent' : has ? 'bg-lime-400' : 'bg-zinc-800'}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Loss summary */}
        {losses.filter(l => l.count > 0).length > 0 && (
          <div className="bg-zinc-900 rounded-2xl p-4">
            <h2 className="font-bold text-white mb-3">失点ランキング</h2>
            <div className="space-y-2">
              {losses.filter(l => l.count > 0).slice(0, 5).map((l, i) => (
                <div key={l.key} className="flex items-center gap-3">
                  <span className={`text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${PRIORITY_COLORS[i]}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-zinc-300">{l.label}</span>
                      <span className="font-bold text-red-400">+{l.estimatedLoss}</span>
                    </div>
                    <div className="bg-zinc-800 rounded-full h-1.5">
                      <div
                        className="bg-red-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, (l.estimatedLoss / (losses[0]?.estimatedLoss || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested practice items w/ logging */}
        {menu.map((item, i) => {
          const entry = findTodayEntry(item.category);
          const checked = !!entry;
          return (
            <div key={i} className="bg-zinc-900 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${PRIORITY_COLORS[i]}`}>
                  {item.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white text-sm">{item.category}</h3>
                  <p className="text-xs text-zinc-500">{item.reason}</p>
                </div>
                <button onClick={() => toggleMenu(item.category)} className="flex-shrink-0 active:opacity-70">
                  {checked
                    ? <CheckCircle2 size={26} className="text-lime-400" />
                    : <Circle size={26} className="text-zinc-600" />}
                </button>
              </div>
              <div className="bg-zinc-800 rounded-xl p-3 mb-3">
                <p className="text-sm font-medium text-lime-400">{item.content}</p>
              </div>
              <div className="space-y-1.5">
                {item.checklist.map((c, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="text-zinc-600 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-zinc-400">{c}</span>
                  </div>
                ))}
              </div>
              {checked && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800">
                  <label className="text-xs text-zinc-500">球数</label>
                  <input
                    type="number"
                    value={entry?.ballCount ?? ''}
                    onChange={e => updateBallCount(item.category, e.target.value)}
                    placeholder="0"
                    className="w-20 bg-zinc-800 text-white text-sm rounded-lg px-2 py-1 border border-zinc-700"
                  />
                  <span className="text-xs text-zinc-500">球</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Custom menu */}
        <div className="bg-zinc-900 rounded-2xl p-4">
          <h2 className="font-bold text-white mb-3">自分の練習メニュー</h2>
          <div className="space-y-2 mb-3">
            {state.practiceMenuItems.length === 0 && (
              <p className="text-xs text-zinc-500">メニューを追加して記録しましょう</p>
            )}
            {state.practiceMenuItems.map(m => {
              const entry = findTodayEntry(m.name);
              const checked = !!entry;
              return (
                <div key={m.id} className="flex items-center gap-3 border-b border-zinc-800 pb-2 last:border-0 last:pb-0">
                  <button onClick={() => toggleMenu(m.name)} className="flex-shrink-0 active:opacity-70">
                    {checked
                      ? <CheckCircle2 size={22} className="text-lime-400" />
                      : <Circle size={22} className="text-zinc-600" />}
                  </button>
                  <span className="flex-1 text-sm text-zinc-300 min-w-0 truncate">{m.name}</span>
                  {checked && (
                    <input
                      type="number"
                      value={entry?.ballCount ?? ''}
                      onChange={e => updateBallCount(m.name, e.target.value)}
                      placeholder="球数"
                      className="w-16 bg-zinc-800 text-white text-xs rounded-lg px-2 py-1 border border-zinc-700 flex-shrink-0"
                    />
                  )}
                  <button onClick={() => deletePracticeMenuItem(m.id)} className="text-zinc-600 active:text-red-400 flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              value={newMenuName}
              onChange={e => setNewMenuName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCustomMenu()}
              placeholder="例: アプローチ50球"
              className="flex-1 bg-zinc-800 text-white text-sm rounded-xl px-3 py-2 border border-zinc-700 placeholder:text-zinc-500"
            />
            <button onClick={handleAddCustomMenu} className="bg-lime-400 text-black px-3 rounded-xl font-bold flex items-center gap-1 text-sm flex-shrink-0">
              <Plus size={16} /> 追加
            </button>
          </div>
        </div>

        {/* History */}
        {recentLogDays.length > 0 && (
          <div className="bg-zinc-900 rounded-2xl p-4">
            <h2 className="font-bold text-white mb-3">練習履歴</h2>
            <div className="space-y-2">
              {recentLogDays.map(date => {
                const dayLogs = state.practiceLogs.filter(l => l.date === date);
                const totalBalls = dayLogs.reduce((s, l) => s + (l.ballCount ?? 0), 0);
                return (
                  <div key={date} className="flex items-start justify-between gap-3 text-sm border-b border-zinc-800 pb-2 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-zinc-300 font-medium">{date}</p>
                      <p className="text-xs text-zinc-500 truncate">{dayLogs.map(l => l.menuName).join(' / ')}</p>
                    </div>
                    {totalBalls > 0 && <span className="text-xs text-lime-400 flex-shrink-0">{totalBalls}球</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {recentRounds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
            <Target size={36} className="text-zinc-700 mb-2" />
            <p className="text-sm text-center">ラウンドを記録すると失点に基づく練習メニューが自動生成されます</p>
          </div>
        )}
      </div>
    </div>
  );
}
