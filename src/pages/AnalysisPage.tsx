import { useApp } from '../context/AppContext';
import { calcScoreStats, calcLosses, calcMissTendencies, calcMissTrend, calcClubStats, calcClubDistanceStats } from '../analytics';
import type { ClubStat } from '../analytics';
import { m7GIR, m10ParSave } from '../lib/metrics';
import { INITIAL_CLUBS, CLUB_ORDER } from '../data/initial';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer,
} from 'recharts';
import { BarChart2 } from 'lucide-react';

const CHART_GRID = '#E2E8DC';
const CHART_TICK = { fill: '#56635A', fontSize: 10 };
const TOOLTIP_STYLE = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8DC', color: '#19241D', fontSize: 12 };
const LEGEND_STYLE = { fontSize: 11, color: '#56635A' };

export function AnalysisPage() {
  const { state } = useApp();
  const clubs = state.clubs.length > 0 ? state.clubs : INITIAL_CLUBS;

  const completedRounds = state.rounds
    .filter(r => r.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

  if (completedRounds.length === 0) {
    return (
      <div className="min-h-full bg-ll-bg">
        <div className="px-5 pt-12 pb-6">
          <h1 className="text-2xl font-bold text-ll-ink">分析</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-ll-dim">
          <BarChart2 size={48} className="text-ll-dim mb-3" />
          <p>ラウンドを記録すると分析が表示されます</p>
        </div>
      </div>
    );
  }

  const scoreTrend = completedRounds.map(r => {
    const st  = calcScoreStats(r.holes);
    const gir = m7GIR(r.holes);
    const ps  = m10ParSave(r.holes);
    return {
      date:   r.date.slice(5),
      score:  st.totalScore,
      putts:  st.totalPutts,
      ob:     st.totalOB,
      girPct: gir && gir.n > 0 ? Math.round(gir.hit / gir.n * 100) : null,
      psPct:  ps  && ps.n  > 0 ? Math.round(ps.saved / ps.n  * 100) : null,
    };
  });

  const losses = calcLosses(completedRounds);
  const clubOrder = new Map(CLUB_ORDER.map((id, i) => [id, i]));
  const clubStats = calcClubStats(completedRounds)
    .slice()
    .sort((a, b) => (clubOrder.get(a.clubId) ?? 999) - (clubOrder.get(b.clubId) ?? 999));

  const topMissTendencies = calcMissTendencies(completedRounds).filter(l => l.count > 0).slice(0, 4);
  const missTrendRounds = completedRounds.slice(-8);
  const missTrendData = calcMissTrend(missTrendRounds);
  const MISS_TREND_COLORS = ['#B5503D', '#C2873B', '#C2873B', '#3E9A6E'];

  const recentRounds = completedRounds.slice(-3);
  const recentStats = recentRounds.map(r => calcScoreStats(r.holes));
  const avgScore = recentStats.length > 0
    ? Math.round(recentStats.reduce((s, r) => s + r.totalScore, 0) / recentStats.length)
    : null;
  const avgPutts = recentStats.length > 0
    ? Math.round(recentStats.reduce((s, r) => s + r.totalPutts, 0) / recentStats.length * 10) / 10
    : null;

  const distanceStats = calcClubDistanceStats(recentRounds)
    .slice()
    .sort((a, b) => (clubOrder.get(a.clubId) ?? 999) - (clubOrder.get(b.clubId) ?? 999));

  return (
    <div className="min-h-full bg-ll-bg">
      <div className="px-5 pt-12 pb-5">
        <h1 className="text-2xl font-bold text-ll-ink">分析</h1>
        <p className="text-ll-mute text-sm mt-1">直近{recentRounds.length}ラウンド平均: {avgScore ?? '-'}打 / {avgPutts ?? '-'}パット</p>
      </div>

      <div className="px-4 pb-6 space-y-5">
        {/* Loss analysis */}
        <div className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
          <h2 className="font-bold text-ll-ink mb-3">失点分析（推定ロス打数）</h2>
          {losses.filter(l => l.count > 0).length === 0 ? (
            <p className="text-sm text-ll-mute text-center py-3">ショットログを記録すると表示されます</p>
          ) : (
            <div className="space-y-3">
              {losses.filter(l => l.count > 0).map(l => (
                <div key={l.key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-ll-ink font-medium">{l.label}</span>
                    <span className="font-bold text-ll-loss">+{l.estimatedLoss}</span>
                  </div>
                  <div className="bg-ll-s2 rounded-full h-2">
                    <div className="bg-ll-loss h-2 rounded-full"
                      style={{ width: `${Math.min(100, (l.estimatedLoss / (losses[0]?.estimatedLoss || 1)) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-ll-mute mt-0.5">{l.count}回</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Miss tendency trend */}
        {topMissTendencies.length > 0 && (
          <div className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
            <h2 className="font-bold text-ll-ink mb-1">ミス傾向の推移</h2>
            <p className="text-ll-mute text-xs mb-3">よく出るミスがラウンドごとに増えているか減っているか</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={missTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="date" tick={CHART_TICK} />
                <YAxis tick={CHART_TICK} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                {topMissTendencies.map((l, i) => (
                  <Line key={l.key} type="monotone" dataKey={l.key} stroke={MISS_TREND_COLORS[i]} strokeWidth={2} dot={{ r: 3 }} name={l.label} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Score trend */}
        <div className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
          <h2 className="font-bold text-ll-ink mb-3">スコア推移</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={scoreTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="date" tick={CHART_TICK} />
              <YAxis tick={CHART_TICK} domain={['auto', 'auto']} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="score" stroke="#3E9A6E" strokeWidth={2} dot={{ r: 3 }} name="スコア" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* GIR / par-save trend */}
        {scoreTrend.some(d => d.girPct != null) && (
          <div className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
            <h2 className="font-bold text-ll-ink mb-3">GIR・パーセーブ推移 (%)</h2>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={scoreTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="date" tick={CHART_TICK} />
                <YAxis tick={CHART_TICK} domain={[0, 100]} unit="%" />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v}%`} />
                <Legend wrapperStyle={LEGEND_STYLE} />
                <Line type="monotone" dataKey="girPct" stroke="#3E9A6E" strokeWidth={2} dot={{ r: 3 }} name="GIR%" connectNulls />
                <Line type="monotone" dataKey="psPct" stroke="#2F6B4F" strokeWidth={2} dot={{ r: 3 }} name="パーセーブ%" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Putts and OB trend */}
        <div className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
          <h2 className="font-bold text-ll-ink mb-3">パット・OB推移</h2>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={scoreTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis dataKey="date" tick={CHART_TICK} />
              <YAxis tick={CHART_TICK} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={LEGEND_STYLE} />
              <Line type="monotone" dataKey="putts" stroke="#3E9A6E" strokeWidth={2} dot={{ r: 3 }} name="パット" />
              <Line type="monotone" dataKey="ob" stroke="#B5503D" strokeWidth={2} dot={{ r: 3 }} name="OB" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Club usage */}
        {clubStats.length > 0 && (
          <div className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
            <h2 className="font-bold text-ll-ink mb-1">クラブ別総評</h2>
            <div className="flex gap-3 text-xs text-ll-mute mb-3">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-ll-good inline-block" />ナイス</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-ll-acc inline-block" />OK</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-ll-warn inline-block" />ややミス</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-ll-loss inline-block" />ミス</span>
            </div>
            <div className="space-y-3">
              {clubStats.slice(0, 13).map((cs: ClubStat) => {
                const club = clubs.find(c => c.id === cs.clubId);
                if (!club) return null;
                const t = cs.souhyoTotal;
                const exact = (n: number) => t > 0 ? n / t * 100 : 0;
                const pct = (n: number) => t > 0 ? Math.round(n / t * 100) : 0;
                const hasEval = t > 0;
                return (
                  <div key={cs.clubId}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-ll-ink w-8 flex-shrink-0">{club.name}</span>
                      <span className="text-xs text-ll-mute">{cs.total}回</span>
                      {hasEval && (
                        <span className="text-sm font-black text-ll-good ml-auto">ナイス率 {pct(cs.niceCount)}%</span>
                      )}
                    </div>
                    {hasEval ? (
                      <>
                        <div className="flex rounded-full overflow-hidden h-2.5 bg-ll-s2">
                          {cs.niceCount > 0 && <div className="bg-ll-good h-full" style={{ width: `${exact(cs.niceCount)}%` }} />}
                          {cs.okCount > 0 && <div className="bg-ll-acc h-full" style={{ width: `${exact(cs.okCount)}%` }} />}
                          {cs.yamamisuCount > 0 && <div className="bg-ll-warn h-full" style={{ width: `${exact(cs.yamamisuCount)}%` }} />}
                          {cs.misuCount > 0 && <div className="bg-ll-loss h-full" style={{ width: `${exact(cs.misuCount)}%` }} />}
                        </div>
                        <div className="flex gap-3 mt-1">
                          {cs.niceCount > 0 && <span className="text-xs text-ll-good">{pct(cs.niceCount)}%</span>}
                          {cs.okCount > 0 && <span className="text-xs text-ll-acc">{pct(cs.okCount)}%</span>}
                          {cs.yamamisuCount > 0 && <span className="text-xs text-ll-warn">{pct(cs.yamamisuCount)}%</span>}
                          {cs.misuCount > 0 && <span className="text-xs text-ll-loss">{pct(cs.misuCount)}%</span>}
                        </div>
                      </>
                    ) : (
                      <div className="h-2.5 rounded-full bg-ll-s2" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Club distance stats */}
        {distanceStats.length > 0 && (
          <div className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
            <h2 className="font-bold text-ll-ink mb-1">クラブ別飛距離（フルショット）</h2>
            <p className="text-ll-mute text-xs mb-3">直近{recentRounds.length}ラウンド</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-max">
                <thead>
                  <tr className="text-ll-mute border-b border-ll-line">
                    <th className="py-1.5 text-left pr-3">クラブ</th>
                    <th className="py-1.5 px-2 text-right">本数</th>
                    <th className="py-1.5 px-2 text-right">最大</th>
                    <th className="py-1.5 px-2 text-right">最小</th>
                    <th className="py-1.5 px-2 text-right">平均</th>
                    <th className="py-1.5 px-2 text-right">中央値</th>
                  </tr>
                </thead>
                <tbody>
                  {distanceStats.map(ds => {
                    const club = clubs.find(c => c.id === ds.clubId);
                    return (
                      <tr key={ds.clubId} className="border-b border-ll-line">
                        <td className="py-1.5 pr-3 text-ll-ink font-bold">{club?.name ?? ds.clubId}</td>
                        <td className="py-1.5 px-2 text-right text-ll-mute">{ds.count}</td>
                        <td className="py-1.5 px-2 text-right text-ll-good">{ds.max}y</td>
                        <td className="py-1.5 px-2 text-right text-ll-mute">{ds.min}y</td>
                        <td className="py-1.5 px-2 text-right text-ll-ink">{ds.avg}y</td>
                        <td className="py-1.5 px-2 text-right text-ll-ink">{ds.median}y</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Par breakdown */}
        <div className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
          <h2 className="font-bold text-ll-ink mb-3">Par別平均スコア差</h2>
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
              <Bar dataKey="Par3" fill="#2F6B4F" name="Par3" />
              <Bar dataKey="Par4" fill="#3E9A6E" name="Par4" />
              <Bar dataKey="Par5" fill="#C2873B" name="Par5" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Round summary */}
        <div className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
          <h2 className="font-bold text-ll-ink mb-3">ラウンドサマリー</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="text-ll-mute border-b border-ll-line">
                  <th className="py-1.5 text-left pr-2">日付</th>
                  <th className="py-1.5 text-left pr-3">コース</th>
                  <th className="py-1.5 px-2 text-right">Score</th>
                  <th className="py-1.5 px-2 text-right">前</th>
                  <th className="py-1.5 px-2 text-right">後</th>
                  <th className="py-1.5 px-2 text-right">Putt</th>
                  <th className="py-1.5 px-2 text-right">OB</th>
                  <th className="py-1.5 px-2 text-right">3P</th>
                  <th className="py-1.5 px-2 text-right">GIR</th>
                </tr>
              </thead>
              <tbody>
                {completedRounds.slice().reverse().map(r => {
                  const st  = calcScoreStats(r.holes);
                  const gir = m7GIR(r.holes);
                  return (
                    <tr key={r.id} className="border-b border-ll-line">
                      <td className="py-1.5 pr-2 text-ll-mute">{r.date.slice(5)}</td>
                      <td className="py-1.5 pr-3 text-ll-ink max-w-[80px] truncate">{r.courseName}</td>
                      <td className="py-1.5 px-2 text-right font-bold text-ll-good">{st.totalScore}</td>
                      <td className="py-1.5 px-2 text-right text-ll-mute">{st.frontScore}</td>
                      <td className="py-1.5 px-2 text-right text-ll-mute">{st.backScore}</td>
                      <td className="py-1.5 px-2 text-right text-ll-mute">{st.totalPutts}</td>
                      <td className="py-1.5 px-2 text-right text-ll-loss">{st.totalOB || '-'}</td>
                      <td className="py-1.5 px-2 text-right text-ll-warn">{st.threePuttCount || '-'}</td>
                      <td className="py-1.5 px-2 text-right text-ll-good">{gir ? `${gir.hit}/${gir.n}` : '-'}</td>
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
