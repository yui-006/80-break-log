import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { calcLosses, calcMissTendencies, generatePracticeMenu } from '../analytics';
import { calcScoreStats } from '../analytics';
import { m3TargetRate, m7GIR, m5ThreePutt, m10ParSave, m9FairwayHit, m14LossDistShort, m15LossDirection } from '../lib/metrics';
import { Bell, Flag, ChevronRight, Play, Target, TrendingDown } from 'lucide-react';

function ScoreCircle({ score, par }: { score: number; par: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const fill = Math.max(0.05, Math.min(0.95, (108 - score) / 36));
  const diff = score - par;
  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#27272a" strokeWidth="10" />
        <circle cx="80" cy="80" r={r} fill="none" stroke="#a3e635" strokeWidth="10"
          strokeDasharray={`${circ * fill} ${circ * (1 - fill)}`}
          strokeLinecap="round" />
      </svg>
      <div className="text-center">
        <p className="text-6xl font-black text-white leading-none">{score}</p>
        <p className="text-sm font-bold text-zinc-400 mt-1">
          ({diff >= 0 ? `+${diff}` : diff})
        </p>
      </div>
    </div>
  );
}

export function HomePage() {
  const { state } = useApp();
  const navigate = useNavigate();
  const { rounds } = state;

  const completedRounds = rounds
    .filter(r => r.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date));
  const recordingRound = rounds.find(r => r.status === 'recording');
  const latest = completedRounds[0];
  const latestStats = latest ? calcScoreStats(latest.holes) : null;
  const recentRounds = completedRounds.slice(0, 3);
  const rawLosses = recentRounds.length > 0 ? calcLosses(recentRounds).filter(l => l.count > 0).slice(0, 5) : [];
  const losses = rawLosses.map(l => ({ ...l, perRoundLoss: Math.round(l.estimatedLoss / recentRounds.length * 10) / 10 }));
  const topActions = recentRounds.length > 0 ? generatePracticeMenu(calcMissTendencies(recentRounds)).slice(0, 2) : [];
  const totalLossPotential = Math.round(losses.reduce((s, l) => s + l.perRoundLoss, 0) * 10) / 10;

  const targetRate = m3TargetRate(completedRounds);
  const loss14 = m14LossDistShort(recentRounds);
  const loss15 = m15LossDirection(recentRounds);
  const totalWedgeLoss = Math.round((loss14 + loss15) * 10) / 10;

  return (
    <div className="min-h-full bg-[#0f0f0f]">
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <span className="text-white text-xl font-black tracking-widest">80 BREAK LOG</span>
          <button className="text-zinc-400 active:text-white">
            <Bell size={22} />
          </button>
        </div>
        {targetRate && targetRate.n > 0 && (
          <p className="text-zinc-500 text-xs mt-1">
            目標達成 <span className="text-lime-400 font-bold">{targetRate.hit}/{targetRate.n}</span>R
          </p>
        )}
      </div>

      <div className="px-4 space-y-4 pb-6">
        {/* Recording round banner */}
        {recordingRound && (
          <div
            className="bg-lime-400/10 border border-lime-400/40 rounded-2xl p-4 flex items-center justify-between cursor-pointer active:opacity-80"
            onClick={() => navigate(`/rounds/${recordingRound.id}/hole/1`)}
          >
            <div>
              <p className="text-lime-400 text-xs font-bold tracking-wide uppercase">記録中</p>
              <p className="font-bold text-white mt-0.5">{recordingRound.courseName}</p>
              <p className="text-zinc-500 text-xs">{recordingRound.date}</p>
            </div>
            <div className="flex items-center gap-1 bg-lime-400 text-black px-3 py-2 rounded-xl text-sm font-bold">
              続ける <ChevronRight size={14} />
            </div>
          </div>
        )}

        {/* Latest round */}
        {latestStats ? (
          <div className="bg-zinc-900 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-zinc-500 text-xs font-medium tracking-wide uppercase">最新ラウンド</p>
              <button
                onClick={() => navigate(`/rounds/${latest.id}/scorecard`)}
                className="text-lime-400 text-xs font-medium"
              >
                詳細 →
              </button>
            </div>
            <p className="text-zinc-300 text-sm mb-5">{latest.date} · {latest.courseName}</p>

            <div className="flex justify-center mb-5">
              <ScoreCircle score={latestStats.totalScore} par={latestStats.totalPar} />
            </div>

            <div className="flex justify-around border-t border-zinc-800 pt-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{latestStats.totalPutts}</p>
                <p className="text-xs text-zinc-500 mt-0.5">パット</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{latestStats.totalOB || '−'}</p>
                <p className="text-xs text-zinc-500 mt-0.5">OB</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-400">{latestStats.totalPenalty || '−'}</p>
                <p className="text-xs text-zinc-500 mt-0.5">ペナルティ</p>
              </div>
            </div>

            <div className="mt-3 flex justify-center gap-4 text-xs text-zinc-500">
              <span>前半 {latestStats.frontScore}</span>
              <span>/</span>
              <span>後半 {latestStats.backScore}</span>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-2xl p-8 text-center">
            <Flag size={36} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-white font-bold">まだラウンドがありません</p>
            <p className="text-zinc-500 text-sm mt-1">ラウンドを記録して分析を始めましょう</p>
          </div>
        )}

        {/* 2x2 stats — このR */}
        {latest && (() => {
          const gir = m7GIR(latest.holes);
          const tp  = m5ThreePutt(latest.holes);
          const ps  = m10ParSave(latest.holes);
          const fw  = m9FairwayHit(latest.holes);
          if (!gir && !tp && !ps && !fw) return null;
          return (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-zinc-900 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-white">{gir ? `${gir.hit}/${gir.n}` : '−'}</p>
                <p className="text-xs text-zinc-500 mt-0.5">GIR</p>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-orange-400">{tp ? tp.count : '−'}</p>
                <p className="text-xs text-zinc-500 mt-0.5">3パット</p>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-white">{ps ? `${ps.saved}/${ps.n}` : '−'}</p>
                <p className="text-xs text-zinc-500 mt-0.5">パーセーブ</p>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-white">{fw ? `${fw.hit}/${fw.n}` : '−'}</p>
                <p className="text-xs text-zinc-500 mt-0.5">FWキープ</p>
              </div>
            </div>
          );
        })()}

        {/* Loss ranking */}
        {losses.length > 0 && (
          <div className="bg-zinc-900 rounded-2xl p-5">
            <h2 className="text-white font-bold text-sm tracking-wide mb-1">
              失点ランキング TOP{losses.length}
            </h2>
            <p className="text-zinc-500 text-xs mb-3">
              これらを改善すると、1ラウンドあたり約{totalLossPotential}打スコアが縮まる見込みです
            </p>
            <div className="space-y-2.5">
              {losses.map((l, i) => (
                <div key={l.key} className="flex items-center gap-3">
                  <span className="text-lime-400 font-black text-sm w-4 flex-shrink-0">{i + 1}</span>
                  <span className="flex-1 text-zinc-300 text-sm">{l.label}を無くす</span>
                  <div className="text-right flex-shrink-0">
                    <p className="text-red-400 font-bold text-sm whitespace-nowrap">{l.perRoundLoss}打/R</p>
                    <p className="text-zinc-500 text-xs whitespace-nowrap">現在: {l.perRoundLoss}打/R</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's actions */}
        {topActions.length > 0 && (
          <div className="bg-zinc-900 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Target size={15} className="text-lime-400" />
              <h2 className="text-white font-bold text-sm tracking-wide">今日やるべきアクション・練習</h2>
            </div>
            <div className="space-y-3">
              {topActions.map((item, i) => (
                <div key={i} className="border border-zinc-800 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs bg-lime-400/20 text-lime-400 px-1.5 py-0.5 rounded-md font-bold">#{i + 1}</span>
                    <span className="text-white text-sm font-bold">{item.category}</span>
                  </div>
                  <p className="text-zinc-400 text-xs mb-2">{item.content}</p>
                  <ul className="space-y-1">
                    {item.checklist.slice(0, 2).map((c, j) => (
                      <li key={j} className="text-zinc-500 text-xs flex items-start gap-1.5">
                        <span className="text-lime-400 mt-0.5 flex-shrink-0">✓</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 伸びしろ — m14/m15 ウェッジ */}
        {recentRounds.length > 0 && totalWedgeLoss > 0 && (
          <div className="bg-zinc-900 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={15} className="text-lime-400" />
              <h2 className="text-white font-bold text-sm tracking-wide">ウェッジ伸びしろ</h2>
              <span className="text-zinc-600 text-xs ml-auto">直近{recentRounds.length}R平均</span>
            </div>
            <p className="text-zinc-500 text-xs mb-3">改善で1ラウンド約{totalWedgeLoss}打縮まる見込み</p>
            <div className="space-y-2">
              {loss14 > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 text-sm">距離不足（PW以下）</span>
                  <span className="text-red-400 font-bold text-sm">{loss14}打/R</span>
                </div>
              )}
              {loss15 > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-300 text-sm">方向ミス（PW以下）</span>
                  <span className="text-red-400 font-bold text-sm">{loss15}打/R</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Start round button */}
        <button
          onClick={() => navigate('/record')}
          className="w-full bg-lime-400 text-black py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 active:bg-lime-300"
        >
          <Play size={20} fill="black" />
          ラウンド開始
        </button>

        {/* Recent rounds */}
        {completedRounds.length > 1 && (
          <div className="bg-zinc-900 rounded-2xl p-4">
            <h2 className="text-white font-bold text-sm mb-3">最近のラウンド</h2>
            <div className="space-y-0">
              {completedRounds.slice(1, 5).map((r, i, arr) => {
                const st = calcScoreStats(r.holes);
                const diff = st.totalScore - st.totalPar;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between py-3 cursor-pointer active:opacity-70 ${
                      i < arr.length - 1 ? 'border-b border-zinc-800' : ''
                    }`}
                    onClick={() => navigate(`/rounds/${r.id}/scorecard`)}
                  >
                    <div>
                      <p className="text-white text-sm font-medium">{r.courseName}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">{r.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-white">{st.totalScore}</p>
                      <p className="text-xs text-zinc-500">
                        {diff >= 0 ? `+${diff}` : diff}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
