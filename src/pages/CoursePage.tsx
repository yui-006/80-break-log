import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { Course, CourseHole, GreenPoint } from '../types';
import { mockCourseProvider } from '../providers/MockCourseProvider';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { GolfMap } from '../components/map/GolfMap';
import type { MapMarker } from '../components/map/GolfMap';
import { Plus, Search, ChevronRight, Trash2, Edit3, MapPin, Globe, Settings, Flag } from 'lucide-react';
import { Link } from 'react-router-dom';

function genId() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }

const INPUT_CLS = 'mt-1 w-full border border-ll-line bg-ll-s2 text-ll-ink rounded-xl px-3 py-2.5 text-base placeholder:text-ll-dim';
const LABEL_CLS = 'text-sm font-medium text-ll-ink';

function blankCourse(id: string): Course {
  const holes: CourseHole[] = Array.from({ length: 18 }, (_, i) => ({
    id: genId(), courseId: id, holeNo: i + 1, par: 4 as const,
    handicap: i + 1, yardsByTee: { back: undefined, regular: undefined, front: undefined, ladies: undefined },
  }));
  return { id, name: '', location: '', prefecture: '', source: 'manual', memo: '', holes, createdAt: now(), updatedAt: now() };
}

function HoleTableEditor({ holes, onChange }: { holes: CourseHole[]; onChange: (holes: CourseHole[]) => void }) {
  function update(idx: number, field: string, value: unknown) {
    const next = holes.map((h, i) => {
      if (i !== idx) return h;
      if (field.startsWith('tee.')) {
        const teeKey = field.slice(4) as keyof NonNullable<CourseHole['yardsByTee']>;
        return { ...h, yardsByTee: { ...h.yardsByTee, [teeKey]: value || undefined } };
      }
      return { ...h, [field]: value };
    });
    onChange(next);
  }

  const cellInput = 'w-14 border border-ll-line bg-ll-s2 text-ll-ink rounded px-1 py-0.5 text-center text-xs';

  return (
    <div className="overflow-x-auto -mx-4">
      <table className="text-xs w-full min-w-max">
        <thead>
          <tr className="bg-ll-s2 text-ll-mute">
            <th className="px-2 py-2 text-left">H</th>
            <th className="px-2 py-2">Par</th>
            <th className="px-2 py-2">Back</th>
            <th className="px-2 py-2">Reg</th>
            <th className="px-2 py-2">Frt</th>
            <th className="px-2 py-2">Ldy</th>
            <th className="px-2 py-2">Hdcp</th>
          </tr>
        </thead>
        <tbody>
          {holes.map((h, i) => (
            <tr key={h.id} className={i % 2 === 0 ? 'bg-ll-surf' : 'bg-ll-s2/60'}>
              <td className="px-2 py-1 font-medium text-ll-ink">{h.holeNo}</td>
              <td className="px-1 py-1">
                <select value={h.par} onChange={e => update(i, 'par', Number(e.target.value) as 3|4|5)}
                  className="w-12 border border-ll-line bg-ll-s2 text-ll-ink rounded px-1 py-0.5 text-center text-xs">
                  {[3,4,5].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </td>
              {(['back','regular','front','ladies'] as const).map(tee => (
                <td key={tee} className="px-1 py-1">
                  <input type="number" value={h.yardsByTee?.[tee] ?? ''}
                    onChange={e => update(i, `tee.${tee}`, e.target.value ? Number(e.target.value) : undefined)}
                    className={cellInput} placeholder="-" />
                </td>
              ))}
              <td className="px-1 py-1">
                <input type="number" value={h.handicap ?? ''}
                  onChange={e => update(i, 'handicap', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-12 border border-ll-line bg-ll-s2 text-ll-ink rounded px-1 py-0.5 text-center text-xs" placeholder="-" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CourseFormModal({ initial, onSave, onClose }: { initial: Course; onSave: (c: Course) => void; onClose: () => void }) {
  const [course, setCourse] = useState<Course>(initial);
  const field = (key: keyof Course) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCourse(prev => ({ ...prev, [key]: e.target.value, updatedAt: now() }));

  return (
    <Modal title={initial.name ? 'コース編集' : 'コース追加'} onClose={onClose}>
      <div className="space-y-4 pt-4">
        <div>
          <label className={LABEL_CLS}>コース名 *</label>
          <input value={course.name} onChange={field('name')} className={INPUT_CLS} placeholder="太平洋クラブ 御殿場コース" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLS}>都道府県</label>
            <input value={course.prefecture ?? ''} onChange={field('prefecture')} className={INPUT_CLS} placeholder="静岡県" />
          </div>
          <div>
            <label className={LABEL_CLS}>所在地</label>
            <input value={course.location ?? ''} onChange={field('location')} className={INPUT_CLS} placeholder="御殿場市" />
          </div>
        </div>
        <div>
          <label className={LABEL_CLS}>参照URL</label>
          <input value={course.sourceUrl ?? ''} onChange={field('sourceUrl')} className={INPUT_CLS} placeholder="https://..." />
        </div>
        <div>
          <label className={LABEL_CLS}>メモ</label>
          <textarea value={course.memo ?? ''} onChange={field('memo')} rows={2} className={`${INPUT_CLS} resize-none`} />
        </div>
        <div>
          <h3 className="font-bold text-ll-ink mb-2">ホール情報</h3>
          <HoleTableEditor holes={course.holes} onChange={holes => setCourse(prev => ({ ...prev, holes, updatedAt: now() }))} />
        </div>
        <button onClick={() => { if (course.name.trim()) onSave(course); }} disabled={!course.name.trim()}
          className="w-full bg-ll-acc text-white py-3.5 rounded-2xl font-bold text-base disabled:opacity-40 active:opacity-80">
          保存する
        </button>
      </div>
    </Modal>
  );
}

function CourseSearchModal({ onSelect, onClose }: { onSelect: (c: Course) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Awaited<ReturnType<typeof mockCourseProvider.search>>>([]);
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState<Course | null>(null);

  async function search() {
    setSearching(true);
    const res = await mockCourseProvider.search(query);
    setResults(res);
    setSearching(false);
  }

  async function loadPreview(id: string) {
    const detail = await mockCourseProvider.getCourseDetail(id);
    if (!detail) return;
    const newId = genId();
    const course: Course = {
      id: newId, name: detail.name ?? '', location: detail.location, prefecture: detail.prefecture,
      source: 'mock', sourceId: detail.sourceId, sourceUrl: detail.sourceUrl, memo: detail.memo,
      holes: (detail.holes ?? []).map(h => ({ ...h, id: genId(), courseId: newId })),
      createdAt: now(), updatedAt: now(),
    };
    setPreview(course);
  }

  if (preview) return <CourseFormModal initial={preview} onSave={onSelect} onClose={() => setPreview(null)} />;

  return (
    <Modal title="コースを検索" onClose={onClose}>
      <div className="space-y-4 pt-4">
        <div className="flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
            className="flex-1 border border-ll-line bg-ll-s2 text-ll-ink rounded-xl px-3 py-2.5 text-base placeholder:text-ll-dim"
            placeholder="コース名・都道府県" />
          <button onClick={search} className="bg-ll-acc text-white px-4 rounded-xl font-medium active:opacity-80">
            {searching ? '…' : <Search size={18} />}
          </button>
        </div>
        {results.length === 0 && !searching && (
          <p className="text-center text-ll-mute text-sm py-4">
            検索してコース候補を探してください<br />
            <span className="text-xs">(MVPはサンプルデータで動作)</span>
          </p>
        )}
        <div className="space-y-2">
          {results.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 bg-ll-s2 rounded-xl border border-ll-line active:bg-ll-line cursor-pointer"
              onClick={() => loadPreview(r.id)}>
              <div>
                <p className="font-medium text-ll-ink text-sm">{r.name}</p>
                <p className="text-xs text-ll-mute">{r.prefecture} {r.location}</p>
              </div>
              <ChevronRight size={16} className="text-ll-dim" />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function GreenRegistrationModal({
  course,
  greenPoints,
  onSave,
  onDelete,
  onClose,
  initialHole,
}: {
  course: Course;
  greenPoints: GreenPoint[];
  onSave: (point: GreenPoint) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  initialHole?: number;
}) {
  const [selectedHole, setSelectedHole] = useState(initialHole ?? 1);
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);

  const existingPoint = greenPoints.find(
    g => g.courseId === course.id && g.holeNumber === selectedHole && g.pointType === 'center'
  );

  // When switching holes, clear pending tap and show existing point
  function selectHole(n: number) {
    setSelectedHole(n);
    setPendingLatLng(null);
  }

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPendingLatLng({ lat, lng });
  }, []);

  function save() {
    if (!pendingLatLng) return;
    onSave({
      id: existingPoint?.id ?? genId(),
      courseId: course.id,
      holeNumber: selectedHole,
      lat: pendingLatLng.lat,
      lng: pendingLatLng.lng,
      pointType: 'center',
      updatedAt: new Date().toISOString(),
    });
    setPendingLatLng(null);
  }

  // Compute map center: existing point → pending → Japan fallback
  const displayPoint = pendingLatLng ?? existingPoint ?? null;
  const allPoints = greenPoints.filter(g => g.courseId === course.id);
  const mapCenter: [number, number] = displayPoint
    ? [displayPoint.lat, displayPoint.lng]
    : allPoints.length > 0
    ? [allPoints[0].lat, allPoints[0].lng]
    : [35.0, 136.5];

  const panTo: [number, number] | null = existingPoint && !pendingLatLng
    ? [existingPoint.lat, existingPoint.lng]
    : null;

  const markers: MapMarker[] = displayPoint
    ? [{ lat: displayPoint.lat, lng: displayPoint.lng, color: 'green', label: `H${selectedHole}`, draggable: true,
        onDragEnd: (lat, lng) => setPendingLatLng({ lat, lng }) }]
    : [];

  const registeredCount = greenPoints.filter(g => g.courseId === course.id).length;

  return (
    <Modal title={`グリーン登録 — ${course.name}`} onClose={onClose}>
      <div className="flex flex-col gap-3 pt-3" style={{ height: '70vh' }}>
        {/* Progress */}
        <p className="text-xs text-ll-mute text-center">{registeredCount} / {course.holes.length} ホール登録済み</p>

        {/* Hole selector */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-1.5 pb-1">
            {course.holes.map(h => {
              const hasPoint = greenPoints.some(g => g.courseId === course.id && g.holeNumber === h.holeNo && g.pointType === 'center');
              return (
                <button
                  key={h.holeNo}
                  onClick={() => selectHole(h.holeNo)}
                  className={`flex-shrink-0 w-9 h-9 rounded-xl text-xs font-bold transition ${
                    selectedHole === h.holeNo
                      ? 'bg-ll-acc text-white'
                      : hasPoint
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-ll-s2 text-ll-mute border border-ll-line'
                  }`}
                >
                  {h.holeNo}
                </button>
              );
            })}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-ll-line">
          <GolfMap
            center={mapCenter}
            zoom={17}
            markers={markers}
            onMapClick={handleMapClick}
            panTo={panTo}
            className="w-full h-full"
          />
        </div>

        <p className="text-xs text-ll-mute text-center">地図をタップしてグリーン中心を設定</p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={!pendingLatLng}
            className="flex-1 bg-ll-acc text-white py-3 rounded-2xl font-bold text-sm disabled:opacity-40 active:opacity-80"
          >
            保存
          </button>
          {existingPoint && (
            <button
              onClick={() => { onDelete(existingPoint.id); setPendingLatLng(null); }}
              className="px-4 py-3 rounded-2xl bg-ll-loss/10 text-ll-loss font-bold active:opacity-80"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CourseDetailModal({ course, onEdit, onDelete, onClose, onGreen }: { course: Course; onEdit: () => void; onDelete: () => void; onClose: () => void; onGreen: () => void }) {
  const totalPar = course.holes.reduce((s, h) => s + h.par, 0);
  return (
    <Modal title={course.name} onClose={onClose}>
      <div className="pt-4 space-y-4">
        {course.location && (
          <div className="flex items-center gap-2 text-sm text-ll-mute">
            <MapPin size={14} /><span>{course.prefecture} {course.location}</span>
          </div>
        )}
        {course.sourceUrl && (
          <div className="flex items-center gap-2 text-sm text-ll-acc">
            <Globe size={14} />
            <a href={course.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline truncate">{course.sourceUrl}</a>
          </div>
        )}
        <div className="text-sm text-ll-mute">全{course.holes.length}ホール / Par {totalPar}</div>
        <div className="overflow-x-auto -mx-4">
          <table className="text-xs w-full min-w-max">
            <thead>
              <tr className="bg-ll-s2 text-ll-mute">
                <th className="px-3 py-2 text-left">H</th>
                <th className="px-2 py-2">Par</th>
                <th className="px-2 py-2">Back</th>
                <th className="px-2 py-2">Reg</th>
                <th className="px-2 py-2">Frt</th>
                <th className="px-2 py-2">Ldy</th>
                <th className="px-2 py-2">Hdcp</th>
                <th className="px-2 py-2 text-left">Memo</th>
              </tr>
            </thead>
            <tbody>
              {course.holes.map((h, i) => (
                <tr key={h.id} className={i % 2 === 0 ? 'bg-ll-surf' : 'bg-ll-s2/60'}>
                  <td className="px-3 py-1.5 font-medium text-ll-ink">{h.holeNo}</td>
                  <td className="px-2 py-1.5 text-center text-ll-ink">{h.par}</td>
                  <td className="px-2 py-1.5 text-center text-ll-mute">{h.yardsByTee?.back ?? '-'}</td>
                  <td className="px-2 py-1.5 text-center text-ll-mute">{h.yardsByTee?.regular ?? '-'}</td>
                  <td className="px-2 py-1.5 text-center text-ll-mute">{h.yardsByTee?.front ?? '-'}</td>
                  <td className="px-2 py-1.5 text-center text-ll-mute">{h.yardsByTee?.ladies ?? '-'}</td>
                  <td className="px-2 py-1.5 text-center text-ll-mute">{h.handicap ?? '-'}</td>
                  <td className="px-2 py-1.5 text-ll-mute">{h.memo ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onGreen}
            className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-2xl font-bold active:opacity-80">
            <Flag size={16} /> グリーン登録
          </button>
          <button onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-2 bg-ll-acc text-white py-3 rounded-2xl font-bold active:opacity-80">
            <Edit3 size={16} /> 編集
          </button>
          <button onClick={onDelete}
            className="flex items-center justify-center gap-2 bg-ll-loss/10 text-ll-loss px-4 py-3 rounded-2xl font-bold active:opacity-80">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function CoursePage() {
  const { state, saveCourse, deleteCourse, saveGreenPoint, deleteGreenPoint } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'none' | 'new' | 'search' | 'detail' | 'edit' | 'green'>('none');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Support direct link from GpsPage: /courses?green=<courseId>&hole=<n>
  const greenParamCourseId = searchParams.get('green');
  const greenParamHole = Number(searchParams.get('hole') ?? '1');
  if (greenParamCourseId && mode === 'none' && !selectedId) {
    setSelectedId(greenParamCourseId);
    setMode('green');
  }

  const courses = state.courses.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const selected = courses.find(c => c.id === selectedId) ?? null;

  async function handleSave(course: Course) { await saveCourse(course); setMode('none'); setSelectedId(null); }
  async function handleDelete() {
    if (!selectedId) return;
    if (!confirm('このコースを削除しますか？')) return;
    await deleteCourse(selectedId); setMode('none'); setSelectedId(null);
  }

  return (
    <div className="min-h-full bg-ll-bg">
      <div className="px-5 pt-12 pb-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-ll-ink">コース管理</h1>
          <Link to="/settings" className="text-ll-mute active:text-ll-ink p-1"><Settings size={22} /></Link>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMode('search')}
            className="flex-1 flex items-center justify-center gap-1 bg-ll-s2 text-ll-ink px-3 py-2.5 rounded-xl text-sm font-medium border border-ll-line active:bg-ll-line">
            <Search size={14} /> ネット検索
          </button>
          <button onClick={() => setMode('new')}
            className="flex-1 flex items-center justify-center gap-1 bg-ll-acc text-white px-3 py-2.5 rounded-xl text-sm font-bold active:opacity-80">
            <Plus size={14} /> 手入力
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {courses.length === 0 && (
          <div className="text-center py-16 text-ll-dim">
            <MapPin size={40} className="mx-auto mb-2 text-ll-dim" />
            <p>コースが登録されていません</p>
            <p className="text-sm mt-1">「ネット検索」か「手入力」で追加してください</p>
          </div>
        )}
        {courses.map(c => {
          const totalPar = c.holes.reduce((s, h) => s + h.par, 0);
          return (
            <Card key={c.id} className="p-4" onClick={() => { setSelectedId(c.id); setMode('detail'); }}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ll-ink truncate">{c.name}</p>
                  {c.location && (
                    <p className="text-xs text-ll-mute flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {c.prefecture} {c.location}
                    </p>
                  )}
                  <p className="text-xs text-ll-dim mt-0.5">
                    {c.holes.length}H / Par {totalPar}{c.source === 'mock' && ' · サンプル'}
                  </p>
                </div>
                <ChevronRight size={18} className="text-ll-dim flex-shrink-0" />
              </div>
            </Card>
          );
        })}
      </div>

      {courses.length > 0 && (
        <div className="px-4 pb-4">
          <button onClick={() => navigate('/record')}
            className="w-full bg-ll-acc text-white py-4 rounded-2xl font-bold text-base active:opacity-80">
            ラウンドを開始 →
          </button>
        </div>
      )}

      {mode === 'new' && <CourseFormModal initial={blankCourse(genId())} onSave={handleSave} onClose={() => setMode('none')} />}
      {mode === 'search' && <CourseSearchModal onSelect={handleSave} onClose={() => setMode('none')} />}
      {mode === 'detail' && selected && (
        <CourseDetailModal course={selected}
          onEdit={() => setMode('edit')}
          onDelete={handleDelete}
          onGreen={() => setMode('green')}
          onClose={() => { setMode('none'); setSelectedId(null); }} />
      )}
      {mode === 'edit' && selected && (
        <CourseFormModal initial={selected} onSave={handleSave} onClose={() => setMode('detail')} />
      )}
      {mode === 'green' && selected && (
        <GreenRegistrationModal
          course={selected}
          greenPoints={state.greenPoints}
          initialHole={greenParamHole}
          onSave={point => saveGreenPoint(point)}
          onDelete={id => deleteGreenPoint(id)}
          onClose={() => { setMode(greenParamCourseId ? 'none' : 'detail'); }}
        />
      )}
    </div>
  );
}
