import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { calcScoreStats } from '../analytics';
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
    return <div className="flex items-center justify-center h-full text-gray-400">ラウンドが見つかりません</div>;
  }

  const stats = calcScoreStats(round.holes);
  const clubs = state.clubs.length > 0 ? state.clubs : INITIAL_CLUBS;
  const front = round.holes.filter(h => h.holeNo <= 9);
  const back = round.holes.filter(h => h.holeNo >= 10);

  function scoreDiffColor(score: number | undefined, par: number) {
    if (!score) return 'text-gray-400';
    const d = score - par;
    if (d <= -2) return 'text-yellow-500';
    if (d === -1) return 'text-blue-600';
    if (d === 0) return 'text-green-700';
    if (d === 1) return 'text-gray-900';
    if (d === 2) return 'text-orange-500';
    return 'text-red-600';
  }

  const SubHeader = ({ label }: { label: string }) => (
    <tr className="bg-green-50">
      <td colSpan={7} className="px-3 py-1 text-xs font-bold text-green-800">{label}</td>
    </tr>
  );

  const HoleRow = ({ h }: { h: typeof round.holes[0] }) => (
    <tr
      className="border-b border-gray-100 active:bg-gray-50 cursor-pointer"
      onClick={() => navigate(`/rounds/${roundId}/hole/${h.holeNo}`)}
    >
      <td className="px-3 py-2.5 text-sm font-medium text-gray-500">{h.holeNo}</td>
      <td className="px-2 py-2.5 text-sm text-center text-gray-500">{h.par}</td>
      <td className="px-2 py-2.5 text-sm text-center text-gray-400">{h.yardage ?? '-'}</td>
      <td className={`px-2 py-2.5 text-sm text-center font-bold ${scoreDiffColor(h.score, h.par)}`}>
        {h.score ?? '-'}
      </td>
      <td className="px-2 py-2.5 text-sm text-center text-gray-600">{h.putts ?? '-'}</td>
      <td className="px-2 py-2.5 text-sm text-center text-red-500">{h.ob || '-'}</td>
      <td className="px-2 py-2.5 text-sm text-center text-orange-500">{h.penalty || '-'}</td>
    </tr>
  );

  const SubTotal = ({ holes, label }: { holes: typeof round.holes; label: string }) => {
    const sc = holes.reduce((s, h) => s + (h.score ?? 0), 0);
    const par = holes.reduce((s, h) => s + h.par, 0);
    const putts = holes.reduce((s, h) => s + (h.putts ?? 0), 0);
    const ob = holes.reduce((s, h) => s + (h.ob ?? 0), 0);
    const pen = holes.reduce((s, h) => s + (h.penalty ?? 0), 0);
    return (
      <tr className="bg-gray-50 font-bold">
        <td className="px-3 py-2 text-xs text-gray-600">{label}</td>
        <td className="px-2 py-2 text-xs text-center text-gray-500">{par}</td>
        <td className="px-2 py-2 text-xs text-center text-gray-400">-</td>
        <td className="px-2 py-2 text-xs text-center text-green-800">{sc || '-'}</td>
        <td className="px-2 py-2 text-xs text-center text-gray-600">{putts || '-'}</td>
        <td className="px-2 py-2 text-xs text-center text-red-500">{ob || '-'}</td>
        <td className="px-2 py-2 text-xs text-center text-orange-500">{pen || '-'}</td>
      </tr>
    );
  };

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-green-800 text-white px-4 pt-12 pb-5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-green-200 text-sm mb-2">
          <ChevronLeft size={16} /> 戻る
        </button>
        <h1 className="text-xl font-bold">{round.courseName}</h1>
        <p className="text-green-200 text-sm">{round.date} / {round.teeName}</p>
        <div className="flex gap-6 mt-3">
          <div className="text-center">
            <p className="text-3xl font-black">{stats.totalScore || '-'}</p>
            <p className="text-green-300 text-xs">スコア</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{stats.totalPutts || '-'}</p>
            <p className="text-green-300 text-xs">パット</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-red-300">{stats.totalOB || '-'}</p>
            <p className="text-green-300 text-xs">OB</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-300">{stats.totalPenalty || '-'}</p>
            <p className="text-green-300 text-xs">ペナ</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Scorecard table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 text-gray-500 text-xs">
                <th className="px-3 py-2 text-left">H</th>
                <th className="px-2 py-2">Par</th>
                <th className="px-2 py-2">Y</th>
                <th className="px-2 py-2">Score</th>
                <th className="px-2 py-2">Putt</th>
                <th className="px-2 py-2">OB</th>
                <th className="px-2 py-2">Pen</th>
              </tr>
            </thead>
            <tbody>
              <SubHeader label="前半" />
              {front.map(h => <HoleRow key={h.id} h={h} />)}
              <SubTotal holes={front} label="前半計" />
              <SubHeader label="後半" />
              {back.map(h => <HoleRow key={h.id} h={h} />)}
              <SubTotal holes={back} label="後半計" />
              <tr className="bg-green-800 text-white font-bold">
                <td className="px-3 py-2.5 text-sm">合計</td>
                <td className="px-2 py-2.5 text-sm text-center">{stats.totalPar}</td>
                <td className="px-2 py-2.5 text-sm text-center">-</td>
                <td className="px-2 py-2.5 text-sm text-center">{stats.totalScore || '-'}</td>
                <td className="px-2 py-2.5 text-sm text-center">{stats.totalPutts || '-'}</td>
                <td className="px-2 py-2.5 text-sm text-center">{stats.totalOB || '-'}</td>
                <td className="px-2 py-2.5 text-sm text-center">{stats.totalPenalty || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Advanced stats */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="font-bold text-gray-900 mb-3">詳細統計</h2>
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Par3 平均</span>
              <span className="font-bold">{avg(stats.par3Avg)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Par4 平均</span>
              <span className="font-bold">{avg(stats.par4Avg)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Par5 平均</span>
              <span className="font-bold">{avg(stats.par5Avg)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">3パット</span>
              <span className="font-bold">{stats.threePuttCount}回</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ダブルボギー以上</span>
              <span className="font-bold">{stats.doubleBogeysOrWorse}回</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">ボギーオン率</span>
              <span className="font-bold">{pct(stats.bogeyOnRate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">パーオン率</span>
              <span className="font-bold">{pct(stats.parOnRate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">目標</span>
              <span className="font-bold">{round.targetScore ? `${round.targetScore}打` : '-'}</span>
            </div>
          </div>
        </div>

        {/* Hole detail cards */}
        <div>
          <h2 className="font-bold text-gray-900 mb-3">ホール別詳細</h2>
          <div className="space-y-3">
            {round.holes.map(h => (
              <div key={h.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-green-800 text-white text-xs font-bold px-2 py-1 rounded-lg">
                      H{h.holeNo}
                    </span>
                    <span className="text-sm text-gray-500">Par {h.par}</span>
                    {h.yardage && <span className="text-sm text-gray-400">{h.yardage}y</span>}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`font-bold text-lg ${scoreDiffColor(h.score, h.par)}`}>
                      {h.score ?? '-'}
                    </span>
                    {h.putts != null && <span className="text-gray-500">{h.putts}パット</span>}
                    {(h.ob ?? 0) > 0 && <span className="text-red-500 text-xs">OB×{h.ob}</span>}
                  </div>
                </div>
                {h.memo && <p className="text-xs text-gray-500 mb-2">{h.memo}</p>}
                {h.shots.length > 0 && (
                  <div className="space-y-1 border-t border-gray-100 pt-2">
                    {h.shots.map((s, i) => {
                      const club = clubs.find(c => c.id === s.clubId);
                      return (
                        <div key={s.id} className="flex items-center gap-2 text-xs flex-wrap">
                          <span className="text-gray-400 w-3">{i + 1}</span>
                          {s.shotTypes?.map(t => (
                            <span key={t} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                              {SHOT_TYPE_LABELS[t]}
                            </span>
                          ))}
                          {club && <span className="font-medium text-gray-800">{club.name}</span>}
                          {s.distance && <span className="text-gray-500">{s.distance}y</span>}
                          {s.results?.map(r => (
                            <span key={r} className={['ナイス', '普通', 'ナイスアウト'].includes(r) ? 'text-green-700' : 'text-red-500'}>
                              {r}
                            </span>
                          ))}
                          {s.direction && s.direction !== '真っ直ぐ' && (
                            <span className="text-orange-500">{s.direction}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <button
                  onClick={() => navigate(`/rounds/${roundId}/hole/${h.holeNo}`)}
                  className="mt-2 flex items-center gap-0.5 text-xs text-green-700 font-medium"
                >
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
