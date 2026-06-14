import { openDB } from 'idb';
import type { IDBPDatabase, DBSchema } from 'idb';
import type { Course, Round, Club, AppData } from '../types';

interface AppDBSchema extends DBSchema {
  courses: { key: string; value: Course };
  rounds: { key: string; value: Round };
  clubs: { key: string; value: Club };
}

const DB_NAME = '80-break-log';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AppDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<AppDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AppDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('courses')) {
          db.createObjectStore('courses', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('rounds')) {
          db.createObjectStore('rounds', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('clubs')) {
          db.createObjectStore('clubs', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export const storage = {
  async getCourses(): Promise<Course[]> {
    const db = await getDB();
    return db.getAll('courses');
  },
  async getCourse(id: string): Promise<Course | undefined> {
    const db = await getDB();
    return db.get('courses', id);
  },
  async saveCourse(course: Course): Promise<void> {
    const db = await getDB();
    await db.put('courses', course);
  },
  async deleteCourse(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('courses', id);
  },

  async getRounds(): Promise<Round[]> {
    const db = await getDB();
    return db.getAll('rounds');
  },
  async getRound(id: string): Promise<Round | undefined> {
    const db = await getDB();
    return db.get('rounds', id);
  },
  async saveRound(round: Round): Promise<void> {
    const db = await getDB();
    await db.put('rounds', round);
  },
  async deleteRound(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('rounds', id);
  },

  async getClubs(): Promise<Club[]> {
    const db = await getDB();
    return db.getAll('clubs');
  },
  async saveClub(club: Club): Promise<void> {
    const db = await getDB();
    await db.put('clubs', club);
  },
  async deleteClub(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('clubs', id);
  },

  async exportData(): Promise<AppData> {
    const [courses, rounds, clubs] = await Promise.all([
      this.getCourses(),
      this.getRounds(),
      this.getClubs(),
    ]);
    return {
      courses,
      rounds,
      clubs,
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };
  },

  async importData(data: AppData): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['courses', 'rounds', 'clubs'], 'readwrite');
    await Promise.all([
      tx.objectStore('courses').clear(),
      tx.objectStore('rounds').clear(),
      tx.objectStore('clubs').clear(),
    ]);
    await Promise.all([
      ...data.courses.map(c => tx.objectStore('courses').put(c)),
      ...data.rounds.map(r => tx.objectStore('rounds').put(r)),
      ...data.clubs.map(cl => tx.objectStore('clubs').put(cl)),
    ]);
    await tx.done;
  },

  async clearAll(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['courses', 'rounds', 'clubs'], 'readwrite');
    await Promise.all([
      tx.objectStore('courses').clear(),
      tx.objectStore('rounds').clear(),
      tx.objectStore('clubs').clear(),
    ]);
    await tx.done;
  },
};
