/**
 * Leaflet satellite map wrapper.
 * Basemap: Esri World Imagery (free, attribution required).
 * Cost note: Esri is free for non-commercial use; confirm license for commercial scale.
 * Future Mapbox migration: swap makeTileLayer({ provider: 'mapbox', token: '...' }).
 * Mapbox has no spend cap — always restrict tokens by domain + set a usage alert.
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Basemap =
  | { provider: 'esri' }
  | { provider: 'mapbox'; token: string };

function makeTileLayer(b: Basemap): L.TileLayer {
  if (b.provider === 'mapbox') {
    return L.tileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${b.token}`,
      { tileSize: 512, zoomOffset: -1, maxZoom: 20, attribution: '© Mapbox © OpenStreetMap' },
    );
  }
  return L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Tiles © Esri' },
  );
}

export type MapMarker = {
  lat: number;
  lng: number;
  color: 'blue' | 'green' | 'orange' | 'red';
  label?: string;
  draggable?: boolean;
  onDragEnd?: (lat: number, lng: number) => void;
};

export type MapPolyline = {
  points: [number, number][];
  color?: string;
};

type Props = {
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  onMapClick?: (lat: number, lng: number) => void;
  basemap?: Basemap;
  className?: string;
  panTo?: [number, number] | null;
  /** Increment to force re-pan even if panTo coordinates haven't changed (e.g. explicit recenter tap) */
  panToKey?: number;
  /** Fires when the user manually drags the map */
  onUserMove?: () => void;
};

const COLOR_HEX: Record<MapMarker['color'], string> = {
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  red: '#ef4444',
};

function makeIcon(color: MapMarker['color'], size = 16): L.DivIcon {
  const hex = COLOR_HEX[color];
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${hex};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.6)"></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function GolfMap({
  center, zoom = 17, markers = [], polylines = [],
  onMapClick, basemap = { provider: 'esri' }, className, panTo, panToKey, onUserMove,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef<L.Marker[]>([]);
  const polylineRefs = useRef<L.Polyline[]>([]);
  const prevPanTo = useRef<[number, number] | null>(null);
  const prevPanToKey = useRef<number>(-1);

  // Initialize map once on mount
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
    makeTileLayer(basemap).addTo(map);
    map.setView(center, zoom);
    mapRef.current = map;
    // Fix size in flex/grid containers (also needed when modal animates in)
    setTimeout(() => map.invalidateSize(), 150);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Map click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!onMapClick) return;
    const handler = (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng);
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [onMapClick]);

  // Programmatic pan — fires when coordinates change OR panToKey increments
  useEffect(() => {
    if (!panTo || !mapRef.current) return;
    const key = panToKey ?? 0;
    const sameCoords = prevPanTo.current?.[0] === panTo[0] && prevPanTo.current?.[1] === panTo[1];
    if (sameCoords && key === prevPanToKey.current) return;
    mapRef.current.flyTo(panTo, zoom ?? 17, { duration: 0.5 });
    prevPanTo.current = panTo;
    prevPanToKey.current = key;
  }, [panTo, panToKey, zoom]);

  // Notify caller when user manually drags the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onUserMove) return;
    const handler = () => onUserMove();
    map.on('dragstart', handler);
    return () => { map.off('dragstart', handler); };
  }, [onUserMove]);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRefs.current.forEach(m => m.remove());
    markerRefs.current = [];
    markers.forEach(def => {
      const icon = makeIcon(def.color);
      const marker = L.marker([def.lat, def.lng], { icon, draggable: def.draggable ?? false }).addTo(map);
      if (def.label) {
        marker.bindTooltip(def.label, { permanent: true, direction: 'top', offset: [0, -12] });
      }
      if (def.draggable && def.onDragEnd) {
        marker.on('dragend', () => {
          const p = marker.getLatLng();
          def.onDragEnd!(p.lat, p.lng);
        });
      }
      markerRefs.current.push(marker);
    });
  }, [markers]);

  // Update polylines
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    polylineRefs.current.forEach(p => p.remove());
    polylineRefs.current = [];
    polylines.forEach(def => {
      const line = L.polyline(def.points, { color: def.color ?? '#f97316', weight: 3, dashArray: '6 4' }).addTo(map);
      polylineRefs.current.push(line);
    });
  }, [polylines]);

  return <div ref={containerRef} className={className ?? 'w-full h-full'} />;
}
