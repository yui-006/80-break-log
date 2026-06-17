import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { calcLossesFromHoles } from '../analytics';
import { ChevronLeft } from 'lucide-react';

export function LossDetailPage() {
  const { roundId, lossKey } = useParams<{ roundId: string; lossKey: string }>();
  const navigate = useNavigate();
  const { state } = useApp();

  const round = state.rounds.find(r => r.id === roundId);
  if (!round) {
    return <div className="flex items-center justify-center h-full text-ll-mute">ラウンドが見つかりません</div>;
  }

  const holeEntries = round.holes
    .map(h => {
      const entry = calcLossesFromHoles([h]).find(l => l.key === lossKey);
      return entry && entry.count > 0 ? { hole: h, entry } : null;
    })
    .filter((v): v is { hole: typeof round.holes[0]; entry: ReturnType<typeof calcLossesFromHoles>[0] } => v !== null);

  const label = holeEntries[0]?.entry.label ?? '';
  const total = Math.round(holeEntries.reduce((s, e) => s + e.entry.estimatedLoss, 0) * 10) / 10;

  return (
    <div className="min-h-full bg-ll-bg">
      <div className="bg-ll-surf text-ll-ink px-4 pt-12 pb-5 border-b border-ll-line">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-ll-mute text-sm mb-2">
          <ChevronLeft size={16} /> 戻る
        </button>
        <h1 className="text-xl font-bold text-ll-ink">{label}</h1>
        <p className="text-ll-mute text-sm">{round.courseName} / {round.date}</p>
        <p className="text-ll-loss font-bold text-2xl mt-3">{total}打改善の余地</p>
      </div>

      <div className="px-4 py-4">
        <div className="bg-ll-surf border border-ll-line rounded-[22px] overflow-hidden shadow-card">
          {holeEntries.length === 0 ? (
            <p className="text-ll-mute text-sm text-center py-8">該当するホールはありません</p>
          ) : (
            holeEntries.map(({ hole, entry }) => (
              <div
                key={hole.id}
                className="flex items-center justify-between px-4 py-3 border-b border-ll-line last:border-b-0 cursor-pointer active:bg-ll-s2"
                onClick={() => navigate(`/rounds/${roundId}/hole/${hole.holeNo}`)}
              >
                <div className="flex items-center gap-3">
                  <span className="bg-ll-s2 text-ll-ink text-xs font-bold px-2 py-1 rounded-lg border border-ll-line">H{hole.holeNo}</span>
                  <span className="text-sm text-ll-mute">Par {hole.par}</span>
                  <span className="text-sm font-bold text-ll-ink">{hole.score ?? '-'}</span>
                </div>
                <div className="text-right">
                  <p className="text-ll-loss font-bold text-sm">{entry.estimatedLoss}打</p>
                  <p className="text-ll-mute text-xs">{entry.count}回</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
