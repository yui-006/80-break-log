import { useState, useCallback, useRef } from 'react';

// ── Haversine distance (yards) ─────────────────────────────────────────────
export function haversineYards(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  const meters = 2 * R * Math.asin(Math.sqrt(h));
  return Math.round(meters / 0.9144);
}

// ── Geolocation hook ───────────────────────────────────────────────────────
export type GeoPos = { lat: number; lng: number; accuracy: number };

export function useGeolocation() {
  const [pos, setPos] = useState<GeoPos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const watchId = useRef<number | null>(null);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError('このブラウザはGPSに対応していません');
      return;
    }
    setError(null);
    watchId.current = navigator.geolocation.watchPosition(
      p => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      err => {
        if (err.code === 1) setError('位置情報の使用が拒否されました');
        else if (err.code === 2) setError('位置情報を取得できませんでした');
        else setError('GPSタイムアウト');
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
    setWatching(true);
  }, []);

  const stop = useCallback(() => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setWatching(false);
  }, []);

  return { pos, error, watching, start, stop };
}
