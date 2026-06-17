import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { calcScoreStats, calcLossesFromHoles } from '../analytics';
import { isGIR, m7GIR, m5ThreePutt, m10ParSave, m6GirAvgPutts } from '../lib/metrics';
import { SHOT_TYPE_LABELS, INITIAL_CLUBS } from '../data/initial';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function pct(v: number) { return `${Math.round(v * 100)}%`; }
function avg(v: number | null) { return v === null ? '-' : (v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1)); }

export function ScoreCardPage() {
  const { roundId } = useParams<{ roundId: string }>();
  const navigate = useNavigate();
  const { state } = useApp();

  const round = state.rounds.find(r => r.id === roundId);
  if (!round) {
    return <div className="flex items-center justify-center h-full text-ll-mute">ラウンドが見つかりません</div>;
  }

  const stats = calcScoreStats(round.holes);
  const clubs = state.clubs.length > 0 ? state.clubs : INITIAL_CLUBS;
  const front = round.holes.filter(h => h.holeNo <= 9);
  const back = round.holes.filter(h => h.holeNo >= 10);

  function scoreDiffColor(score: number | undefined, par: number) {
    if (!score) return 'text-ll-mute';
    const d = score - par;
    if (d <= -2) return 'text-yellow-600';
    if (d === -1) return 'text-blue-500';
    if (d === 0) return 'text-ll-good';
    if (d === 1) return 'text-ll-ink';
    if (d === 2) return 'text-ll-warn';
    return 'text-ll-loss';
  }

  const holePotential = (h: typeof round.holes[0]) =>
    Math.round(calcLossesFromHoles([h]).reduce((s, l) => s + l.estimatedLoss, 0) * 10) / 10;

  const SubHeader = ({ label }: { label: string }) => (
    <tr className="bg-ll-s2">
      <td colSpan={5} className="px-3 py-1 text-xs font-bold text-ll-mute">{label}</td>
    </tr>
  );

  const HoleRow = ({ h }: { h: typeof round.holes[0] }) => {
    const potential = holePotential(h);
    return (
      <tr className="border-b border-ll-line active:bg-ll-s2 cursor-pointer"
        onClick={() => navigate(`/rounds/${roundId}/hole/${h.holeNo}`)}>
        <td className="px-3 py-2.5 text-sm font-medium text-ll-mute">{h.holeNo}</td>
        <td className="px-2 py-2.5 text-sm text-center text-ll-mute">{h.par}</td>
        <td className={`px-2 py-2.5 text-sm text-center font-bold ${scoreDiffColor(h.score, h.par)}`}>
          {isGIR(h) && <span className="text-ll-good text-xs mr-0.5">●</span>}
          {h.score ?? '-'}
          {h.putts != null && <span className="text-ll-mute font-normal text-xs">({h.putts})</span>}
        </td>
        <td className="px-2 py-2.5 text-sm text-center">
          {(h.ob ?? 0) === 0 && (h.penalty ?? 0) === 0 ? (
            <span className="text-ll-dim">-</span>
          ) : (
            <span className="text-xs">
              {(h.ob ?? 0) > 0 && <span className="text-ll-loss">OB{h.ob}</span>}
              {(h.ob ?? 0) > 0 && (h.penalty ?? 0) > 0 && ' '}
              {(h.penalty ?? 0) > 0 && <span className="text-ll-warn">Pen{h.penalty}</span>}
            </span>
          )}
        </td>
        <td className="px-2 py-2.5 text-sm text-center text-ll-ink font-medium">{potential > 0 ? potential : '-'}</td>
      </tr>
    );
  };

  const SubTotal = ({ holes, label }: { holes: typeof round.holes; label: string }) => {
    const sc = holes.reduce((s, h) => s + (h.score ?? 0), 0);
    const par = holes.reduce((s, h) => s + h.par, 0);
    const putts = holes.reduce((s, h) => s + (h.putts ?? 0), 0);
    const ob = holes.reduce((s, h) => s + (h.ob ?? 0), 0);
    const pen = holes.reduce((s, h) => s + (h.penalty ?? 0), 0);
    const potential = Math.round(holes.reduce((s, h) => s + holePotential(h), 0) * 10) / 10;
    return (
      <tr className="bg-ll-s2 font-bold">
        <td className="px-3 py-2 text-xs text-ll-mute">{label}</td>
        <td className="px-2 py-2 text-xs text-center text-ll-mute">{par}</td>
        <td className="px-2 py-2 text-xs text-center text-ll-good">
          {sc || '-'}{putts > 0 && <span className="text-ll-mute font-normal">({putts})</span>}
        </td>
        <td className="px-2 py-2 text-xs text-center">
          {ob === 0 && pen === 0 ? '-' : (
            <>
              {ob > 0 && <span className="text-ll-loss">OB{ob}</span>}
              {ob > 0 && pen > 0 && ' '}
              {pen > 0 && <span className="text-ll-warn">Pen{pen}</span>}
            </>
          )}
        </td>
        <td className="px-2 py-2 text-xs text-center text-ll-ink">{potential > 0 ? potential : '-'}</td>
      </tr>
    );
  };

  return (
    <div className="min-h-full bg-ll-bg">
      {/* Header */}
      <div className="bg-ll-surf text-ll-ink px-4 pt-12 pb-5 border-b border-ll-line">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-ll-mute text-sm mb-2">
          <ChevronLeft size={16} /> 戻る
        </button>
        <h1 className="text-xl font-bold text-ll-ink">{round.courseName}</h1>
        <p className="text-ll-mute text-sm">{round.date} / {round.teeName}</p>
        <div className="flex gap-6 mt-3">
          <div className="text-center">
            <p className="text-3xl font-black text-ll-ink">{stats.totalScore || '-'}</p>
            <p className="text-ll-mute text-xs">スコア</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-ll-ink">{stats.totalPutts || '-'}</p>
            <p className="text-ll-mute text-xs">パット</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-ll-loss">{stats.totalOB || '-'}</p>
            <p className="text-ll-mute text-xs">OB</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-ll-warn">{stats.totalPenalty || '-'}</p>
            <p className="text-ll-mute text-xs">ペナ</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Scorecard table */}
        <div className="bg-ll-surf border border-ll-line rounded-[22px] overflow-hidden shadow-card">
          <table className="w-full">
            <thead>
              <tr className="bg-ll-s2 text-ll-mute text-xs">
                <th className="px-3 py-2 text-left">H</th>
                <th className="px-2 py-2">Par</th>
                <th className="px-2 py-2">Score</th>
                <th className="px-2 py-2">OB/Pen</th>
                <th className="px-2 py-2">改善打数<span className="font-normal text-ll-mute ml-0.5" title="このホールで失った推定打数">(i)</span></th>
              </tr>
            </thead>
            <tbody>
              <SubHeader label="前半" />
              {front.map(h => <HoleRow key={h.id} h={h} />)}
              <SubTotal holes={front} label="前半計" />
              <SubHeader label="後半" />
              {back.map(h => <HoleRow key={h.id} h={h} />)}
              <SubTotal holes={back} label="後半計" />
              <tr className="bg-ll-acc text-white font-bold">
                <td className="px-3 py-2.5 text-sm">合計</td>
                <td className="px-2 py-2.5 text-sm text-center">{stats.totalPar}</td>
                <td className="px-2 py-2.5 text-sm text-center">
                  {stats.totalScore || '-'}{stats.totalPutts > 0 && <span className="font-normal">({stats.totalPutts})</span>}
                </td>
                <td className="px-2 py-2.5 text-sm text-center">
                  {stats.totalOB === 0 && stats.totalPenalty === 0 ? '-' : (
                    <>
                      {stats.totalOB > 0 && `OB${stats.totalOB}`}
                      {stats.totalOB > 0 && stats.totalPenalty > 0 && ' '}
                      {stats.totalPenalty > 0 && `Pen${stats.totalPenalty}`}
                    </>
                  )}
                </td>
                <td className="px-2 py-2.5 text-sm text-center">
                  {Math.round(round.holes.reduce((s, h) => s + holePotential(h), 0) * 10) / 10 || '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Shot stats: GIR / par-save / 3-putt / GIR avg putts */}
        {(() => {
          const gir    = m7GIR(round.holes);
          const ps     = m10ParSave(round.holes);
          const tp     = m5ThreePutt(round.holes);
          const girAvg = m6GirAvgPutts(round.holes);
          if (!gir && !ps && !tp && girAvg == null) return null;
          return (
            <div className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
              <h2 className="font-bold text-ll-ink mb-3">ショット統計</h2>
              <div className="grid grid-cols-2 gap-2">
                {gir && (
                  <div className="bg-ll-s2 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-ll-ink">{gir.hit}/{gir.n}</p>
                    <p className="text-xs text-ll-mute mt-0.5">GIR（パーオン）</p>
                  </div>
                )}
                {ps && (
                  <div className="bg-ll-s2 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-ll-ink">{ps.saved}/{ps.n}</p>
                    <p className="text-xs text-ll-mute mt-0.5">パーセーブ</p>
                  </div>
                )}
                {tp && (
                  <div className="bg-ll-s2 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-ll-warn">{tp.count}/{tp.n}</p>
                    <p className="text-xs text-ll-mute mt-0.5">3パット</p>
                  </div>
                )}
                {girAvg != null && (
                  <div className="bg-ll-s2 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-ll-good">{girAvg.toFixed(1)}</p>
                    <p className="text-xs text-ll-mute mt-0.5">GIR平均パット</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Loss summary */}
        {(() => {
          const roundLosses = calcLossesFromHoles(round.holes).filter(l => l.count > 0);
          if (roundLosses.length === 0) return null;
          return (
            <div className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
              <h2 className="font-bold text-ll-ink mb-3">改善ポイント</h2>
              <div className="space-y-2">
                {roundLosses.map(l => (
                  <div
                    key={l.key}
                    className="flex items-center gap-3 cursor-pointer active:opacity-70"
                    onClick={() => navigate(`/rounds/${roundId}/loss/${l.key}`)}
                  >
                    <span className="flex-1 text-ll-ink text-sm">{l.label}が改善されたら後</span>
                    <span className="text-ll-loss font-bold text-sm whitespace-nowrap">{l.estimatedLoss}打改善</span>
                    <ChevronRight size={14} className="text-ll-dim" />
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Advanced stats */}
        <div className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
          <h2 className="font-bold text-ll-ink mb-3">詳細統計</h2>
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm">
            {[
              ['Par3 平均', avg(stats.par3Avg)],
              ['Par4 平均', avg(stats.par4Avg)],
              ['Par5 平均', avg(stats.par5Avg)],
              ['3パット', `${stats.threePuttCount}回`],
              ['ダブルボギー以上', `${stats.doubleBogeysOrWorse}回`],
              ['ボギーオン率', pct(stats.bogeyOnRate)],
              ['パーオン率', pct(stats.parOnRate)],
              ['目標', round.targetScore ? `${round.targetScore}打` : '-'],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between">
                <span className="text-ll-mute">{label}</span>
                <span className="font-bold text-ll-ink">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hole detail cards */}
        <div>
          <h2 className="font-bold text-ll-ink mb-3">ホール別詳細</h2>
          <div className="space-y-3">
            {round.holes.map(h => (
              <div key={h.id} className="bg-ll-surf border border-ll-line rounded-[22px] p-4 shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-ll-acc text-white text-xs font-bold px-2 py-1 rounded-lg">H{h.holeNo}</span>
                    <span className="text-sm text-ll-mute">Par {h.par}</span>
                    {h.yardage && <span className="text-sm text-ll-dim">{h.yardage}y</span>}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`font-bold text-lg ${scoreDiffColor(h.score, h.par)}`}>{h.score ?? '-'}</span>
                    {h.putts != null && <span className="text-ll-mute">{h.putts}パット</span>}
                    {(h.ob ?? 0) > 0 && <span className="text-ll-loss text-xs">OB×{h.ob}</span>}
                  </div>
                </div>
                {h.memo && <p className="text-xs text-ll-mute mb-2">{h.memo}</p>}
                {(() => {
                  const holeLosses = calcLossesFromHoles([h]).filter(l => l.count > 0);
                  if (holeLosses.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {holeLosses.map(l => (
                        <span key={l.key} className="bg-ll-loss/10 text-ll-loss text-xs px-2 py-0.5 rounded-md">
                          {l.label}が改善されたら後{l.estimatedLoss}打改善
                        </span>
                      ))}
                    </div>
                  );
                })()}
                {h.shots.length > 0 && (
                  <div className="space-y-1 border-t border-ll-line pt-2">
                    {h.shots.map((s, i) => {
                      const club = clubs.find(c => c.id === s.clubId);
                      return (
                        <div key={s.id} className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="text-ll-dim w-3">{i + 1}</span>
                          {s.shotTypes?.map(t => (
                            <span key={t} className="bg-ll-s2 text-ll-mute px-1.5 py-0.5 rounded border border-ll-line">{SHOT_TYPE_LABELS[t]}</span>
                          ))}
                          {club && <span className="font-medium text-ll-ink">{club.name}</span>}
                          {s.distance && <span className="text-ll-mute">{s.distance}y</span>}
                          {s.results?.map(r => (
                            <span key={r} className={['ナイス', 'OK', '狙い通り', 'ナイスアウト'].includes(r) ? 'text-ll-good' : 'text-ll-loss'}>
                              {r}
                            </span>
                          ))}
                          {s.direction && s.direction !== '真っ直ぐ' && <span className="text-ll-warn">{s.direction}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <button onClick={() => navigate(`/rounds/${roundId}/hole/${h.holeNo}`)}
                  className="mt-2 flex items-center gap-0.5 text-xs text-ll-acc font-medium">
                  修正 <ChevronRight size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
