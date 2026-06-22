import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useGeolocation, haversineYards } from '../lib/geo';
import { GolfMap } from '../components/map/GolfMap';
import type { GeoPos } from '../lib/geo';
import type { MapMarker, MapPolyline } from '../components/map/GolfMap';
import type { Shot } from '../types';
import { INITIAL_CLUBS, CLUB_ORDER } from '../data/initial';
import { ArrowLeft, MapPin, Navigation, Locate } from 'lucide-react';

const GPS_LAST_CLUB_KEY = '80bl-gps-last-club';

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

export function GpsPage() {
  const { roundId, holeNo: holeNoStr } = useParams<{ roundId?: string; holeNo?: string }>();
  const navigate = useNavigate();
  const { state, saveRound } = useApp();
  const { pos, error, watching, start, stop } = useGeolocation();

  const [customPoint, setCustomPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [panToKey, setPanToKey] = useState(0);
  const hasInitialCenter = useRef(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const hasContext = !!roundId && !!holeNoStr;
  const holeNo = Number(holeNoStr ?? '1');

  // Club selector — remember last used, default to 1W
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

  // Context lookup
  const round = roundId ? state.rounds.find(r => r.id === roundId) : undefined;
  const course = round ? state.courses.find(c => c.id === round.courseId) : undefined;
  const currentHole = round && holeNo != null ? round.holes.find(h => h.holeNo === holeNo) : undefined;

  // Green points
  const greenPoint = state.greenPoints.find(
    g => g.courseId === course?.id && g.holeNumber === holeNo && g.pointType === 'center'
  );
  const teePoint = state.greenPoints.find(
    g => g.courseId === course?.id && g.holeNumber === holeNo && g.pointType === 'tee'
  );

  // Distances
  const currentToPin = pos && greenPoint ? haversineYards(pos, greenPoint) : null;
  const customToPin = customPoint && greenPoint ? haversineYards(customPoint, greenPoint) : null;
  const holeYards = teePoint && greenPoint ? haversineYards(teePoint, greenPoint) : null;
  const poorAccuracy = pos && pos.accuracy > 15;

  useEffect(() => { start(); return stop; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-center when hole changes
  useEffect(() => {
    hasInitialCenter.current = false;
    if (pos) { hasInitialCenter.current = true; setPanToKey(k => k + 1); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeNo]);

  // Center when GPS first arrives
  useEffect(() => {
    if (pos && !hasInitialCenter.current) { hasInitialCenter.current = true; setPanToKey(k => k + 1); }
  }, [pos]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setCustomPoint({ lat, lng });
  }, []);

  async function recordShot() {
    if (!currentToPin || !round || !currentHole) return;
    const nextShotNo = currentHole.shots.length > 0
      ? Math.max(...currentHole.shots.map(s => s.shotNo)) + 1 : 1;
    const newShot: Shot = {
      id: crypto.randomUUID(),
      roundHoleId: currentHole.id,
      shotNo: nextShotNo,
      shotTypes: currentHole.shots.length === 0 ? ['tee', 'full'] : ['full'],
      clubId: selectedClubId || undefined,
      distance: currentToPin,
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
    setTimeout(() => setSavedMsg(false), 2000);
  }

  const mapCenter: [number, number] = pos
    ? [pos.lat, pos.lng]
    : greenPoint ? [greenPoint.lat, greenPoint.lng]
    : teePoint ? [teePoint.lat, teePoint.lng]
    : [35.0, 136.0];

  const markers: MapMarker[] = [
    ...(teePoint ? [{ lat: teePoint.lat, lng: teePoint.lng, color: 'orange' as const, label: 'T' }] : []),
    ...(greenPoint ? [{ lat: greenPoint.lat, lng: greenPoint.lng, color: 'green' as const, label: 'G' }] : []),
    ...(customPoint ? [{ lat: customPoint.lat, lng: customPoint.lng, color: 'red' as const, label: '◎' }] : []),
    ...(pos ? [{ lat: pos.lat, lng: pos.lng, color: 'blue' as const }] : []),
  ];

  const polylines: MapPolyline[] = teePoint && greenPoint
    ? [{ points: [[teePoint.lat, teePoint.lng], [greenPoint.lat, greenPoint.lng]], color: '#22c55e' }]
    : [];

  return (
    <div className="flex flex-col h-screen bg-ll-bg">
      {/* Header */}
      <div className="bg-ll-surf border-b border-ll-line px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-ll-mute active:text-ll-ink p-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-ll-ink flex items-center gap-2 flex-wrap">
            <MapPin size={18} className="text-ll-acc flex-shrink-0" />
            <span className="truncate">
              {course ? `${course.name} — H${holeNo}` : '残りヤード'}
            </span>
            {holeYards && <span className="text-sm font-normal text-ll-mute">{holeYards}y</span>}
          </h1>
          <GpsBadge pos={pos} error={error} />
        </div>
        {watching && <Navigation size={14} className="text-ll-acc flex-shrink-0" />}
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 relative">
        <GolfMap
          center={mapCenter}
          zoom={17}
          markers={markers}
          polylines={polylines}
          panTo={pos ? [pos.lat, pos.lng] : null}
          panToKey={panToKey}
          onMapClick={handleMapClick}
          onUserMove={() => {}}
          className="w-full h-full"
        />

        {/* 現在地に戻るボタン */}
        <button
          onClick={() => pos && setPanToKey(k => k + 1)}
          disabled={!pos}
          className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm border border-ll-line rounded-xl px-3 py-2 text-xs font-medium text-ll-ink shadow-sm active:bg-ll-s2 disabled:opacity-40 flex items-center gap-1.5"
        >
          <Locate size={12} /> 現在地に戻る
        </button>

        {/* HUD */}
        {hasContext && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-ll-surf/90 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-lg border border-ll-line min-w-[180px] max-w-[260px]">
            {greenPoint ? (
              <div className="space-y-2">
                {/* 現在地→ピン */}
                <div className="text-center">
                  <p className="text-xs text-ll-mute mb-0.5">現在地→ピン</p>
                  {currentToPin !== null ? (
                    <>
                      <p className="text-4xl font-black text-ll-ink tabular-nums">
                        {currentToPin}<span className="text-base font-normal text-ll-mute ml-1">y</span>
                      </p>
                      {poorAccuracy && (
                        <p className="text-xs text-ll-warn mt-0.5">±{Math.round(pos!.accuracy)}m（精度低）</p>
                      )}
                    </>
                  ) : (
                    <p className="text-2xl font-bold text-ll-dim">—</p>
                  )}
                </div>
                {/* タップ地点→ピン */}
                {customPoint && customToPin !== null && (
                  <div className="border-t border-ll-line pt-2 text-center">
                    <p className="text-xs text-ll-mute mb-0.5">タップ地点→ピン</p>
                    <p className="text-2xl font-bold text-ll-ink tabular-nums">
                      {customToPin}<span className="text-sm font-normal text-ll-mute ml-1">y</span>
                    </p>
                    <button onClick={() => setCustomPoint(null)} className="text-xs text-ll-dim mt-1">× クリア</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center space-y-1">
                <p className="text-sm text-ll-mute">グリーン未登録</p>
                {course && (
                  <Link to={`/courses?green=${course.id}&hole=${holeNo}`} className="text-xs text-ll-acc underline">
                    登録する →
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom panel — club selector + record (only when round context exists) */}
      {hasContext && (
        <div className="bg-ll-surf border-t border-ll-line">
          <div className="py-2 overflow-x-auto border-b border-ll-line">
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
          <div className="px-4 py-3">
            {savedMsg ? (
              <p className="text-center text-sm font-bold text-ll-good py-2">記録しました</p>
            ) : (
              <button
                onClick={recordShot}
                disabled={!currentToPin}
                className="w-full bg-ll-good text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40 active:opacity-80"
              >
                現在地の距離を記録{currentToPin ? ` (${currentToPin}y)` : ''}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
