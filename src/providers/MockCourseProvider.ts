import type { Course, CourseHole, CourseSearchResult } from '../types';

export interface CourseDataProvider {
  search(query: string): Promise<CourseSearchResult[]>;
  getCourseDetail(id: string): Promise<Partial<Course> | undefined>;
}

type HoleRaw = [number, number, number, number, number, number, number?]; // [par, back, regular, front, ladies, hdcp, custom?]

const MOCK_COURSES_RAW: {
  id: string;
  name: string;
  prefecture: string;
  location: string;
  sourceUrl: string;
  holes: HoleRaw[];
}[] = [
  {
    id: 'mock-1',
    name: '太平洋クラブ 御殿場コース',
    prefecture: '静岡県',
    location: '静岡県御殿場市板妻',
    sourceUrl: 'https://www.pacific-golf.co.jp/gotemba/',
    holes: [
      [4, 405, 385, 365, 310,  5],
      [4, 378, 355, 330, 285, 11],
      [3, 210, 190, 170, 145, 13],
      [5, 528, 505, 480, 425,  1],
      [4, 395, 370, 345, 295,  7],
      [4, 360, 340, 315, 268, 15],
      [3, 185, 165, 145, 118, 17],
      [5, 540, 515, 488, 432,  3],
      [4, 415, 390, 365, 315,  9],
      [4, 388, 365, 340, 290,  6],
      [3, 195, 175, 155, 132, 14],
      [5, 520, 498, 472, 418,  2],
      [4, 402, 380, 355, 305,  8],
      [4, 372, 350, 325, 278, 12],
      [3, 178, 158, 138, 112, 18],
      [4, 415, 392, 367, 315,  4],
      [5, 545, 520, 492, 435, 10],
      [4, 398, 375, 350, 300, 16],
    ],
  },
  {
    id: 'mock-2',
    name: '川奈ホテルゴルフコース 大島コース',
    prefecture: '静岡県',
    location: '静岡県伊東市川奈',
    sourceUrl: 'https://www.kawana-hotel.co.jp/golf/',
    holes: [
      [4, 390, 370, 348, 302,  3],
      [5, 510, 488, 462, 408,  9],
      [3, 198, 178, 158, 130, 15],
      [4, 382, 360, 336, 288, 11],
      [4, 368, 348, 325, 278,  7],
      [3, 205, 185, 162, 135, 17],
      [5, 532, 508, 482, 428,  1],
      [4, 398, 376, 352, 302,  5],
      [4, 378, 358, 335, 285, 13],
      [4, 405, 382, 358, 308,  2],
      [3, 188, 168, 148, 122, 18],
      [4, 372, 352, 328, 280, 10],
      [5, 518, 495, 470, 415,  4],
      [4, 388, 368, 345, 296,  8],
      [4, 362, 342, 320, 272, 14],
      [3, 195, 175, 155, 128, 16],
      [5, 528, 505, 480, 425,  6],
      [4, 418, 396, 372, 320, 12],
    ],
  },
  {
    id: 'mock-3',
    name: '富士桜カントリー倶楽部',
    prefecture: '山梨県',
    location: '山梨県南都留郡富士河口湖町',
    sourceUrl: 'https://www.fujizakura.co.jp/',
    holes: [
      [4, 412, 392, 370, 318,  7],
      [3, 202, 182, 162, 135, 15],
      [4, 385, 365, 342, 292,  3],
      [5, 535, 512, 486, 432,  1],
      [4, 375, 355, 332, 282, 11],
      [4, 362, 342, 320, 272, 13],
      [3, 192, 172, 152, 126, 17],
      [5, 545, 522, 496, 440,  5],
      [4, 398, 378, 355, 305,  9],
      [4, 408, 388, 365, 315,  4],
      [5, 522, 500, 474, 420,  2],
      [3, 188, 168, 148, 122, 16],
      [4, 372, 352, 330, 282,  8],
      [4, 388, 368, 345, 296, 10],
      [3, 198, 178, 158, 132, 18],
      [4, 380, 360, 338, 288, 12],
      [5, 538, 515, 490, 435,  6],
      [4, 402, 382, 358, 308, 14],
    ],
  },
  {
    id: 'mock-4',
    name: '東京よみうりカントリークラブ',
    prefecture: '東京都',
    location: '東京都稲城市矢野口',
    sourceUrl: 'https://www.yomiuri-cc.co.jp/',
    holes: [
      [4, 395, 375, 352, 300,  5],
      [4, 368, 348, 326, 278, 13],
      [3, 188, 168, 148, 122, 17],
      [5, 525, 502, 476, 422,  1],
      [4, 385, 365, 342, 292,  7],
      [4, 372, 352, 330, 280,  9],
      [3, 195, 175, 155, 128, 15],
      [5, 538, 515, 488, 432,  3],
      [4, 408, 388, 365, 312, 11],
      [4, 382, 362, 340, 290,  6],
      [3, 200, 180, 160, 132, 14],
      [5, 515, 492, 466, 412,  2],
      [4, 392, 372, 350, 298,  8],
      [4, 365, 345, 322, 274, 12],
      [3, 182, 162, 142, 116, 18],
      [4, 412, 392, 368, 316,  4],
      [5, 542, 518, 492, 436, 10],
      [4, 395, 375, 352, 302, 16],
    ],
  },
  {
    id: 'mock-5',
    name: '三甲ゴルフ倶楽部 榊原温泉コース',
    prefecture: '三重県',
    location: '三重県津市榊原町',
    sourceUrl: 'https://www.sankoh-golf.co.jp/',
    holes: [
      [4, 388, 368, 346, 296,  9],
      [5, 528, 505, 480, 425,  3],
      [3, 195, 175, 155, 128, 15],
      [4, 372, 352, 330, 280, 11],
      [4, 398, 378, 355, 305,  5],
      [3, 185, 165, 145, 118, 17],
      [5, 535, 512, 486, 432,  1],
      [4, 362, 342, 320, 272, 13],
      [4, 405, 385, 362, 310,  7],
      [4, 378, 358, 336, 286,  8],
      [3, 192, 172, 152, 126, 16],
      [5, 520, 498, 472, 418,  2],
      [4, 382, 362, 340, 290, 10],
      [4, 368, 348, 326, 278, 12],
      [3, 202, 182, 162, 135, 18],
      [4, 392, 372, 350, 298,  4],
      [5, 542, 518, 492, 438,  6],
      [4, 408, 388, 365, 315, 14],
    ],
  },
  {
    id: 'mock-rose',
    name: 'ローズゴルフクラブ',
    prefecture: '滋賀県',
    location: '滋賀県甲賀市信楽町',
    sourceUrl: '',
    holes: [
      // [par, back(BLUE), regular(WHITE), front(GOLD), ladies(RED), hdcp, custom(SCARLETT)]
      [5, 518, 491, 468, 418,  5, 259],
      [4, 348, 330, 311, 242, 15, 184],
      [3, 178, 155, 143, 133, 17,  99],
      [4, 430, 410, 384, 286,  3, 242],
      [4, 408, 390, 336, 257,  7, 257],
      [4, 343, 325, 323, 295, 13, 222],
      [5, 602, 584, 561, 450,  1, 388],
      [3, 184, 170, 152, 138, 11, 138],
      [4, 385, 360, 338, 308,  9, 197],
      [5, 555, 503, 477, 461,  6, 335],
      [4, 395, 371, 361, 251, 10, 251],
      [3, 165, 149, 149, 135, 18, 107],
      [5, 632, 558, 540, 409,  2, 315],
      [4, 379, 354, 354, 303, 16, 303],
      [4, 425, 400, 375, 277,  4, 245],
      [4, 345, 325, 304, 219, 12, 219],
      [3, 175, 157, 145, 126, 14, 101],
      [4, 412, 392, 362, 329,  8, 193],
    ],
  },
];

function buildCourse(raw: typeof MOCK_COURSES_RAW[0]): Partial<Course> {
  const now = new Date().toISOString();
  const holes: CourseHole[] = raw.holes.map((h, i) => ({
    id: `${raw.id}-h${i + 1}`,
    courseId: raw.id,
    holeNo: i + 1,
    par: h[0] as 3 | 4 | 5,
    handicap: h[5],
    yardsByTee: {
      back: h[1],
      regular: h[2],
      front: h[3],
      ladies: h[4],
      custom: h[6],
    },
  }));
  return {
    id: raw.id,
    name: raw.name,
    prefecture: raw.prefecture,
    location: raw.location,
    source: 'mock',
    sourceId: raw.id,
    sourceUrl: raw.sourceUrl,
    holes,
    createdAt: now,
    updatedAt: now,
  };
}

export class MockCourseProvider implements CourseDataProvider {
  async search(query: string): Promise<CourseSearchResult[]> {
    await new Promise(r => setTimeout(r, 500));
    const q = query.toLowerCase();
    return MOCK_COURSES_RAW
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.prefecture.includes(query) ||
        c.location.includes(query) ||
        query === ''
      )
      .map(c => ({
        id: c.id,
        name: c.name,
        location: c.location,
        prefecture: c.prefecture,
        sourceUrl: c.sourceUrl,
        source: 'mock',
      }));
  }

  async getCourseDetail(id: string): Promise<Partial<Course> | undefined> {
    await new Promise(r => setTimeout(r, 300));
    const raw = MOCK_COURSES_RAW.find(c => c.id === id);
    if (!raw) return undefined;
    return buildCourse(raw);
  }
}

export const mockCourseProvider = new MockCourseProvider();
