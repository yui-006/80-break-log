import { useApp } from '../context/AppContext';
import { calcLosses, generatePracticeMenu } from '../analytics';
import { Target, CheckCircle2 } from 'lucide-react';

const PRIORITY_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-600', 'bg-blue-500', 'bg-purple-500'];

export function PracticePage() {
  const { state } = useApp();

  const recentRounds = state.rounds
    .filter(r => r.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  if (recentRounds.length === 0) {
    return (
      <div className="min-h-full bg-gray-50">
        <div className="bg-green-800 text-white px-5 pt-12 pb-6">
          <h1 className="text-2xl font-bold">練習メニュー</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Target size={48} className="text-gray-300 mb-3" />
          <p>ラウンドを記録すると</p>
          <p>練習メニューが自動生成されます</p>
        </div>
      </div>
    );
  }

  const losses = calcLosses(recentRounds);
  const menu = generatePracticeMenu(losses);

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-green-800 text-white px-5 pt-12 pb-6">
        <h1 className="text-2xl font-bold">練習メニュー</h1>
        <p className="text-green-200 text-sm mt-1">直近{recentRounds.length}ラウンドの分析から自動生成</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Loss summary */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="font-bold text-gray-900 mb-3">失点ランキング</h2>
          <div className="space-y-2">
            {losses.filter(l => l.count > 0).slice(0, 5).map((l, i) => (
              <div key={l.key} className="flex items-center gap-3">
                <span className={`text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${PRIORITY_COLORS[i]}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-800 truncate">{l.label}</span>
                    <span className="text-sm font-bold text-red-600 ml-2 flex-shrink-0">+{l.estimatedLoss}</span>
                  </div>
                  <p className="text-xs text-gray-400">{l.count}回</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Practice items */}
        {menu.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center text-gray-400">
            <p className="text-sm">ショットログを記録すると</p>
            <p className="text-sm">より詳細な練習メニューが生成されます</p>
          </div>
        ) : (
          <div className="space-y-4">
            {menu.map(item => (
              <div key={item.priority} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className={`px-4 py-2 flex items-center gap-2 ${PRIORITY_COLORS[item.priority - 1]} text-white`}>
                  <span className="font-black text-lg">#{item.priority}</span>
                  <span className="font-bold text-sm">{item.category}</span>
                  <span className="ml-auto text-xs opacity-80">ミス {item.recentMissCount}回</span>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">理由</p>
                    <p className="text-sm text-gray-700">{item.reason}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">練習内容</p>
                    <p className="text-sm font-medium text-gray-900">{item.content}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1.5">チェックリスト</p>
                    <div className="space-y-1.5">
                      {item.checklist.map((c, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center text-xs text-gray-400 pb-2">
          直近5ラウンドのショットデータをもとに自動生成
        </div>
      </div>
    </div>
  );
}
