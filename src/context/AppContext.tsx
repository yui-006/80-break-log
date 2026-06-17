import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Course, Round, Club, ClubSet, PracticeMenuItem, PracticeLogEntry, AppData } from '../types';
import { storage } from '../db/indexedDB';
import { INITIAL_CLUBS } from '../data/initial';
import { supabase } from '../lib/supabase';
import {
  syncCourse, syncRound, syncClubSet, syncPracticeLog, syncGoalThreshold,
  deleteSyncCourse, deleteSyncRound, deleteSyncClubSet, deleteSyncPracticeLog,
  pullAll, pushAll, mergeWithLocal,
} from '../lib/sync';

const ACTIVE_SET_KEY = '80bl-active-set';
const GOAL_KEY       = '80bl-goal';
const MIGRATED_KEY   = '80bl-migrated';
const DEFAULT_GOAL   = 95;

function genId() { return crypto.randomUUID(); }

/** Fire-and-forget: log sync errors without blocking UI */
function bg(p: Promise<unknown>): void {
  p.catch(e => console.warn('[sync]', e));
}

// ── State ──────────────────────────────────────────────────────────────────

type SyncStatus = 'idle' | 'syncing' | 'error';

type AppState = {
  courses: Course[];
  rounds: Round[];
  clubs: Club[];
  clubSets: ClubSet[];
  activeClubSetId: string | null;
  practiceMenuItems: PracticeMenuItem[];
  practiceLogs: PracticeLogEntry[];
  goalThreshold: number;
  user: User | null;
  syncStatus: SyncStatus;
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
  | { type: 'LOAD_DATA'; payload: AppData }
  | { type: 'SET_GOAL'; payload: number }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: 'MERGE_CLOUD'; payload: { courses: Course[]; rounds: Round[]; clubSets: ClubSet[]; practiceLogs: PracticeLogEntry[]; goalThreshold?: number | null; activeClubSetId?: string | null } };

function activeClubs(sets: ClubSet[], activeId: string | null): Club[] {
  return sets.find(s => s.id === activeId)?.clubs ?? [];
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD': {
      const clubs = activeClubs(action.payload.clubSets, action.payload.activeClubSetId);
      return { ...state, ...action.payload, clubs, loading: false };
    }
    case 'SET_LOADING':  return { ...state, loading: action.payload };
    case 'SET_ERROR':    return { ...state, error: action.payload };
    case 'SET_USER':     return { ...state, user: action.payload };
    case 'SET_SYNC_STATUS': return { ...state, syncStatus: action.payload };

    case 'UPSERT_COURSE':
      return { ...state, courses: state.courses.some(c => c.id === action.payload.id)
        ? state.courses.map(c => c.id === action.payload.id ? action.payload : c)
        : [...state.courses, action.payload] };
    case 'DELETE_COURSE':
      return { ...state, courses: state.courses.filter(c => c.id !== action.payload) };

    case 'UPSERT_ROUND':
      return { ...state, rounds: state.rounds.some(r => r.id === action.payload.id)
        ? state.rounds.map(r => r.id === action.payload.id ? action.payload : r)
        : [...state.rounds, action.payload] };
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
      return { ...state, practiceMenuItems: state.practiceMenuItems.some(m => m.id === action.payload.id)
        ? state.practiceMenuItems.map(m => m.id === action.payload.id ? action.payload : m)
        : [...state.practiceMenuItems, action.payload] };
    case 'DELETE_PRACTICE_MENU_ITEM':
      return { ...state, practiceMenuItems: state.practiceMenuItems.filter(m => m.id !== action.payload) };

    case 'UPSERT_PRACTICE_LOG':
      return { ...state, practiceLogs: state.practiceLogs.some(l => l.id === action.payload.id)
        ? state.practiceLogs.map(l => l.id === action.payload.id ? action.payload : l)
        : [...state.practiceLogs, action.payload] };
    case 'DELETE_PRACTICE_LOG':
      return { ...state, practiceLogs: state.practiceLogs.filter(l => l.id !== action.payload) };

    case 'LOAD_DATA': {
      const sets = action.payload.clubSets ?? [];
      const activeId = action.payload.activeClubSetId ?? sets[0]?.id ?? null;
      return { ...state,
        courses: action.payload.courses,
        rounds: action.payload.rounds,
        clubSets: sets, activeClubSetId: activeId,
        clubs: activeClubs(sets, activeId),
        practiceMenuItems: action.payload.practiceMenuItems ?? [],
        practiceLogs: action.payload.practiceLogs ?? [],
      };
    }

    case 'SET_GOAL':
      return { ...state, goalThreshold: action.payload };

    case 'MERGE_CLOUD': {
      const { courses, rounds, clubSets, practiceLogs, goalThreshold, activeClubSetId } = action.payload;
      const newActiveId = activeClubSetId ?? state.activeClubSetId;
      return { ...state,
        courses, rounds, clubSets, practiceLogs,
        activeClubSetId: newActiveId,
        clubs: activeClubs(clubSets, newActiveId),
        goalThreshold: goalThreshold ?? state.goalThreshold,
      };
    }

    default: return state;
  }
}

// ── Context type ───────────────────────────────────────────────────────────

type AppContextType = {
  state: AppState;
  goalThreshold: number;
  setGoalThreshold: (v: number) => void;
  user: User | null;
  syncStatus: SyncStatus;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
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

// ── Provider ───────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    courses: [], rounds: [], clubs: [], clubSets: [],
    activeClubSetId: null, practiceMenuItems: [], practiceLogs: [],
    goalThreshold: Number(localStorage.getItem(GOAL_KEY) ?? DEFAULT_GOAL) || DEFAULT_GOAL,
    user: null, syncStatus: 'idle',
    loading: true, error: null,
  });

  // Ref to always access latest state inside async callbacks
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  // ── Load from IndexedDB on startup ───────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [courses, rounds, existingClubs, clubSets, practiceMenuItems, practiceLogs] = await Promise.all([
          storage.getCourses(), storage.getRounds(), storage.getClubs(),
          storage.getClubSets(), storage.getPracticeMenuItems(), storage.getPracticeLogs(),
        ]);

        let sets = clubSets;
        if (sets.length === 0) {
          const initClubs = existingClubs.length > 0 ? existingClubs : INITIAL_CLUBS;
          if (existingClubs.length === 0) {
            for (const c of INITIAL_CLUBS) await storage.saveClub(c);
          }
          const defaultSet: ClubSet = { id: genId(), name: '現在のセッティング', clubs: initClubs, createdAt: new Date().toISOString() };
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

  // ── Auth: subscribe to session changes ───────────────────────────────────

  useEffect(() => {
    // Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        dispatch({ type: 'SET_USER', payload: session.user });
        handleCloudSync();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      dispatch({ type: 'SET_USER', payload: session?.user ?? null });
      if (event === 'SIGNED_IN' && session?.user) {
        handleCloudSync();
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCloudSync() {
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
    try {
      const pulled = await pullAll();
      if (!pulled) { dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }); return; }

      const cur = stateRef.current;
      const alreadyMigrated = localStorage.getItem(MIGRATED_KEY);

      if (!alreadyMigrated) {
        // First login: push all local data to Supabase
        await pushAll(
          cur.courses, cur.rounds, cur.clubSets, cur.practiceLogs,
          cur.goalThreshold, cur.activeClubSetId,
        );
        localStorage.setItem(MIGRATED_KEY, 'true');
      } else {
        // Subsequent login: merge cloud → local (last-write-wins)
        const merged = mergeWithLocal(pulled, {
          courses: cur.courses, rounds: cur.rounds,
          clubSets: cur.clubSets, practiceLogs: cur.practiceLogs,
        });

        // Persist merged data to IndexedDB
        const db = await import('../db/indexedDB').then(m => m.storage);
        await Promise.all([
          ...merged.courses.map(c => db.saveCourse(c)),
          ...merged.rounds.map(r => db.saveRound(r)),
          ...merged.clubSets.map(s => db.saveClubSet(s)),
          ...merged.practiceLogs.map(l => db.savePracticeLog(l)),
        ]);

        dispatch({ type: 'MERGE_CLOUD', payload: {
          ...merged,
          goalThreshold: pulled.goalThreshold,
          activeClubSetId: pulled.activeClubSetId,
        }});

        if (pulled.goalThreshold != null) {
          localStorage.setItem(GOAL_KEY, String(pulled.goalThreshold));
        }
        if (pulled.activeClubSetId) {
          localStorage.setItem(ACTIVE_SET_KEY, pulled.activeClubSetId);
        }
      }

      dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
    } catch (e) {
      console.warn('[sync]', e);
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
    }
  }

  // ── Auth actions ──────────────────────────────────────────────────────────

  const signIn = useCallback(async (email: string) => {
    const redirectTo = window.location.origin + (import.meta.env.BASE_URL ?? '/');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    dispatch({ type: 'SET_USER', payload: null });
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
  }, []);

  // ── Goal threshold ─────────────────────────────────────────────────────────

  const setGoalThreshold = useCallback((v: number) => {
    localStorage.setItem(GOAL_KEY, String(v));
    dispatch({ type: 'SET_GOAL', payload: v });
    bg(syncGoalThreshold(v, stateRef.current.activeClubSetId));
  }, []);

  // ── Courses ───────────────────────────────────────────────────────────────

  const saveCourse = useCallback(async (course: Course) => {
    await storage.saveCourse(course);
    dispatch({ type: 'UPSERT_COURSE', payload: course });
    bg(syncCourse(course));
  }, []);

  const deleteCourse = useCallback(async (id: string) => {
    await storage.deleteCourse(id);
    dispatch({ type: 'DELETE_COURSE', payload: id });
    bg(deleteSyncCourse(id));
  }, []);

  // ── Rounds ────────────────────────────────────────────────────────────────

  const saveRound = useCallback(async (round: Round) => {
    await storage.saveRound(round);
    dispatch({ type: 'UPSERT_ROUND', payload: round });
    bg(syncRound(round));
  }, []);

  const deleteRound = useCallback(async (id: string) => {
    await storage.deleteRound(id);
    dispatch({ type: 'DELETE_ROUND', payload: id });
    bg(deleteSyncRound(id));
  }, []);

  // ── Clubs ─────────────────────────────────────────────────────────────────

  const saveClub = useCallback(async (club: Club) => {
    const cur = stateRef.current;
    const activeSet = cur.clubSets.find(s => s.id === cur.activeClubSetId);
    if (!activeSet) return;
    const updatedSet: ClubSet = {
      ...activeSet,
      clubs: activeSet.clubs.some(c => c.id === club.id)
        ? activeSet.clubs.map(c => c.id === club.id ? club : c)
        : [...activeSet.clubs, club],
    };
    await storage.saveClubSet(updatedSet);
    dispatch({ type: 'UPSERT_CLUB_SET', payload: updatedSet });
    bg(syncClubSet(updatedSet));
  }, []);

  const deleteClub = useCallback(async (id: string) => {
    const cur = stateRef.current;
    const activeSet = cur.clubSets.find(s => s.id === cur.activeClubSetId);
    if (!activeSet) return;
    const updatedSet: ClubSet = { ...activeSet, clubs: activeSet.clubs.filter(c => c.id !== id) };
    await storage.saveClubSet(updatedSet);
    dispatch({ type: 'UPSERT_CLUB_SET', payload: updatedSet });
    bg(syncClubSet(updatedSet));
  }, []);

  // ── Club sets ─────────────────────────────────────────────────────────────

  const saveClubSet = useCallback(async (set: ClubSet) => {
    await storage.saveClubSet(set);
    dispatch({ type: 'UPSERT_CLUB_SET', payload: set });
    bg(syncClubSet(set));
  }, []);

  const deleteClubSet = useCallback(async (id: string) => {
    await storage.deleteClubSet(id);
    dispatch({ type: 'DELETE_CLUB_SET', payload: id });
    bg(deleteSyncClubSet(id));
  }, []);

  const setActiveClubSet = useCallback((id: string) => {
    localStorage.setItem(ACTIVE_SET_KEY, id);
    dispatch({ type: 'SET_ACTIVE_CLUB_SET', payload: id });
    bg(syncGoalThreshold(stateRef.current.goalThreshold, id));
  }, []);

  // ── Practice ──────────────────────────────────────────────────────────────

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
    bg(syncPracticeLog(entry));
  }, []);

  const deletePracticeLog = useCallback(async (id: string) => {
    await storage.deletePracticeLog(id);
    dispatch({ type: 'DELETE_PRACTICE_LOG', payload: id });
    bg(deleteSyncPracticeLog(id));
  }, []);

  // ── Export / Import / Clear ───────────────────────────────────────────────

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
    const defaultSet: ClubSet = { id: genId(), name: '現在のセッティング', clubs: INITIAL_CLUBS, createdAt: new Date().toISOString() };
    await storage.saveClubSet(defaultSet);
    localStorage.setItem(ACTIVE_SET_KEY, defaultSet.id);
    localStorage.removeItem(MIGRATED_KEY);
    dispatch({ type: 'LOAD', payload: { courses: [], rounds: [], clubSets: [defaultSet], activeClubSetId: defaultSet.id, practiceMenuItems: [], practiceLogs: [] } });
  }, []);

  return (
    <AppContext.Provider value={{
      state,
      goalThreshold: state.goalThreshold,
      setGoalThreshold,
      user: state.user,
      syncStatus: state.syncStatus,
      signIn, signOut,
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
