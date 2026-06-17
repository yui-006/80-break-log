import { openDB } from 'idb';
import type { IDBPDatabase, DBSchema } from 'idb';
import type { Course, Round, Club, ClubSet, PracticeMenuItem, PracticeLogEntry, GreenPoint, AppData } from '../types';

interface AppDBSchema extends DBSchema {
  courses:          { key: string; value: Course };
  rounds:           { key: string; value: Round };
  clubs:            { key: string; value: Club };
  clubSets:         { key: string; value: ClubSet };
  practiceMenuItems: { key: string; value: PracticeMenuItem };
  practiceLogs:      { key: string; value: PracticeLogEntry };
  greenPoints:       { key: string; value: GreenPoint };
}

const DB_NAME = '80-break-log';
const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase<AppDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<AppDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AppDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('courses'))  db.createObjectStore('courses',  { keyPath: 'id' });
        if (!db.objectStoreNames.contains('rounds'))   db.createObjectStore('rounds',   { keyPath: 'id' });
        if (!db.objectStoreNames.contains('clubs'))    db.createObjectStore('clubs',    { keyPath: 'id' });
        if (!db.objectStoreNames.contains('clubSets')) db.createObjectStore('clubSets', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('practiceMenuItems')) db.createObjectStore('practiceMenuItems', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('practiceLogs'))      db.createObjectStore('practiceLogs',      { keyPath: 'id' });
        if (!db.objectStoreNames.contains('greenPoints'))       db.createObjectStore('greenPoints',       { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

const ALL_STORES: ('courses' | 'rounds' | 'clubs' | 'clubSets' | 'practiceMenuItems' | 'practiceLogs' | 'greenPoints')[] =
  ['courses', 'rounds', 'clubs', 'clubSets', 'practiceMenuItems', 'practiceLogs', 'greenPoints'];

export const storage = {
  async getCourses(): Promise<Course[]>            { return (await getDB()).getAll('courses'); },
  async getCourse(id: string): Promise<Course | undefined> { return (await getDB()).get('courses', id); },
  async saveCourse(course: Course): Promise<void>  { await (await getDB()).put('courses', course); },
  async deleteCourse(id: string): Promise<void>    { await (await getDB()).delete('courses', id); },

  async getRounds(): Promise<Round[]>              { return (await getDB()).getAll('rounds'); },
  async getRound(id: string): Promise<Round | undefined> { return (await getDB()).get('rounds', id); },
  async saveRound(round: Round): Promise<void>     { await (await getDB()).put('rounds', round); },
  async deleteRound(id: string): Promise<void>     { await (await getDB()).delete('rounds', id); },

  async getClubs(): Promise<Club[]>                { return (await getDB()).getAll('clubs'); },
  async saveClub(club: Club): Promise<void>        { await (await getDB()).put('clubs', club); },
  async deleteClub(id: string): Promise<void>      { await (await getDB()).delete('clubs', id); },

  async getClubSets(): Promise<ClubSet[]>          { return (await getDB()).getAll('clubSets'); },
  async saveClubSet(set: ClubSet): Promise<void>   { await (await getDB()).put('clubSets', set); },
  async deleteClubSet(id: string): Promise<void>   { await (await getDB()).delete('clubSets', id); },

  async getPracticeMenuItems(): Promise<PracticeMenuItem[]>        { return (await getDB()).getAll('practiceMenuItems'); },
  async savePracticeMenuItem(item: PracticeMenuItem): Promise<void> { await (await getDB()).put('practiceMenuItems', item); },
  async deletePracticeMenuItem(id: string): Promise<void>          { await (await getDB()).delete('practiceMenuItems', id); },

  async getPracticeLogs(): Promise<PracticeLogEntry[]>        { return (await getDB()).getAll('practiceLogs'); },
  async savePracticeLog(entry: PracticeLogEntry): Promise<void> { await (await getDB()).put('practiceLogs', entry); },
  async deletePracticeLog(id: string): Promise<void>          { await (await getDB()).delete('practiceLogs', id); },

  async getGreenPoints(): Promise<GreenPoint[]>               { return (await getDB()).getAll('greenPoints'); },
  async saveGreenPoint(point: GreenPoint): Promise<void>      { await (await getDB()).put('greenPoints', point); },
  async deleteGreenPoint(id: string): Promise<void>           { await (await getDB()).delete('greenPoints', id); },

  async exportData(): Promise<AppData> {
    const [courses, rounds, clubs, clubSets, practiceMenuItems, practiceLogs, greenPoints] = await Promise.all([
      this.getCourses(), this.getRounds(), this.getClubs(), this.getClubSets(),
      this.getPracticeMenuItems(), this.getPracticeLogs(), this.getGreenPoints(),
    ]);
    const activeClubSetId = localStorage.getItem('80bl-active-set') ?? undefined;
    return { courses, rounds, clubs, clubSets, activeClubSetId, practiceMenuItems, practiceLogs, greenPoints, exportedAt: new Date().toISOString(), version: '4.0.0' };
  },

  async importData(data: AppData): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(ALL_STORES, 'readwrite');
    await Promise.all(ALL_STORES.map(s => tx.objectStore(s).clear()));
    await Promise.all([
      ...data.courses.map(c  => tx.objectStore('courses').put(c)),
      ...(data.rounds).map(r  => tx.objectStore('rounds').put(r)),
      ...(data.clubs).map(cl  => tx.objectStore('clubs').put(cl)),
      ...(data.clubSets ?? []).map(s => tx.objectStore('clubSets').put(s)),
      ...(data.practiceMenuItems ?? []).map(m => tx.objectStore('practiceMenuItems').put(m)),
      ...(data.practiceLogs ?? []).map(l => tx.objectStore('practiceLogs').put(l)),
      ...(data.greenPoints ?? []).map(g => tx.objectStore('greenPoints').put(g)),
    ]);
    await tx.done;
    if (data.activeClubSetId) localStorage.setItem('80bl-active-set', data.activeClubSetId);
  },

  async clearAll(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(ALL_STORES, 'readwrite');
    await Promise.all(ALL_STORES.map(s => tx.objectStore(s).clear()));
    await tx.done;
    localStorage.removeItem('80bl-active-set');
  },
};
