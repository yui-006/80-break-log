import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useGeolocation, haversineYards } from '../lib/geo';
import { GolfMap } from '../components/map/GolfMap';
import type { GeoPos } from '../lib/geo';
import type { MapMarker, MapPolyline } from '../components/map/GolfMap';
import type { GreenPoint, Shot } from '../types';
import { INITIAL_CLUBS, CLUB_ORDER } from '../data/initial';
import { ArrowLeft, MapPin, Navigation, RotateCcw, Locate } from 'lucide-react';

const GPS_LAST_CLUB_KEY = '80bl-gps-last-club';

type Tab = 'distance' | 'yards';

function AccuracyDot({ accuracy }: { accuracy: number }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${accuracy <= 10 ? 'bg-green-500' : accuracy <= 20 ? 'bg-yellow-400' : 'bg-red-400'}`} />
  );
}

function GpsBadge({ pos, error }: { pos: GeoPos | null; error: string | null }) {
  if (error) return <p className="text-xs text-ll-loss">{error}</p>;
  if (!pos)  return <p className="text-xs text-ll-mute">GPS取得中…</p>;
  return (
    <span className="flex items-center gap-1 text-xs text-ll-mute">
      <AccuracyDot accuracy={pos.accuracy} />
      ±{Math.round(pos.accuracy)}m
    </span>
  );
}

// ── 飛距離計測タブ ──────────────────────────────────────────────────────────

function DistanceTab({ roundId, holeNo }: { roundId?: string; holeNo?: number }) {
  const { state, saveGreenPoint, saveRound } = useApp();
  const { pos, error, watching, start, stop } = useGeolocation();
  const [pointA, setPointA] = useState<GeoPos | null>(null);
  const [pointB, setPointB] = useState<GeoPos | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const teeAutoSaved = useRef(false);

  // Club selector — remember last used, default to 1W on first use
  const clubs = state.clubs.length > 0 ? state.clubs : INITIAL_CLUBS;
  const sortedClubs = [...clubs].sort((a, b) => CLUB_ORDER.indexOf(a.id) - CLUB_ORDER.indexOf(b.id));
  const [selectedClubId, setSelectedClubId] = useState<string>(() => {
    const last = localStorage.getItem(GPS_LAST_CLUB_KEY);
    if (last && clubs.some(c => c.id === last)) return last;
    return clubs.find(c => c.name.startsWith('1W') || c.name === 'ドライバー')?.id ?? clubs[0]?.id ?? '';
  });

  function selectClub(id: string) {
    setSelectedClubId(id);
    localStorage.setItem(GPS_LAST_CLUB_KEY, id);
  }

  useEffect(() => { start(); return stop; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Round/hole context for tee auto-save and shot recording
  const round = roundId ? state.rounds.find(r => r.id === roundId) : undefined;
  const course = round ? state.courses.find(c => c.id === round.courseId) : undefined;
  const currentHole = round && holeNo != null ? round.holes.find(h => h.holeNo === holeNo) : undefined;
  const existingTee = course && holeNo != null
    ? state.greenPoints.find(g => g.courseId === course.id && g.holeNumber === holeNo && g.pointType === 'tee')
    : undefined;

  const markA = useCallback(() => {
    if (!pos) return;
    setPointA(pos);
    // Auto-save ① as tee if context available and tee not yet registered
    if (course && holeNo != null && !existingTee && !teeAutoSaved.current) {
      teeAutoSaved.current = true;
      const teePoint: GreenPoint = {
        id: crypto.randomUUID(),
        courseId: course.id,
        holeNumber: holeNo,
        lat: pos.lat,
        lng: pos.lng,
        pointType: 'tee',
        updatedAt: new Date().toISOString(),
      };
      saveGreenPoint(teePoint).catch(console.warn);
    }
  }, [pos, course, holeNo, existingTee, saveGreenPoint]);

  const markB = useCallback(() => { if (pos) setPointB(pos); }, [pos]);

  const reset = useCallback(() => {
    setPointA(null); setPointB(null);
    setSavedMsg(false);
    teeAutoSaved.current = false;
  }, []);

  const distance = pointA && pointB ? haversineYards(pointA, pointB) : null;
  const poorAccuracy = (pointA && pointA.accuracy > 10) || (pointB && pointB.accuracy > 10);
  const tooShort = distance !== null && distance < 30;
  const canRecord = distance !== null && !!round && !!currentHole;

  // Save measured distance as a Shot in the current hole
  async function recordShot() {
    if (!canRecord || distance === null || !currentHole || !round) return;
    const isTeeShot = teeAutoSaved.current || currentHole.shots.length === 0;
    const nextShotNo = currentHole.shots.length > 0
      ? Math.max(...currentHole.shots.map(s => s.shotNo)) + 1
      : 1;
    const newShot: Shot = {
      id: crypto.randomUUID(),
      roundHoleId: currentHole.id,
      shotNo: nextShotNo,
      shotTypes: isTeeShot ? ['tee', 'full'] : ['full'],
      clubId: selectedClubId || undefined,
      distance,
    };
    const updatedRound = {
      ...round,
      holes: round.holes.map(h => h.id === currentHole.id
        ? { ...currentHole, shots: [...currentHole.shots, newShot] }
        : h),
      updatedAt: new Date().toISOString(),
    };
    await saveRound(updatedRound);
    setSavedMsg(true);
    // Auto-reset after confirmation so user can measure next shot
    setTimeout(() => reset(), 1800);
  }

  const mapCenter: [number, number] = pos
    ? [pos.lat, pos.lng]
    : pointA ? [pointA.lat, pointA.lng] : [35.0, 136.0];

  const markers: MapMarker[] = [
    ...(pointA ? [{ lat: pointA.lat, lng: pointA.lng, color: 'orange' as const, label: '①' }] : []),
    ...(pointB ? [{ lat: pointB.lat, lng: pointB.lng, color: 'red' as const, label: '②' }] : []),
    ...(pos ? [{ lat: pos.lat, lng: pos.lng, color: 'blue' as const }] : []),
  ];
  const polylines: MapPolyline[] = pointA && pointB
    ? [{ points: [[pointA.lat, pointA.lng], [pointB.lat, pointB.lng]], color: '#f97316' }]
    : [];

  const selectedClub = clubs.find(c => c.id === selectedClubId);

  return (
    <div className="flex flex-col h-full">
      {/* GPS status */}
      <div className="px-4 py-2 flex items-center justify-between bg-ll-surf border-b border-ll-line">
        <GpsBadge pos={pos} error={error} />
        {watching && <span className="text-xs text-ll-acc">GPS有効</span>}
      </div>

      {/* Club selector */}
      <div className="bg-ll-surf border-b border-ll-line py-2 overflow-x-auto">
        <div className="flex gap-1.5 px-4">
          {sortedClubs.map(c => (
            <button
              key={c.id}
              onClick={() => selectClub(c.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                selectedClubId === c.id
                  ? 'bg-ll-acc text-white'
                  : 'bg-ll-s2 text-ll-ink border border-ll-line'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0">
        <GolfMap
          center={mapCenter}
          zoom={17}
          markers={markers}
          polylines={polylines}
          className="w-full h-full"
        />
      </div>

      {/* Controls */}
      <div className="bg-ll-surf border-t border-ll-line px-4 py-4 space-y-3">
        {/* Distance result */}
        {distance !== null && (
          <div className="text-center">
            <div className="flex items-baseline justify-center gap-2">
              <p className="text-5xl font-black text-ll-ink tabular-nums">{distance}</p>
              <span className="text-ll-mute text-base">y</span>
              {selectedClub && <span className="text-ll-mute text-sm">{selectedClub.name}</span>}
            </div>
            {(poorAccuracy || tooShort) && (
              <p className="text-xs text-ll-warn mt-1">
                {tooShort ? '短距離はGPS誤差の影響を受けやすい（参考値）' : 'GPS精度が低いため参考値'}
              </p>
            )}
            {savedMsg && (
              <p className="text-xs text-ll-good mt-1 font-medium">ショット記録に追加しました</p>
            )}
          </div>
        )}

        {/* ① ② marks */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={markA} disabled={!pos}
            className={`py-3.5 rounded-2xl font-bold text-base transition ${
              pointA ? 'bg-orange-500 text-white' : 'bg-ll-acc text-white disabled:opacity-40'
            } active:opacity-80`}>
            {pointA ? '①再マーク' : '①地点をマーク'}
          </button>
          <button onClick={markB} disabled={!pos || !pointA}
            className={`py-3.5 rounded-2xl font-bold text-base transition ${
              pointB ? 'bg-red-500 text-white' : 'bg-ll-acc text-white disabled:opacity-40'
            } active:opacity-80`}>
            {pointB ? '②再マーク' : '②地点をマーク'}
          </button>
        </div>

        {/* Reset + Record */}
        <div className="flex gap-2">
          {(pointA || pointB) && (
            <button onClick={reset}
              className="flex items-center gap-1.5 text-ll-mute text-sm px-4 py-2.5 rounded-xl border border-ll-line active:bg-ll-s2">
              <RotateCcw size={13} /> リセット
            </button>
          )}
          {canRecord && !savedMsg && (
            <button onClick={recordShot}
              className="flex-1 bg-ll-good text-white py-2.5 rounded-xl text-sm font-bold active:opacity-80">
              この距離を記録 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 残りヤードタブ ──────────────────────────────────────────────────────────

function YardsTab({ roundId, holeNo }: { roundId: string; holeNo: number }) {
  const { state } = useApp();
  const { pos, error, watching, start, stop } = useGeolocation();
  const [panToKey, setPanToKey] = useState(0);
  const hasInitialCenter = useRef(false);

  useEffect(() => { start(); return stop; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-center when hole changes
  useEffect(() => {
    hasInitialCenter.current = false;
    if (pos) {
      hasInitialCenter.current = true;
      setPanToKey(k => k + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeNo]);

  // Center when GPS first arrives (initial acquisition)
  useEffect(() => {
    if (pos && !hasInitialCenter.current) {
      hasInitialCenter.current = true;
      setPanToKey(k => k + 1);
    }
  }, [pos]);

  function handleRecenter() {
    if (!pos) return;
    setPanToKey(k => k + 1);
  }

  const round = state.rounds.find(r => r.id === roundId);
  const course = round ? state.courses.find(c => c.id === round.courseId) : undefined;
  const greenPoint = state.greenPoints.find(
    g => g.courseId === course?.id && g.holeNumber === holeNo && g.pointType === 'center'
  );
  const teePoint = state.greenPoints.find(
    g => g.courseId === course?.id && g.holeNumber === holeNo && g.pointType === 'tee'
  );

  const distance = pos && greenPoint ? haversineYards(pos, greenPoint) : null;
  const holeYards = teePoint && greenPoint ? haversineYards(teePoint, greenPoint) : null;
  const poorAccuracy = pos && pos.accuracy > 15;

  // panTo tracks current GPS — panToKey triggers actual flyTo
  const panTo: [number, number] | null = pos ? [pos.lat, pos.lng] : null;

  const mapCenter: [number, number] = pos
    ? [pos.lat, pos.lng]
    : greenPoint ? [greenPoint.lat, greenPoint.lng]
    : teePoint ? [teePoint.lat, teePoint.lng]
    : [35.0, 136.0];

  const markers: MapMarker[] = [
    ...(teePoint ? [{ lat: teePoint.lat, lng: teePoint.lng, color: 'orange' as const, label: 'T' }] : []),
    ...(greenPoint ? [{ lat: greenPoint.lat, lng: greenPoint.lng, color: 'green' as const, label: 'G' }] : []),
    ...(pos ? [{ lat: pos.lat, lng: pos.lng, color: 'blue' as const }] : []),
  ];
  const polylines: MapPolyline[] = teePoint && greenPoint
    ? [{ points: [[teePoint.lat, teePoint.lng], [greenPoint.lat, greenPoint.lng]], color: '#22c55e' }]
    : [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 flex items-center justify-between bg-ll-surf border-b border-ll-line">
        <div>
          <p className="text-xs font-medium text-ll-ink">
            {course?.name ?? '—'} Hole {holeNo}
            {holeYards && <span className="ml-2 text-ll-mute font-normal">{holeYards}y</span>}
          </p>
          <GpsBadge pos={pos} error={error} />
        </div>
        {watching && <Navigation size={14} className="text-ll-acc" />}
      </div>

      <div className="flex-1 min-h-0 relative">
        <GolfMap
          center={mapCenter}
          zoom={17}
          markers={markers}
          polylines={polylines}
          panTo={panTo}
          panToKey={panToKey}
          onUserMove={() => {}}
          className="w-full h-full"
        />

        {/* 現在地に戻るボタン (常時表示: ユーザーが動かした後 or GPS未取得時) */}
        <button
          onClick={handleRecenter}
          disabled={!pos}
          className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm border border-ll-line rounded-xl px-3 py-2 text-xs font-medium text-ll-ink shadow-sm active:bg-ll-s2 disabled:opacity-40 flex items-center gap-1.5"
        >
          <Locate size={12} /> 現在地に戻る
        </button>

        {/* HUD */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-ll-surf/90 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-lg text-center border border-ll-line min-w-36">
          {greenPoint ? (
            <>
              <p className="text-xs text-ll-mute mb-0.5">センターまで</p>
              {distance !== null ? (
                <>
                  <p className="text-4xl font-black text-ll-ink tabular-nums">
                    {distance}<span className="text-base font-normal text-ll-mute ml-1">y</span>
                  </p>
                  {poorAccuracy && (
                    <p className="text-xs text-ll-warn mt-0.5">±{Math.round(pos!.accuracy)}m（精度低）</p>
                  )}
                </>
              ) : (
                <p className="text-2xl font-bold text-ll-dim">—</p>
              )}
            </>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-ll-mute">グリーン未登録</p>
              {course && (
                <Link
                  to={`/courses?green=${course.id}&hole=${holeNo}`}
                  className="text-xs text-ll-acc underline"
                >
                  登録する
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function GpsPage() {
  const { roundId, holeNo: holeNoStr } = useParams<{ roundId?: string; holeNo?: string }>();
  const navigate = useNavigate();
  const hasContext = !!roundId && !!holeNoStr;
  const holeNo = Number(holeNoStr ?? '1');
  const [tab, setTab] = useState<Tab>(hasContext ? 'yards' : 'distance');

  const tabCls = (t: Tab) =>
    `flex-1 py-2.5 text-sm font-bold transition ${tab === t ? 'text-ll-acc border-b-2 border-ll-acc' : 'text-ll-mute'}`;

  return (
    <div className="flex flex-col h-screen bg-ll-bg">
      <div className="bg-ll-surf border-b border-ll-line px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-ll-mute active:text-ll-ink p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-ll-ink flex items-center gap-2">
          <MapPin size={18} className="text-ll-acc" /> GPS
        </h1>
      </div>

      <div className="flex bg-ll-surf border-b border-ll-line">
        <button className={tabCls('distance')} onClick={() => setTab('distance')}>
          飛距離計測
        </button>
        <button
          className={tabCls('yards')}
          onClick={() => setTab('yards')}
          disabled={!hasContext}
        >
          残りヤード{!hasContext && <span className="text-xs font-normal ml-1">(ラウンド中のみ)</span>}
        </button>
      </div>

      {/* key forces re-mount on tab switch — restarts GPS and resets state */}
      <div className="flex-1 min-h-0">
        {tab === 'distance' && (
          <DistanceTab key="distance" roundId={roundId} holeNo={hasContext ? holeNo : undefined} />
        )}
        {tab === 'yards' && hasContext && (
          <YardsTab key="yards" roundId={roundId!} holeNo={holeNo} />
        )}
      </div>
    </div>
  );
}
