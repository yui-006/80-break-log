import { useApp } from '../context/AppContext';
import { calcScoreStats, calcLosses, calcClubStats } from '../analytics';
import { INITIAL_CLUBS } from '../data/initial';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer,
} from 'recharts';
import { BarChart2 } from 'lucide-react';

const CHART_GRID = '#27272a';
const CHART_TICK = { fill: '#71717a', fontSize: 10 };
const TOOLTIP_STYLE = { backgroundColor: '#18181b', border: '1px solid #3f3f46', color: '#fff', fontSize: 12 };
const LEGEND_STYLE = { fontSize: 11, color: '#a1a1aa' };

export function AnalysisPage() {
  const { state } = useApp();
  const clubs = state.clubs.length > 0 ? state.clubs : INITIAL_CLUBS;

  const completedRounds = state.rounds
    .filter(r => r.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

  if (completedRounds.length === 0) {
    return (
      <div className="min-h-full bg-[#0f0f0f]">
        <div className="px-5 pt-12 pb-6">
          <h1 className="text-2xl font-bold text-white">分析</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
          <BarChart2 size={48} className="text-zinc-700 mb-3" />
          <p>ラウンドを記録すると分析が表示されます</p>
        </div>
      </div>
    );
  }

  const scoreTrend = completedRounds.map(r => {
    const st = calcScoreStats(r.holes);
    return { date: r.date.slice(5), score: st.totalScore, putts: st.totalPutts, ob: st.totalOB };
  });

  const losses = calcLosses(completedRounds);
  const clubStats = calcClubStats(completedRounds);

  const recentRounds = completedRounds.slice(-3);
  const recentStats = recentRounds.map(r => calcScoreStats(r.holes));
  const avgScore = recentStats.length > 0
    ? Math.round(recentStats.reduce((s, r) => s + r.totalScore, 0) / recentStats.length)
    : null;
  const avgPutts = recentStats.length > 0
    ? Math.round(recentStats.reduce((s, r) => s + r.totalPutts, 0) / recentStats.length * 10) / 10
    : null;

  return (
    <div className="min-h-full bg-[#0f0f0f]">
      <div className="px-5 pt-12 pb-5">
        <h1 className="text-2xl font-bold text-white">分析</h1>
        <p className="text-zinc-500 text-sm mt-1">直近{recentRounds.length}ラウンド平均: {avgScore ?? '-'}打 / {avgPutts ?? '-'}パット</p>
      </div>

      <div className="px-4 pb-6 space-y-5">
        {/* Score trend */}
        <div className="bg-zinc-900 rounded-2xl p-4">
          <h2 className="font-bold text-white mb-3">スコア推移</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={scoreTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="date" tick={CHART_TICK} />
              <YAxis tick={CHART_TICK} domain={['auto', 'auto']} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="score" stroke="#a3e635" strokeWidth={2} dot={{ r: 3 }} name="スコア" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Putts and OB trend */}
        <div className="bg-zinc-900 rounded-2xl p-4">
          <h2 className="font-bold text-white mb-3">パット・OB推移</h2>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={scoreTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="date" tick={CHART_TICK} />
              <YAxis tick={CHART_TICK} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={LEGEND_STYLE} />
              <Line type="monotone" dataKey="putts" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} name="パット" />
              <Line type="monotone" dataKey="ob" stroke="#f87171" strokeWidth={2} dot={{ r: 3 }} name="OB" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Loss analysis */}
        <div className="bg-zinc-900 rounded-2xl p-4">
          <h2 className="font-bold text-white mb-3">失点分析（推定ロス打数）</h2>
          {losses.filter(l => l.count > 0).length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-3">ショットログを記録すると表示されます</p>
          ) : (
            <div className="space-y-3">
              {losses.filter(l => l.count > 0).map(l => (
                <div key={l.key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-300 font-medium">{l.label}</span>
                    <span className="font-bold text-red-400">+{l.estimatedLoss}</span>
                  </div>
                  <div className="bg-zinc-800 rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (l.estimatedLoss / (losses[0]?.estimatedLoss || 1)) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">{l.count}回</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Club usage */}
        {clubStats.length > 0 && (
          <div className="bg-zinc-900 rounded-2xl p-4">
            <h2 className="font-bold text-white mb-3">クラブ別使用回数・ミス率</h2>
            <div className="space-y-2">
              {clubStats.slice(0, 10).map(cs => {
                const club = clubs.find(c => c.id === cs.clubId);
                if (!club) return null;
                const missRate = cs.total > 0 ? cs.missCount / cs.total : 0;
                return (
                  <div key={cs.clubId} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-zinc-300 w-10 flex-shrink-0">{club.name}</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-3 relative">
                      <div className="bg-lime-500 h-3 rounded-full"
                        style={{ width: `${(cs.total / clubStats[0].total) * 100}%` }} />
                      <div className="bg-red-500 h-3 rounded-full absolute top-0 left-0"
                        style={{ width: `${(cs.missCount / clubStats[0].total) * 100}%` }} />
                    </div>
                    <span className="text-xs text-zinc-500 w-20 flex-shrink-0 text-right">
                      {cs.total}回 / ミス{Math.round(missRate * 100)}%
                    </span>
                  </div>
                );
              })}
              <p className="text-xs text-zinc-600 mt-1">緑: 総数 / 赤: ミス</p>
            </div>
          </div>
        )}

        {/* Par breakdown */}
        <div className="bg-zinc-900 rounded-2xl p-4">
          <h2 className="font-bold text-white mb-3">Par別平均スコア差</h2>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart
              data={completedRounds.map(r => {
                const st = calcScoreStats(r.holes);
                return {
                  date: r.date.slice(5),
                  Par3: st.par3Avg !== null ? Math.round(st.par3Avg * 10) / 10 : 0,
                  Par4: st.par4Avg !== null ? Math.round(st.par4Avg * 10) / 10 : 0,
                  Par5: st.par5Avg !== null ? Math.round(st.par5Avg * 10) / 10 : 0,
                };
              })}
              margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="date" tick={CHART_TICK} />
              <YAxis tick={CHART_TICK} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={LEGEND_STYLE} />
              <Bar dataKey="Par3" fill="#60a5fa" name="Par3" />
              <Bar dataKey="Par4" fill="#a3e635" name="Par4" />
              <Bar dataKey="Par5" fill="#fb923c" name="Par5" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Round summary */}
        <div className="bg-zinc-900 rounded-2xl p-4">
          <h2 className="font-bold text-white mb-3">ラウンドサマリー</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="py-1.5 text-left pr-2">日付</th>
                  <th className="py-1.5 text-left pr-3">コース</th>
                  <th className="py-1.5 px-2 text-right">Score</th>
                  <th className="py-1.5 px-2 text-right">前</th>
                  <th className="py-1.5 px-2 text-right">後</th>
                  <th className="py-1.5 px-2 text-right">Putt</th>
                  <th className="py-1.5 px-2 text-right">OB</th>
                  <th className="py-1.5 px-2 text-right">3P</th>
                </tr>
              </thead>
              <tbody>
                {completedRounds.slice().reverse().map(r => {
                  const st = calcScoreStats(r.holes);
                  return (
                    <tr key={r.id} className="border-b border-zinc-800">
                      <td className="py-1.5 pr-2 text-zinc-500">{r.date.slice(5)}</td>
                      <td className="py-1.5 pr-3 text-zinc-300 max-w-[80px] truncate">{r.courseName}</td>
                      <td className="py-1.5 px-2 text-right font-bold text-lime-400">{st.totalScore}</td>
                      <td className="py-1.5 px-2 text-right text-zinc-400">{st.frontScore}</td>
                      <td className="py-1.5 px-2 text-right text-zinc-400">{st.backScore}</td>
                      <td className="py-1.5 px-2 text-right text-zinc-400">{st.totalPutts}</td>
                      <td className="py-1.5 px-2 text-right text-red-400">{st.totalOB || '-'}</td>
                      <td className="py-1.5 px-2 text-right text-orange-400">{st.threePuttCount || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
