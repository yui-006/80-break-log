import { useApp } from '../context/AppContext';
import { calcLosses, generatePracticeMenu } from '../analytics';
import { Target, CheckCircle2 } from 'lucide-react';

const PRIORITY_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-blue-500', 'bg-purple-500'];

export function PracticePage() {
  const { state } = useApp();

  const recentRounds = state.rounds
    .filter(r => r.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  if (recentRounds.length === 0) {
    return (
      <div className="min-h-full bg-[#0f0f0f]">
        <div className="px-5 pt-12 pb-6">
          <h1 className="text-2xl font-bold text-white">練習メニュー</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
          <Target size={48} className="text-zinc-700 mb-3" />
          <p>ラウンドを記録すると</p>
          <p>練習メニューが自動生成されます</p>
        </div>
      </div>
    );
  }

  const losses = calcLosses(recentRounds);
  const menu = generatePracticeMenu(losses);

  return (
    <div className="min-h-full bg-[#0f0f0f]">
      <div className="px-5 pt-12 pb-5">
        <h1 className="text-2xl font-bold text-white">練習メニュー</h1>
        <p className="text-zinc-500 text-sm mt-1">直近{recentRounds.length}ラウンドの分析から自動生成</p>
      </div>

      <div className="px-4 pb-6 space-y-4">
        {/* Loss summary */}
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

        {/* Practice items */}
        {menu.map((item, i) => (
          <div key={i} className="bg-zinc-900 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${PRIORITY_COLORS[i]}`}>
                {item.priority}
              </span>
              <div>
                <h3 className="font-bold text-white text-sm">{item.category}</h3>
                <p className="text-xs text-zinc-500">{item.reason}</p>
              </div>
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
          </div>
        ))}
      </div>
    </div>
  );
}
