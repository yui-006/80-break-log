import { openDB } from 'idb';
import type { IDBPDatabase, DBSchema } from 'idb';
import type { Course, Round, Club, ClubSet, AppData } from '../types';

interface AppDBSchema extends DBSchema {
  courses:  { key: string; value: Course };
  rounds:   { key: string; value: Round };
  clubs:    { key: string; value: Club };
  clubSets: { key: string; value: ClubSet };
}

const DB_NAME = '80-break-log';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<AppDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<AppDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AppDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('courses'))  db.createObjectStore('courses',  { keyPath: 'id' });
        if (!db.objectStoreNames.contains('rounds'))   db.createObjectStore('rounds',   { keyPath: 'id' });
        if (!db.objectStoreNames.contains('clubs'))    db.createObjectStore('clubs',    { keyPath: 'id' });
        if (!db.objectStoreNames.contains('clubSets')) db.createObjectStore('clubSets', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

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

  async exportData(): Promise<AppData> {
    const [courses, rounds, clubs, clubSets] = await Promise.all([
      this.getCourses(), this.getRounds(), this.getClubs(), this.getClubSets(),
    ]);
    const activeClubSetId = localStorage.getItem('80bl-active-set') ?? undefined;
    return { courses, rounds, clubs, clubSets, activeClubSetId, exportedAt: new Date().toISOString(), version: '2.0.0' };
  },

  async importData(data: AppData): Promise<void> {
    const db = await getDB();
    const stores: ('courses' | 'rounds' | 'clubs' | 'clubSets')[] = ['courses', 'rounds', 'clubs', 'clubSets'];
    const tx = db.transaction(stores, 'readwrite');
    await Promise.all(stores.map(s => tx.objectStore(s).clear()));
    await Promise.all([
      ...data.courses.map(c  => tx.objectStore('courses').put(c)),
      ...(data.rounds).map(r  => tx.objectStore('rounds').put(r)),
      ...(data.clubs).map(cl  => tx.objectStore('clubs').put(cl)),
      ...(data.clubSets ?? []).map(s => tx.objectStore('clubSets').put(s)),
    ]);
    await tx.done;
    if (data.activeClubSetId) localStorage.setItem('80bl-active-set', data.activeClubSetId);
  },

  async clearAll(): Promise<void> {
    const db = await getDB();
    const stores: ('courses' | 'rounds' | 'clubs' | 'clubSets')[] = ['courses', 'rounds', 'clubs', 'clubSets'];
    const tx = db.transaction(stores, 'readwrite');
    await Promise.all(stores.map(s => tx.objectStore(s).clear()));
    await tx.done;
    localStorage.removeItem('80bl-active-set');
  },
};
