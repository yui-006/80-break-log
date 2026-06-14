import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { Round, RoundHole, Course } from '../types';
import { calcScoreStats } from '../analytics';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { WEATHER_OPTIONS } from '../data/initial';
import { ClipboardList, Plus, ChevronRight, Trash2 } from 'lucide-react';

function genId() { return crypto.randomUUID(); }
function nowStr() { return new Date().toISOString(); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

function buildRoundHoles(course: Course, teeName: string): RoundHole[] {
  const teeKey = teeName === 'バック' ? 'back'
    : teeName === 'フロント' ? 'front'
    : teeName === 'レディース' ? 'ladies'
    : 'regular';
  return course.holes.map(h => ({
    id: genId(),
    roundId: '',
    courseHoleId: h.id,
    holeNo: h.holeNo,
    par: h.par,
    yardage: h.yardsByTee?.[teeKey as keyof typeof h.yardsByTee],
    score: undefined,
    putts: undefined,
    ob: 0,
    penalty: 0,
    memo: '',
    shots: [],
  }));
}

function RoundStartModal({ onClose }: { onClose: () => void }) {
  const { state, saveRound } = useApp();
  const navigate = useNavigate();
  const [courseId, setCourseId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [teeName, setTeeName] = useState('レギュラー');
  const [targetScore, setTargetScore] = useState('');
  const [weather, setWeather] = useState('');
  const [memo, setMemo] = useState('');

  const teeNames = ['バック', 'レギュラー', 'フロント', 'レディース'];

  async function start() {
    const course = state.courses.find(c => c.id === courseId);
    if (!course) return;
    const roundId = genId();
    const holes = buildRoundHoles(course, teeName).map(h => ({ ...h, roundId }));
    const round: Round = {
      id: roundId,
      courseId: course.id,
      courseName: course.name,
      date,
      teeName,
      targetScore: targetScore ? Number(targetScore) : undefined,
      weather: weather || undefined,
      memo: memo || undefined,
      status: 'recording',
      holes,
      createdAt: nowStr(),
      updatedAt: nowStr(),
    };
    await saveRound(round);
    onClose();
    navigate(`/rounds/${roundId}/hole/1`);
  }

  return (
    <Modal title="ラウンド開始" onClose={onClose}>
      <div className="space-y-4 pt-4">
        <div>
          <label className="text-sm font-medium text-gray-700">コース *</label>
          <select
            value={courseId}
            onChange={e => setCourseId(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base bg-white"
          >
            <option value="">コースを選択</option>
            {state.courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {state.courses.length === 0 && (
            <p className="text-xs text-red-500 mt-1">先にコースを登録してください</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">日付</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">ティー</label>
          <div className="flex gap-2 flex-wrap">
            {teeNames.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTeeName(t)}
                className={`px-4 py-2 rounded-xl text-sm font-medium ${
                  teeName === t ? 'bg-green-800 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">目標スコア</label>
          <input
            type="number"
            value={targetScore}
            onChange={e => setTargetScore(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base"
            placeholder="例: 90"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">天気</label>
          <div className="flex gap-2 flex-wrap">
            {WEATHER_OPTIONS.map(w => (
              <button
                key={w}
                type="button"
                onClick={() => setWeather(weather === w ? '' : w)}
                className={`px-3 py-1.5 rounded-xl text-sm ${
                  weather === w ? 'bg-green-800 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">メモ</label>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            rows={2}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base resize-none"
          />
        </div>

        <button
          onClick={start}
          disabled={!courseId}
          className="w-full bg-green-800 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-40 active:bg-green-900"
        >
          ラウンド開始
        </button>
      </div>
    </Modal>
  );
}

export function RecordPage() {
  const { state, deleteRound, saveRound } = useApp();
  const navigate = useNavigate();
  const [showStart, setShowStart] = useState(false);

  const recordingRounds = state.rounds.filter(r => r.status === 'recording');
  const completedRounds = state.rounds
    .filter(r => r.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date));

  async function completeRound(round: Round) {
    await saveRound({ ...round, status: 'completed', updatedAt: nowStr() });
  }

  async function handleDelete(id: string) {
    if (!confirm('このラウンドを削除しますか？')) return;
    await deleteRound(id);
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-green-800 text-white px-5 pt-12 pb-6 flex items-end justify-between">
        <h1 className="text-2xl font-bold">ラウンド記録</h1>
        <button
          onClick={() => setShowStart(true)}
          className="flex items-center gap-1 bg-white text-green-800 px-3 py-2 rounded-xl text-sm font-bold active:bg-green-50"
        >
          <Plus size={14} /> 新しいラウンド
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Recording rounds */}
        {recordingRounds.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-500 mb-2">記録中</h2>
            {recordingRounds.map(r => (
              <Card key={r.id} className="p-4 border-2 border-green-400">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{r.courseName}</p>
                    <p className="text-xs text-gray-500">{r.date} / {r.teeName}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/rounds/${r.id}/hole/1`)}
                      className="bg-green-800 text-white px-3 py-2 rounded-xl text-sm font-bold active:bg-green-900"
                    >
                      続ける
                    </button>
                    <button
                      onClick={() => completeRound(r)}
                      className="bg-gray-100 text-gray-700 px-3 py-2 rounded-xl text-sm active:bg-gray-200"
                    >
                      完了
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Completed rounds */}
        {completedRounds.length === 0 && recordingRounds.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ClipboardList size={40} className="mx-auto mb-2 text-gray-300" />
            <p>まだラウンドがありません</p>
          </div>
        )}

        {completedRounds.length > 0 && (
          <div>
            {recordingRounds.length > 0 && (
              <h2 className="text-sm font-bold text-gray-500 mb-2">完了済み</h2>
            )}
            <div className="space-y-2">
              {completedRounds.map(r => {
                const stats = calcScoreStats(r.holes);
                return (
                  <Card key={r.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => navigate(`/rounds/${r.id}/scorecard`)}
                      >
                        <p className="font-bold text-gray-900 truncate">{r.courseName}</p>
                        <p className="text-xs text-gray-500">{r.date} / {r.teeName}</p>
                        <div className="flex gap-3 mt-1">
                          <span className="text-sm font-bold text-green-800">{stats.totalScore}打</span>
                          <span className="text-xs text-gray-500">{stats.totalPutts}パット</span>
                          {stats.totalOB > 0 && <span className="text-xs text-red-500">OB {stats.totalOB}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ChevronRight
                          size={18}
                          className="text-gray-300 cursor-pointer"
                          onClick={() => navigate(`/rounds/${r.id}/scorecard`)}
                        />
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1.5 text-gray-400 active:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showStart && <RoundStartModal onClose={() => setShowStart(false)} />}
    </div>
  );
}
