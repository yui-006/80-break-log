import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { Course, Round, Club, ClubSet, PracticeMenuItem, PracticeLogEntry, AppData } from '../types';
import { storage } from '../db/indexedDB';
import { INITIAL_CLUBS } from '../data/initial';

const ACTIVE_SET_KEY = '80bl-active-set';
function genId() { return crypto.randomUUID(); }

type AppState = {
  courses: Course[];
  rounds: Round[];
  clubs: Club[];
  clubSets: ClubSet[];
  activeClubSetId: string | null;
  practiceMenuItems: PracticeMenuItem[];
  practiceLogs: PracticeLogEntry[];
  loading: boolean;
  error: string | null;
};

type AppAction =
  | { type: 'LOAD'; payload: { courses: Course[]; rounds: Round[]; clubSets: ClubSet[]; activeClubSetId: string | null; practiceMenuItems: PracticeMenuItem[]; practiceLogs: PracticeLogEntry[] } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPSERT_COURSE'; payload: Course }
  | { type: 'DELETE_COURSE'; payload: string }
  | { type: 'UPSERT_ROUND'; payload: Round }
  | { type: 'DELETE_ROUND'; payload: string }
  | { type: 'UPSERT_CLUB_SET'; payload: ClubSet }
  | { type: 'DELETE_CLUB_SET'; payload: string }
  | { type: 'SET_ACTIVE_CLUB_SET'; payload: string }
  | { type: 'UPSERT_PRACTICE_MENU_ITEM'; payload: PracticeMenuItem }
  | { type: 'DELETE_PRACTICE_MENU_ITEM'; payload: string }
  | { type: 'UPSERT_PRACTICE_LOG'; payload: PracticeLogEntry }
  | { type: 'DELETE_PRACTICE_LOG'; payload: string }
  | { type: 'LOAD_DATA'; payload: AppData };

function activeClubs(sets: ClubSet[], activeId: string | null): Club[] {
  return sets.find(s => s.id === activeId)?.clubs ?? [];
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD': {
      const clubs = activeClubs(action.payload.clubSets, action.payload.activeClubSetId);
      return { ...state, ...action.payload, clubs, loading: false };
    }
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'UPSERT_COURSE':
      return {
        ...state,
        courses: state.courses.some(c => c.id === action.payload.id)
          ? state.courses.map(c => c.id === action.payload.id ? action.payload : c)
          : [...state.courses, action.payload],
      };
    case 'DELETE_COURSE':
      return { ...state, courses: state.courses.filter(c => c.id !== action.payload) };
    case 'UPSERT_ROUND':
      return {
        ...state,
        rounds: state.rounds.some(r => r.id === action.payload.id)
          ? state.rounds.map(r => r.id === action.payload.id ? action.payload : r)
          : [...state.rounds, action.payload],
      };
    case 'DELETE_ROUND':
      return { ...state, rounds: state.rounds.filter(r => r.id !== action.payload) };
    case 'UPSERT_CLUB_SET': {
      const sets = state.clubSets.some(s => s.id === action.payload.id)
        ? state.clubSets.map(s => s.id === action.payload.id ? action.payload : s)
        : [...state.clubSets, action.payload];
      return { ...state, clubSets: sets, clubs: activeClubs(sets, state.activeClubSetId) };
    }
    case 'DELETE_CLUB_SET':
      return { ...state, clubSets: state.clubSets.filter(s => s.id !== action.payload) };
    case 'SET_ACTIVE_CLUB_SET': {
      const clubs = activeClubs(state.clubSets, action.payload);
      return { ...state, activeClubSetId: action.payload, clubs };
    }
    case 'UPSERT_PRACTICE_MENU_ITEM':
      return {
        ...state,
        practiceMenuItems: state.practiceMenuItems.some(m => m.id === action.payload.id)
          ? state.practiceMenuItems.map(m => m.id === action.payload.id ? action.payload : m)
          : [...state.practiceMenuItems, action.payload],
      };
    case 'DELETE_PRACTICE_MENU_ITEM':
      return { ...state, practiceMenuItems: state.practiceMenuItems.filter(m => m.id !== action.payload) };
    case 'UPSERT_PRACTICE_LOG':
      return {
        ...state,
        practiceLogs: state.practiceLogs.some(l => l.id === action.payload.id)
          ? state.practiceLogs.map(l => l.id === action.payload.id ? action.payload : l)
          : [...state.practiceLogs, action.payload],
      };
    case 'DELETE_PRACTICE_LOG':
      return { ...state, practiceLogs: state.practiceLogs.filter(l => l.id !== action.payload) };
    case 'LOAD_DATA': {
      const sets = action.payload.clubSets ?? [];
      const activeId = action.payload.activeClubSetId ?? sets[0]?.id ?? null;
      return {
        ...state,
        courses: action.payload.courses,
        rounds: action.payload.rounds,
        clubSets: sets,
        activeClubSetId: activeId,
        clubs: activeClubs(sets, activeId),
        practiceMenuItems: action.payload.practiceMenuItems ?? [],
        practiceLogs: action.payload.practiceLogs ?? [],
      };
    }
    default:
      return state;
  }
}

type AppContextType = {
  state: AppState;
  saveCourse: (course: Course) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  saveRound: (round: Round) => Promise<void>;
  deleteRound: (id: string) => Promise<void>;
  saveClub: (club: Club) => Promise<void>;
  deleteClub: (id: string) => Promise<void>;
  saveClubSet: (set: ClubSet) => Promise<void>;
  deleteClubSet: (id: string) => Promise<void>;
  setActiveClubSet: (id: string) => void;
  savePracticeMenuItem: (item: PracticeMenuItem) => Promise<void>;
  deletePracticeMenuItem: (id: string) => Promise<void>;
  savePracticeLog: (entry: PracticeLogEntry) => Promise<void>;
  deletePracticeLog: (id: string) => Promise<void>;
  exportData: () => Promise<string>;
  importData: (json: string) => Promise<void>;
  clearAll: () => Promise<void>;
};

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    courses: [],
    rounds: [],
    clubs: [],
    clubSets: [],
    activeClubSetId: null,
    practiceMenuItems: [],
    practiceLogs: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const [courses, rounds, existingClubs, clubSets, practiceMenuItems, practiceLogs] = await Promise.all([
          storage.getCourses(),
          storage.getRounds(),
          storage.getClubs(),
          storage.getClubSets(),
          storage.getPracticeMenuItems(),
          storage.getPracticeLogs(),
        ]);

        let sets = clubSets;
        if (sets.length === 0) {
          // 初回起動：既存クラブ or INITIAL_CLUBSからデフォルトセット作成
          const initClubs = existingClubs.length > 0 ? existingClubs : INITIAL_CLUBS;
          if (existingClubs.length === 0) {
            for (const c of INITIAL_CLUBS) await storage.saveClub(c);
          }
          const defaultSet: ClubSet = {
            id: genId(),
            name: '現在のセッティング',
            clubs: initClubs,
            createdAt: new Date().toISOString(),
          };
          await storage.saveClubSet(defaultSet);
          sets = [defaultSet];
        }

        const storedId = localStorage.getItem(ACTIVE_SET_KEY);
        const activeId = sets.find(s => s.id === storedId)?.id ?? sets[0].id;
        if (!storedId) localStorage.setItem(ACTIVE_SET_KEY, activeId);

        dispatch({ type: 'LOAD', payload: { courses, rounds, clubSets: sets, activeClubSetId: activeId, practiceMenuItems, practiceLogs } });
      } catch {
        dispatch({ type: 'SET_ERROR', payload: 'データの読み込みに失敗しました' });
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    })();
  }, []);

  const saveCourse = useCallback(async (course: Course) => {
    await storage.saveCourse(course);
    dispatch({ type: 'UPSERT_COURSE', payload: course });
  }, []);

  const deleteCourse = useCallback(async (id: string) => {
    await storage.deleteCourse(id);
    dispatch({ type: 'DELETE_COURSE', payload: id });
  }, []);

  const saveRound = useCallback(async (round: Round) => {
    await storage.saveRound(round);
    dispatch({ type: 'UPSERT_ROUND', payload: round });
  }, []);

  const deleteRound = useCallback(async (id: string) => {
    await storage.deleteRound(id);
    dispatch({ type: 'DELETE_ROUND', payload: id });
  }, []);

  // クラブ保存：アクティブセットの clubs 配列を更新
  const saveClub = useCallback(async (club: Club) => {
    const activeSet = state.clubSets.find(s => s.id === state.activeClubSetId);
    if (!activeSet) return;
    const updatedSet: ClubSet = {
      ...activeSet,
      clubs: activeSet.clubs.some(c => c.id === club.id)
        ? activeSet.clubs.map(c => c.id === club.id ? club : c)
        : [...activeSet.clubs, club],
    };
    await storage.saveClubSet(updatedSet);
    dispatch({ type: 'UPSERT_CLUB_SET', payload: updatedSet });
  }, [state.clubSets, state.activeClubSetId]);

  const deleteClub = useCallback(async (id: string) => {
    const activeSet = state.clubSets.find(s => s.id === state.activeClubSetId);
    if (!activeSet) return;
    const updatedSet: ClubSet = { ...activeSet, clubs: activeSet.clubs.filter(c => c.id !== id) };
    await storage.saveClubSet(updatedSet);
    dispatch({ type: 'UPSERT_CLUB_SET', payload: updatedSet });
  }, [state.clubSets, state.activeClubSetId]);

  const saveClubSet = useCallback(async (set: ClubSet) => {
    await storage.saveClubSet(set);
    dispatch({ type: 'UPSERT_CLUB_SET', payload: set });
  }, []);

  const deleteClubSet = useCallback(async (id: string) => {
    await storage.deleteClubSet(id);
    dispatch({ type: 'DELETE_CLUB_SET', payload: id });
  }, []);

  const setActiveClubSet = useCallback((id: string) => {
    localStorage.setItem(ACTIVE_SET_KEY, id);
    dispatch({ type: 'SET_ACTIVE_CLUB_SET', payload: id });
  }, []);

  const savePracticeMenuItem = useCallback(async (item: PracticeMenuItem) => {
    await storage.savePracticeMenuItem(item);
    dispatch({ type: 'UPSERT_PRACTICE_MENU_ITEM', payload: item });
  }, []);

  const deletePracticeMenuItem = useCallback(async (id: string) => {
    await storage.deletePracticeMenuItem(id);
    dispatch({ type: 'DELETE_PRACTICE_MENU_ITEM', payload: id });
  }, []);

  const savePracticeLog = useCallback(async (entry: PracticeLogEntry) => {
    await storage.savePracticeLog(entry);
    dispatch({ type: 'UPSERT_PRACTICE_LOG', payload: entry });
  }, []);

  const deletePracticeLog = useCallback(async (id: string) => {
    await storage.deletePracticeLog(id);
    dispatch({ type: 'DELETE_PRACTICE_LOG', payload: id });
  }, []);

  const exportData = useCallback(async () => {
    const data = await storage.exportData();
    return JSON.stringify(data, null, 2);
  }, []);

  const importData = useCallback(async (json: string) => {
    const data: AppData = JSON.parse(json);
    await storage.importData(data);
    dispatch({ type: 'LOAD_DATA', payload: data });
  }, []);

  const clearAll = useCallback(async () => {
    await storage.clearAll();
    const defaultSet: ClubSet = {
      id: genId(),
      name: '現在のセッティング',
      clubs: INITIAL_CLUBS,
      createdAt: new Date().toISOString(),
    };
    await storage.saveClubSet(defaultSet);
    localStorage.setItem(ACTIVE_SET_KEY, defaultSet.id);
    dispatch({ type: 'LOAD', payload: { courses: [], rounds: [], clubSets: [defaultSet], activeClubSetId: defaultSet.id, practiceMenuItems: [], practiceLogs: [] } });
  }, []);

  return (
    <AppContext.Provider value={{
      state,
      saveCourse, deleteCourse,
      saveRound, deleteRound,
      saveClub, deleteClub,
      saveClubSet, deleteClubSet, setActiveClubSet,
      savePracticeMenuItem, deletePracticeMenuItem,
      savePracticeLog, deletePracticeLog,
      exportData, importData, clearAll,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
