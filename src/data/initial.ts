import type { Club } from '../types';

export const INITIAL_CLUBS: Club[] = [
  { id: '1w',  name: '1W',  category: 'wood',    head: 'Callaway MAVRIK',           loft: 9,  shaft: 'Graphite Design AG33-4', flex: 'R' },
  { id: '3w',  name: '3W',  category: 'wood',    head: 'KAMUI XP-300',              loft: 15, shaft: 'Graphite Design AG33-4', flex: 'R' },
  { id: '7w',  name: '7W',  category: 'wood',    head: 'TaylorMade Qi10 MAX',       loft: 22, shaft: 'Diamana TM50',           flex: 'R' },
  { id: '5u',  name: '5U',  category: 'utility', head: 'TaylorMade Qi35',           loft: 25, shaft: 'Diamana TM50',           flex: 'R' },
  { id: '6i',  name: '6i',  category: 'iron',    head: 'AKIRA ADR',                 loft: 27, shaft: 'Zelos 7',                flex: 'S' },
  { id: '7i',  name: '7i',  category: 'iron',    head: 'AKIRA ADR',                 loft: 30, shaft: 'Zelos 7',                flex: 'S' },
  { id: '8i',  name: '8i',  category: 'iron',    head: 'AKIRA ADR',                 loft: 34, shaft: 'Zelos 7',                flex: 'S' },
  { id: '9i',  name: '9i',  category: 'iron',    head: 'AKIRA ADR',                 loft: 39, shaft: 'Zelos 7',                flex: 'S' },
  { id: 'pw',  name: 'PW',  category: 'wedge',   head: 'AKIRA ADR',                 loft: 44, shaft: 'Zelos 7',                flex: 'S' },
  { id: '48',  name: '48°', category: 'wedge',   head: 'AKIRA PROTOTYPE H-148-MB',  loft: 48, shaft: 'Zelos 7',                flex: 'S' },
  { id: '52',  name: '52°', category: 'wedge',   head: 'AKIRA PROTOTYPE H-148-MB',  loft: 52, shaft: 'Zelos 7',                flex: 'S' },
  { id: '58',  name: '58°', category: 'wedge',   head: 'AKIRA PROTOTYPE H-148-MB',  loft: 58, shaft: 'Zelos 7',                flex: 'S' },
  { id: 'pt',  name: 'PT',  category: 'putter' },
];

export const CLUBS_BY_SHOT_TYPE: Record<string, string[]> = {
  tee:      ['1w', '3w', '7w', '5u', '6i', '7i'],
  full:     ['7w', '5u', '6i', '7i', '8i', '9i', 'pw', '48'],
  half:     ['pw', '48', '52', '58'],
  approach: ['pw', '48', '52', '58', 'pt'],
  bunker:   ['58', '52'],
  putt:     ['pt'],
};

export const LIE_OPTIONS = [
  'ティー', 'FW', 'ラフ', '左足上がり', '左足下がり',
  'つま先上がり', 'つま先下がり', 'バンカー', 'グリーン周り', '花道',
];

export const RESULT_OPTIONS = [
  'ナイス', '普通', '右', '左', 'ショート', 'オーバー',
  'トップ', 'チョロ', 'ダフリ', 'OB', 'ペナルティ',
  'バンカー', 'ナイスアウト', 'ホームラン', '1回で出ない',
];

export const DIRECTION_OPTIONS = [
  '真っ直ぐ', '右', '左', '右ペラ', '引っかけ', '捕まった', '捕まらず右',
];

export const SHOT_TYPE_LABELS: Record<string, string> = {
  tee: 'ティー',
  full: 'フル',
  half: 'ハーフ',
  approach: 'アプローチ',
  bunker: 'バンカー',
  putt: 'パット',
};

export const WEATHER_OPTIONS = ['晴れ', '曇り', '雨', '強風', '霧'];
