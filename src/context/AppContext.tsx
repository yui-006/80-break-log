import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { Course, Round, Club, AppData } from '../types';
import { storage } from '../db/indexedDB';
import { INITIAL_CLUBS } from '../data/initial';

type AppState = {
  courses: Course[];
  rounds: Round[];
  clubs: Club[];
  loading: boolean;
  error: string | null;
};

type AppAction =
  | { type: 'LOAD'; payload: { courses: Course[]; rounds: Round[]; clubs: Club[] } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPSERT_COURSE'; payload: Course }
  | { type: 'DELETE_COURSE'; payload: string }
  | { type: 'UPSERT_ROUND'; payload: Round }
  | { type: 'DELETE_ROUND'; payload: string }
  | { type: 'UPSERT_CLUB'; payload: Club }
  | { type: 'DELETE_CLUB'; payload: string }
  | { type: 'LOAD_DATA'; payload: AppData };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD':
      return { ...state, ...action.payload, loading: false };
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
    case 'UPSERT_CLUB':
      return {
        ...state,
        clubs: state.clubs.some(c => c.id === action.payload.id)
          ? state.clubs.map(c => c.id === action.payload.id ? action.payload : c)
          : [...state.clubs, action.payload],
      };
    case 'DELETE_CLUB':
      return { ...state, clubs: state.clubs.filter(c => c.id !== action.payload) };
    case 'LOAD_DATA':
      return {
        ...state,
        courses: action.payload.courses,
        rounds: action.payload.rounds,
        clubs: action.payload.clubs,
      };
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
    loading: true,
    error: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const [courses, rounds, clubs] = await Promise.all([
          storage.getCourses(),
          storage.getRounds(),
          storage.getClubs(),
        ]);
        let effectiveClubs = clubs;
        if (clubs.length === 0) {
          for (const club of INITIAL_CLUBS) {
            await storage.saveClub(club);
          }
          effectiveClubs = INITIAL_CLUBS;
        }
        dispatch({ type: 'LOAD', payload: { courses, rounds, clubs: effectiveClubs } });
      } catch (e) {
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

  const saveClub = useCallback(async (club: Club) => {
    await storage.saveClub(club);
    dispatch({ type: 'UPSERT_CLUB', payload: club });
  }, []);

  const deleteClub = useCallback(async (id: string) => {
    await storage.deleteClub(id);
    dispatch({ type: 'DELETE_CLUB', payload: id });
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
    for (const club of INITIAL_CLUBS) {
      await storage.saveClub(club);
    }
    dispatch({ type: 'LOAD', payload: { courses: [], rounds: [], clubs: INITIAL_CLUBS } });
  }, []);

  return (
    <AppContext.Provider value={{
      state,
      saveCourse,
      deleteCourse,
      saveRound,
      deleteRound,
      saveClub,
      deleteClub,
      exportData,
      importData,
      clearAll,
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
