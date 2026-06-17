export type ClubCategory = 'wood' | 'utility' | 'iron' | 'wedge' | 'putter';

export type Club = {
  id: string;
  name: string;
  category: ClubCategory;
  head?: string;
  loft?: number;
  shaft?: string;
  flex?: string;
};

export type ClubSet = {
  id: string;
  name: string;
  clubs: Club[];
  createdAt: string;
};

export type ShotType = 'tee' | 'full' | 'half' | 'approach' | 'bunker' | 'putt';

export type Course = {
  id: string;
  name: string;
  location?: string;
  prefecture?: string;
  source?: 'manual' | 'mock' | 'rakuten_gora' | 'golf_course_api' | 'official' | 'other';
  sourceId?: string;
  sourceUrl?: string;
  memo?: string;
  holes: CourseHole[];
  createdAt: string;
  updatedAt: string;
};

export type CourseHole = {
  id: string;
  courseId: string;
  holeNo: number;
  par: 3 | 4 | 5;
  handicap?: number;
  yardsByTee?: {
    back?: number;
    regular?: number;
    front?: number;
    ladies?: number;
    custom?: number;
  };
  memo?: string;
};

export type Round = {
  id: string;
  courseId: string;
  courseName: string;
  date: string;
  teeName?: string;
  targetScore?: number;
  weather?: string;
  memo?: string;
  status: 'recording' | 'completed';
  holes: RoundHole[];
  createdAt: string;
  updatedAt: string;
};

export type RoundHole = {
  id: string;
  roundId: string;
  courseHoleId: string;
  holeNo: number;
  par: number;
  yardage?: number;
  score?: number;
  putts?: number;
  puttDistance?: number;
  ob?: number;
  penalty?: number;
  memo?: string;
  shots: Shot[];
};

export type Shot = {
  id: string;
  roundHoleId: string;
  shotNo: number;
  shotTypes?: ShotType[];
  clubId?: string;
  distance?: number;
  lies?: string[];
  results?: string[];
  direction?: string;
  penalty?: number;
  memo?: string;
  tags?: string[];
};

export type LossCategory = {
  key: string;
  label: string;
  count: number;
  estimatedLoss: number;
};

export type ScoreStats = {
  totalScore: number;
  totalPar: number;
  totalPutts: number;
  totalOB: number;
  totalPenalty: number;
  frontScore: number;
  backScore: number;
  frontPar: number;
  backPar: number;
  par3Avg: number | null;
  par4Avg: number | null;
  par5Avg: number | null;
  threePuttCount: number;
  doubleBogeysOrWorse: number;
  bogeyOnRate: number;
  parOnRate: number;
};

export type PracticeItem = {
  priority: number;
  category: string;
  reason: string;
  content: string;
  checklist: string[];
  recentMissCount: number;
};

export type PracticeMenuItem = {
  id: string;
  name: string;
  createdAt: string;
};

export type PracticeLogEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  menuName: string;
  ballCount?: number;
  createdAt: string;
};

export type CourseSearchResult = {
  id: string;
  name: string;
  location?: string;
  prefecture?: string;
  sourceUrl?: string;
  source: string;
};

export type GreenPoint = {
  id: string;
  courseId: string;
  holeNumber: number;
  lat: number;
  lng: number;
  pointType: 'center';
  updatedAt: string;
};

export type AppData = {
  courses: Course[];
  rounds: Round[];
  clubs: Club[];
  clubSets?: ClubSet[];
  activeClubSetId?: string;
  practiceMenuItems?: PracticeMenuItem[];
  practiceLogs?: PracticeLogEntry[];
  greenPoints?: GreenPoint[];
  exportedAt: string;
  version: string;
};
