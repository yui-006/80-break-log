import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { calcScoreStats, calcLosses } from '../analytics';
import { Card } from '../components/ui/Card';
import { Flag, PlayCircle, BarChart2, ChevronRight } from 'lucide-react';

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
  const latestLosses = latest ? calcLosses([latest]).slice(0, 3) : [];

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-green-800 text-white px-5 pt-12 pb-6">
        <p className="text-green-200 text-sm font-medium">80 Break Log</p>
        <h1 className="text-2xl font-bold mt-1">ダッシュボード</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Recording round banner */}
        {recordingRound && (
          <Card
            className="border-2 border-green-600 p-4"
            onClick={() => navigate(`/rounds/${recordingRound.id}/hole/1`)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700 font-medium">記録中</p>
                <p className="font-bold text-gray-900">{recordingRound.courseName}</p>
                <p className="text-sm text-gray-500">{recordingRound.date}</p>
              </div>
              <div className="flex items-center gap-1 bg-green-800 text-white px-3 py-2 rounded-xl text-sm font-bold">
                続きを入力
                <ChevronRight size={16} />
              </div>
            </div>
          </Card>
        )}

        {/* Latest round stats */}
        {latestStats ? (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500">{latest.date} / {latest.courseName}</p>
                <p className="text-sm text-gray-500">{latest.teeName ?? ''}</p>
              </div>
              <button
                onClick={() => navigate(`/rounds/${latest.id}/scorecard`)}
                className="text-green-700 text-xs font-medium"
              >
                詳細 →
              </button>
            </div>
            <div className="flex gap-4 justify-around">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-800">{latestStats.totalScore}</p>
                <p className="text-xs text-gray-500">スコア</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-800">{latestStats.totalPutts}</p>
                <p className="text-xs text-gray-500">パット</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">{latestStats.totalOB}</p>
                <p className="text-xs text-gray-500">OB</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-500">{latestStats.totalPenalty}</p>
                <p className="text-xs text-gray-500">ペナルティ</p>
              </div>
            </div>
            <div className="mt-3 text-center text-sm text-gray-500">
              前半 {latestStats.frontScore} / 後半 {latestStats.backScore}
            </div>
          </Card>
        ) : (
          <Card className="p-6 text-center">
            <Flag size={32} className="text-green-300 mx-auto mb-2" />
            <p className="text-gray-600 font-medium">まだラウンドがありません</p>
            <p className="text-gray-400 text-sm">ラウンドを記録して分析を始めましょう</p>
          </Card>
        )}

        {/* Today's issues */}
        {latestLosses.length > 0 && (
          <Card className="p-4">
            <h2 className="font-bold text-gray-900 mb-3">前回の課題</h2>
            <div className="space-y-2">
              {latestLosses.map(l => (
                <div key={l.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{l.label}</span>
                  <span className="text-sm font-bold text-red-600">+{l.estimatedLoss}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/record')}
            className="flex flex-col items-center justify-center gap-2 bg-green-800 text-white py-5 rounded-2xl font-bold text-base active:bg-green-900"
          >
            <PlayCircle size={28} />
            ラウンド開始
          </button>
          <button
            onClick={() => navigate('/analysis')}
            className="flex flex-col items-center justify-center gap-2 bg-white text-green-800 py-5 rounded-2xl font-bold text-base border border-green-200 active:bg-green-50"
          >
            <BarChart2 size={28} />
            分析を見る
          </button>
        </div>

        {/* Recent rounds */}
        {completedRounds.length > 1 && (
          <Card className="p-4">
            <h2 className="font-bold text-gray-900 mb-3">最近のラウンド</h2>
            <div className="space-y-2">
              {completedRounds.slice(1, 4).map(r => {
                const st = calcScoreStats(r.holes);
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 active:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/rounds/${r.id}/scorecard`)}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.courseName}</p>
                      <p className="text-xs text-gray-400">{r.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{st.totalScore}</p>
                      <p className="text-xs text-gray-400">{st.totalPutts}パット</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
