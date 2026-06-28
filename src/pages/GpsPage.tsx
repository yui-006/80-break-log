import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useGeolocation, haversineYards, bearingDeg, destinationPoint } from '../lib/geo';
import { GolfMap } from '../components/map/GolfMap';
import type { GeoPos } from '../lib/geo';
import type { MapMarker, MapPolyline } from '../components/map/GolfMap';
import type { Shot } from '../types';
import { INITIAL_CLUBS, CLUB_ORDER } from '../data/initial';
import { ArrowLeft, Locate, ChevronLeft, ChevronRight, Target } from 'lucide-react';

const GPS_LAST_CLUB_KEY = '80bl-gps-last-club';
const HALF_DEPTH_M = 11.887; // 13y ≈ green half-depth default

type LatLng = { lat: number; lng: number };

function GpsBadge({ pos, error, watching }: { pos: GeoPos | null; error: string | null; watching: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {watching && <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />}
      <span className="text-white/60 text-xs">
        {error ? error : pos ? `±${Math.round(pos.accuracy)}m` : 'GPS取得中…'}
      </span>
    </div>
  );
}

export function GpsPage() {
  const { roundId, holeNo: holeNoStr } = useParams<{ roundId?: string; holeNo?: string }>();
  const navigate = useNavigate();
  const { state, saveRound } = useApp();
  const { pos, error, watching, start, stop } = useGeolocation();

  const [activeGreenLabel, setActiveGreenLabel] = useState<string>('main');
  const [secretTarget, setSecretTarget] = useState<LatLng | null>(null);
  const [targetMode, setTargetMode] = useState(false);
  const [panToKey, setPanToKey] = useState(0);
  const hasInitialCenter = useRef(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const hasContext = !!roundId && !!holeNoStr;
  const holeNo = Number(holeNoStr ?? '1');

  // Club selector
  const clubs = state.clubs.length > 0 ? state.clubs : INITIAL_CLUBS;
  const sortedClubs = [...clubs].sort((a, b) => CLUB_ORDER.indexOf(a.id) - CLUB_ORDER.indexOf(b.id));
  const [selectedClubId, setSelectedClubId] = useState<string>(() => {
    const last = localStorage.getItem(GPS_LAST_CLUB_KEY);
    if (last && clubs.some(c => c.id === last)) return last;
    return clubs.find(c => c.name.startsWith('1W') || c.name === 'ドライバー')?.id ?? clubs[0]?.id ?? '';
  });
  function selectClub(id: string) { setSelectedClubId(id); localStorage.setItem(GPS_LAST_CLUB_KEY, id); }

  // Round / course context
  const round = roundId ? state.rounds.find(r => r.id === roundId) : undefined;
  const course = round ? state.courses.find(c => c.id === round.courseId) : undefined;
  const currentHole = round?.holes.find(h => h.holeNo === holeNo);
  const courseHole = course?.holes.find(h => h.holeNo === holeNo);

  // Green points for this hole
  const allHolePoints = state.greenPoints.filter(
    g => g.courseId === course?.id && g.holeNumber === holeNo
  );
  const greenLabels = [...new Set(
    allHolePoints.filter(g => g.pointType !== 'tee').map(g => g.greenLabel)
  )].sort();
  const activePoints = allHolePoints.filter(g => g.greenLabel === activeGreenLabel);

  const centerPoint = activePoints.find(g => g.pointType === 'center') ?? null;
  const frontRegistered = activePoints.find(g => g.pointType === 'front') ?? null;
  const backRegistered = activePoints.find(g => g.pointType === 'back') ?? null;
  const teePoint = allHolePoints.find(g => g.pointType === 'tee') ?? null;

  // Derive F/B from center+bearing when only center is registered
  let effectiveFront: LatLng | null = frontRegistered;
  let effectiveBack: LatLng | null = backRegistered;
  if (centerPoint && !frontRegistered && !backRegistered) {
    const fromPoint: LatLng | null = teePoint ?? pos;
    if (fromPoint) {
      const brg = bearingDeg(fromPoint, centerPoint);
      effectiveFront = destinationPoint(centerPoint, (brg + 180) % 360, HALF_DEPTH_M);
      effectiveBack  = destinationPoint(centerPoint, brg, HALF_DEPTH_M);
    }
  }

  // Distances
  const distToCenter = pos && centerPoint ? haversineYards(pos, centerPoint) : null;
  const distToFront  = pos && effectiveFront ? haversineYards(pos, effectiveFront) : null;
  const distToBack   = pos && effectiveBack  ? haversineYards(pos, effectiveBack)  : null;
  const distToTarget = pos && secretTarget   ? haversineYards(pos, secretTarget)   : null;
  const targetToCenter = secretTarget && centerPoint ? haversineYards(secretTarget, centerPoint) : null;
  const gpsHoleYards   = teePoint && centerPoint ? haversineYards(teePoint, centerPoint) : null;
  const holeYards = gpsHoleYards
    ?? courseHole?.yardsByTee?.regular
    ?? courseHole?.yardsByTee?.back
    ?? null;

  useEffect(() => { start(); return stop; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset + auto-center when hole changes
  useEffect(() => {
    setActiveGreenLabel('main');
    setSecretTarget(null);
    setTargetMode(false);
    hasInitialCenter.current = false;
    if (pos) { hasInitialCenter.current = true; setPanToKey(k => k + 1); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holeNo]);

  // Auto-center on first GPS fix
  useEffect(() => {
    if (pos && !hasInitialCenter.current) { hasInitialCenter.current = true; setPanToKey(k => k + 1); }
  }, [pos]);

  // Hole navigation
  const prevHoleNo = round?.holes.some(h => h.holeNo === holeNo - 1) ? holeNo - 1 : null;
  const nextHoleNo = round?.holes.some(h => h.holeNo === holeNo + 1) ? holeNo + 1 : null;

  // Map click: place target in tap mode
  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (targetMode) { setSecretTarget({ lat, lng }); setTargetMode(false); }
  }, [targetMode]);

  // Target button
  function handleTargetButton() {
    if (secretTarget) { setSecretTarget(null); setTargetMode(false); }
    else if (pos) { setSecretTarget({ lat: pos.lat, lng: pos.lng }); }
    else { setTargetMode(t => !t); }
  }

  // Record shot
  async function recordShot() {
    if (!distToCenter || !round || !currentHole) return;
    const nextShotNo = currentHole.shots.length > 0
      ? Math.max(...currentHole.shots.map(s => s.shotNo)) + 1 : 1;
    const newShot: Shot = {
      id: crypto.randomUUID(),
      roundHoleId: currentHole.id,
      shotNo: nextShotNo,
      shotTypes: currentHole.shots.length === 0 ? ['tee', 'full'] : ['full'],
      clubId: selectedClubId || undefined,
      distance: distToCenter,
    };
    await saveRound({
      ...round,
      holes: round.holes.map(h => h.id === currentHole.id
        ? { ...currentHole, shots: [...currentHole.shots, newShot] } : h),
      updatedAt: new Date().toISOString(),
    });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  }

  // Map
  const mapCenter: [number, number] = pos
    ? [pos.lat, pos.lng]
    : centerPoint ? [centerPoint.lat, centerPoint.lng]
    : teePoint ? [teePoint.lat, teePoint.lng]
    : [35.0, 136.0];

  const markers: MapMarker[] = [
    ...(teePoint ? [{ lat: teePoint.lat, lng: teePoint.lng, color: 'orange' as const, label: 'T' }] : []),
    ...(effectiveFront ? [{ lat: effectiveFront.lat, lng: effectiveFront.lng, color: 'green' as const, label: 'F' }] : []),
    ...(centerPoint ? [{ lat: centerPoint.lat, lng: centerPoint.lng, color: 'green' as const, label: 'G' }] : []),
    ...(effectiveBack ? [{ lat: effectiveBack.lat, lng: effectiveBack.lng, color: 'green' as const, label: 'B' }] : []),
    ...(secretTarget ? [{
      lat: secretTarget.lat, lng: secretTarget.lng, color: 'blue' as const, label: '◎',
      draggable: true, onDragEnd: (lat: number, lng: number) => setSecretTarget({ lat, lng }),
    }] : []),
    ...(pos ? [{ lat: pos.lat, lng: pos.lng, color: 'red' as const }] : []),
  ];

  const polylines: MapPolyline[] = [
    ...(teePoint && centerPoint ? [{ points: [[teePoint.lat, teePoint.lng], [centerPoint.lat, centerPoint.lng]] as [number, number][], color: '#22c55e' }] : []),
    ...(pos && secretTarget ? [{ points: [[pos.lat, pos.lng], [secretTarget.lat, secretTarget.lng]] as [number, number][], color: '#3b82f6' }] : []),
  ];

  // Large primary distance (center or target)
  const primaryDist = secretTarget ? distToTarget : distToCenter;
  const primaryLabel = secretTarget ? '目標まで' : 'センターまで';

  // Bottom panel height estimate for button positioning
  const panelHeight = hasContext ? 'calc(108px + max(env(safe-area-inset-bottom), 8px))' : '24px';

  return (
    <div className="relative h-screen overflow-hidden bg-black">
      {/* Full-screen satellite map */}
      <GolfMap
        center={mapCenter}
        zoom={17}
        markers={markers}
        polylines={polylines}
        panTo={pos ? [pos.lat, pos.lng] : null}
        panToKey={panToKey}
        onMapClick={handleMapClick}
        onUserMove={() => {}}
        className="absolute inset-0 w-full h-full"
      />

      {/* ── Top bar overlay ─────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-black/65 px-4 pt-12 pb-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-white/80 active:opacity-60 flex-shrink-0 p-1">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap min-w-0">
              {courseHole && <span className="text-white/70 text-xs">Par{courseHole.par}</span>}
              {course    && <span className="text-white font-bold text-sm truncate">{course.name}</span>}
              {holeYards && <span className="text-white/55 text-xs">{holeYards}y</span>}
            </div>
            <GpsBadge pos={pos} error={error} watching={watching} />
          </div>
          {/* Hole navigation */}
          {round && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={() => prevHoleNo && navigate(`/gps/${roundId}/${prevHoleNo}`)}
                disabled={!prevHoleNo} className="text-white/70 p-1 disabled:opacity-25 active:opacity-60">
                <ChevronLeft size={18} />
              </button>
              <span className="text-white font-black text-sm min-w-[2.2rem] text-center">H{holeNo}</span>
              <button onClick={() => nextHoleNo && navigate(`/gps/${roundId}/${nextHoleNo}`)}
                disabled={!nextHoleNo} className="text-white/70 p-1 disabled:opacity-25 active:opacity-60">
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Green switch (2 greens) ─────────────────────────────── */}
      {greenLabels.length > 1 && (
        <div className="absolute z-20" style={{ top: '80px', left: '50%', transform: 'translateX(-50%)' }}>
          <div className="flex bg-black/70 rounded-full p-0.5 gap-0.5 shadow-lg">
            {greenLabels.map(label => (
              <button key={label} onClick={() => setActiveGreenLabel(label)}
                className={`px-4 py-1 rounded-full text-xs font-bold transition ${
                  activeGreenLabel === label ? 'bg-ll-acc text-white' : 'text-white/70'
                }`}>
                {label === 'main' ? 'グリーン' : `${label}G`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── F / C / B right-side pill ───────────────────────────── */}
      {hasContext && centerPoint && (
        <div className="absolute right-3 z-20 flex flex-col gap-1.5"
          style={{ top: '50%', transform: 'translateY(-50%)' }}>
          <div className="bg-black/65 backdrop-blur-sm rounded-xl px-3 py-1.5 text-right min-w-[68px]">
            <p className="text-white/50 text-[10px] leading-tight">Back</p>
            <p className="text-white font-bold text-sm tabular-nums">{distToBack != null ? `${distToBack}y` : '—'}</p>
          </div>
          <div className="bg-black/80 backdrop-blur-sm rounded-xl px-3 py-2 text-right border border-white/25 min-w-[68px]">
            <p className="text-white/70 text-[10px] leading-tight">Cntr</p>
            <p className="text-white font-black text-base tabular-nums">{distToCenter != null ? `${distToCenter}y` : '—'}</p>
          </div>
          <div className="bg-black/65 backdrop-blur-sm rounded-xl px-3 py-1.5 text-right min-w-[68px]">
            <p className="text-white/50 text-[10px] leading-tight">Front</p>
            <p className="text-white font-bold text-sm tabular-nums">{distToFront != null ? `${distToFront}y` : '—'}</p>
          </div>
        </div>
      )}

      {/* ── Large primary distance ──────────────────────────────── */}
      {hasContext && centerPoint && (
        <div className="absolute z-10 pointer-events-none"
          style={{ left: '8px', right: '88px', top: '50%', transform: 'translateY(-58%)' }}>
          <div className="text-center">
            <p className="text-white/65 text-xs drop-shadow">{primaryLabel}</p>
            <div className="flex items-baseline justify-center gap-1">
              <p className="font-black text-white drop-shadow-lg tabular-nums"
                style={{ fontSize: 'clamp(54px, 14vw, 80px)', lineHeight: 1.05 }}>
                {primaryDist != null ? primaryDist : '—'}
              </p>
              <p className="text-white/65 text-xl drop-shadow">y</p>
            </div>
            {secretTarget && targetToCenter != null && (
              <p className="text-white/55 text-xs drop-shadow mt-1">目標→G: {targetToCenter}y</p>
            )}
          </div>
        </div>
      )}

      {/* ── Green unregistered message ──────────────────────────── */}
      {hasContext && !centerPoint && (
        <div className="absolute z-20" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
          <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-6 py-4 text-center">
            <p className="text-white text-sm">グリーン未登録</p>
            {course && (
              <Link to={`/courses?green=${course.id}&hole=${holeNo}`}
                className="text-blue-300 text-xs underline mt-1 block">登録する →</Link>
            )}
          </div>
        </div>
      )}

      {/* ── Map action buttons ──────────────────────────────────── */}
      <div className="absolute left-4 z-20 flex flex-col gap-2" style={{ bottom: panelHeight }}>
        <button onClick={handleTargetButton}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold shadow-lg backdrop-blur-sm ${
            secretTarget ? 'bg-red-500/90 text-white'
            : targetMode ? 'bg-ll-acc/90 text-white'
            : 'bg-black/65 text-white'
          }`}>
          <Target size={15} />
          {secretTarget ? 'クリア' : targetMode ? 'タップで設定' : '距離測定'}
        </button>
      </div>
      <button onClick={() => pos && setPanToKey(k => k + 1)} disabled={!pos}
        className="absolute right-4 z-20 bg-black/65 backdrop-blur-sm text-white rounded-2xl px-3 py-2.5 text-xs font-medium shadow-lg disabled:opacity-40 flex items-center gap-1.5"
        style={{ bottom: panelHeight }}>
        <Locate size={14} /> 現在地
      </button>

      {/* ── Bottom panel (club + record) ────────────────────────── */}
      {hasContext && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-ll-surf/95 backdrop-blur-sm border-t border-ll-line"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
          <div className="py-2 overflow-x-auto border-b border-ll-line">
            <div className="flex gap-1.5 px-4">
              {sortedClubs.map(c => (
                <button key={c.id} onClick={() => selectClub(c.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                    selectedClubId === c.id ? 'bg-ll-acc text-white' : 'bg-ll-s2 text-ll-ink border border-ll-line'
                  }`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="px-4 py-2.5">
            {savedMsg ? (
              <p className="text-center text-sm font-bold text-ll-good py-2">記録しました</p>
            ) : (
              <button onClick={recordShot} disabled={!distToCenter}
                className="w-full bg-ll-good text-white py-3 rounded-2xl text-sm font-bold disabled:opacity-40 active:opacity-80">
                現在地の距離を記録{distToCenter != null ? ` (${distToCenter}y)` : ''}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
