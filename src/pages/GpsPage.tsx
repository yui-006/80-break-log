import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useGeolocation, haversineYards } from '../lib/geo';
import { GolfMap } from '../components/map/GolfMap';
import type { GeoPos } from '../lib/geo';
import type { MapMarker, MapPolyline } from '../components/map/GolfMap';
import { ArrowLeft, MapPin, Navigation, RotateCcw } from 'lucide-react';

type Tab = 'distance' | 'yards';

function AccuracyDot({ accuracy }: { accuracy: number }) {
  const good = accuracy <= 10;
  const ok   = accuracy <= 20;
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${good ? 'bg-green-500' : ok ? 'bg-yellow-400' : 'bg-red-400'}`} />
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

function DistanceTab() {
  const { pos, error, watching, start, stop } = useGeolocation();
  const [pointA, setPointA] = useState<GeoPos | null>(null);
  const [pointB, setPointB] = useState<GeoPos | null>(null);

  useEffect(() => { start(); return stop; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markA = useCallback(() => { if (pos) setPointA(pos); }, [pos]);
  const markB = useCallback(() => { if (pos) setPointB(pos); }, [pos]);
  const reset = useCallback(() => { setPointA(null); setPointB(null); }, []);

  const distance = pointA && pointB ? haversineYards(pointA, pointB) : null;
  const poorAccuracy = (pointA && pointA.accuracy > 10) || (pointB && pointB.accuracy > 10);
  const tooShort = distance !== null && distance < 30;

  // Map data
  const mapCenter: [number, number] = pos
    ? [pos.lat, pos.lng]
    : pointA ? [pointA.lat, pointA.lng] : [35.0, 136.0];

  const markers: MapMarker[] = [
    ...(pos ? [{ lat: pos.lat, lng: pos.lng, color: 'blue' as const, label: '現在地' }] : []),
    ...(pointA ? [{ lat: pointA.lat, lng: pointA.lng, color: 'orange' as const, label: '①' }] : []),
    ...(pointB ? [{ lat: pointB.lat, lng: pointB.lng, color: 'red' as const, label: '②' }] : []),
  ];
  const polylines: MapPolyline[] = pointA && pointB
    ? [{ points: [[pointA.lat, pointA.lng], [pointB.lat, pointB.lng]], color: '#f97316' }]
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* GPS status */}
      <div className="px-4 py-2 flex items-center justify-between bg-ll-surf border-b border-ll-line">
        <GpsBadge pos={pos} error={error} />
        {watching && <span className="text-xs text-ll-acc">GPS有効</span>}
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0">
        <GolfMap
          center={mapCenter}
          zoom={17}
          markers={markers}
          polylines={polylines}
          panTo={pos ? [pos.lat, pos.lng] : null}
          className="w-full h-full"
        />
      </div>

      {/* Controls */}
      <div className="bg-ll-surf border-t border-ll-line px-4 py-4 space-y-3">
        {/* Distance result */}
        {distance !== null && (
          <div className="text-center">
            <p className="text-5xl font-black text-ll-ink tabular-nums">{distance}</p>
            <p className="text-ll-mute text-sm mt-0.5">ヤード</p>
            {(poorAccuracy || tooShort) && (
              <p className="text-xs text-ll-warn mt-1">
                {tooShort ? '短距離はGPS誤差の影響を受けやすい（参考値）' : 'GPS精度が低いため参考値'}
              </p>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={markA}
            disabled={!pos}
            className={`py-3.5 rounded-2xl font-bold text-base transition ${
              pointA ? 'bg-orange-500 text-white' : 'bg-ll-acc text-white disabled:opacity-40'
            } active:opacity-80`}
          >
            {pointA ? '①再マーク' : '①地点をマーク'}
          </button>
          <button
            onClick={markB}
            disabled={!pos || !pointA}
            className={`py-3.5 rounded-2xl font-bold text-base transition ${
              pointB ? 'bg-red-500 text-white' : 'bg-ll-acc text-white disabled:opacity-40'
            } active:opacity-80`}
          >
            {pointB ? '②再マーク' : '②地点をマーク'}
          </button>
        </div>

        {(pointA || pointB) && (
          <button onClick={reset} className="w-full flex items-center justify-center gap-2 text-ll-mute text-sm py-2 active:text-ll-ink">
            <RotateCcw size={14} /> リセット
          </button>
        )}
      </div>
    </div>
  );
}

// ── 残りヤードタブ ──────────────────────────────────────────────────────────

function YardsTab({ roundId, holeNo }: { roundId: string; holeNo: number }) {
  const { state } = useApp();
  const { pos, error, watching, start, stop } = useGeolocation();

  useEffect(() => { start(); return stop; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const round = state.rounds.find(r => r.id === roundId);
  const course = round ? state.courses.find(c => c.id === round.courseId) : undefined;
  const greenPoint = state.greenPoints.find(
    g => g.courseId === course?.id && g.holeNumber === holeNo && g.pointType === 'center'
  );

  const distance = pos && greenPoint ? haversineYards(pos, greenPoint) : null;
  const poorAccuracy = pos && pos.accuracy > 15;

  const mapCenter: [number, number] = greenPoint
    ? [greenPoint.lat, greenPoint.lng]
    : pos ? [pos.lat, pos.lng] : [35.0, 136.0];

  const markers: MapMarker[] = [
    ...(pos ? [{ lat: pos.lat, lng: pos.lng, color: 'blue' as const, label: '現在地' }] : []),
    ...(greenPoint ? [{ lat: greenPoint.lat, lng: greenPoint.lng, color: 'green' as const, label: 'グリーン' }] : []),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header info */}
      <div className="px-4 py-2 flex items-center justify-between bg-ll-surf border-b border-ll-line">
        <div>
          <p className="text-xs font-medium text-ll-ink">{course?.name} - Hole {holeNo}</p>
          <GpsBadge pos={pos} error={error} />
        </div>
        {watching && <Navigation size={14} className="text-ll-acc" />}
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 relative">
        <GolfMap
          center={mapCenter}
          zoom={17}
          markers={markers}
          panTo={pos ? [pos.lat, pos.lng] : null}
          className="w-full h-full"
        />

        {/* HUD overlay */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-ll-surf/90 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-lg text-center border border-ll-line">
          {greenPoint ? (
            <>
              <p className="text-xs text-ll-mute mb-0.5">センターまで</p>
              {distance !== null ? (
                <>
                  <p className="text-4xl font-black text-ll-ink tabular-nums">{distance}<span className="text-base font-normal text-ll-mute ml-1">y</span></p>
                  {poorAccuracy && <p className="text-xs text-ll-warn mt-0.5">±{Math.round(pos!.accuracy)}m（精度低）</p>}
                </>
              ) : (
                <p className="text-2xl font-bold text-ll-dim">—</p>
              )}
            </>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-ll-mute">グリーン未登録</p>
              {course && (
                <Link to={`/courses?green=${course.id}&hole=${holeNo}`} className="text-xs text-ll-acc underline">
                  コース設定で登録する
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
      {/* Header */}
      <div className="bg-ll-surf border-b border-ll-line px-4 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-ll-mute active:text-ll-ink p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-bold text-ll-ink flex items-center gap-2">
          <MapPin size={18} className="text-ll-acc" /> GPS
        </h1>
      </div>

      {/* Tab bar */}
      <div className="flex bg-ll-surf border-b border-ll-line">
        <button className={tabCls('distance')} onClick={() => setTab('distance')}>
          飛距離計測
        </button>
        <button className={tabCls('yards')} onClick={() => setTab('yards')} disabled={!hasContext}>
          残りヤード{!hasContext && <span className="text-xs font-normal ml-1">(ラウンド中のみ)</span>}
        </button>
      </div>

      {/* Tab content — key forces re-mount on switch to restart GPS */}
      <div className="flex-1 min-h-0">
        {tab === 'distance' && <DistanceTab key="distance" />}
        {tab === 'yards' && hasContext && <YardsTab key="yards" roundId={roundId!} holeNo={holeNo} />}
      </div>
    </div>
  );
}
