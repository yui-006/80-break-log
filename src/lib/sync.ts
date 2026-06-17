/**
 * Sync layer: local IndexedDB ↔ Supabase (cloud).
 * All functions are fire-and-forget safe — callers can omit await.
 * Data model: holes/shots stored as JSONB within rounds/courses rows.
 */
import { supabase } from './supabase';
import type { Course, Round, ClubSet, PracticeLogEntry, GreenPoint } from '../types';

async function userId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function ts() { return new Date().toISOString(); }

// ── Push single items ──────────────────────────────────────────────────────

export async function syncCourse(course: Course): Promise<void> {
  const uid = await userId();
  if (!uid) return;
  await supabase.from('courses').upsert({
    id: course.id, user_id: uid,
    name: course.name, location: course.location ?? null,
    prefecture: course.prefecture ?? null, source: course.source ?? null,
    source_id: course.sourceId ?? null, source_url: course.sourceUrl ?? null,
    memo: course.memo ?? null, holes: course.holes,
    created_at: course.createdAt, updated_at: ts(),
  }, { onConflict: 'id' });
}

export async function syncRound(round: Round): Promise<void> {
  const uid = await userId();
  if (!uid) return;
  await supabase.from('rounds').upsert({
    id: round.id, user_id: uid,
    course_id: round.courseId, course_name: round.courseName,
    date: round.date, tee_name: round.teeName ?? null,
    target_score: round.targetScore ?? null, weather: round.weather ?? null,
    memo: round.memo ?? null, status: round.status, holes: round.holes,
    created_at: round.createdAt, updated_at: ts(),
  }, { onConflict: 'id' });
}

export async function syncClubSet(set: ClubSet): Promise<void> {
  const uid = await userId();
  if (!uid) return;
  await supabase.from('club_sets').upsert({
    id: set.id, user_id: uid,
    name: set.name, clubs: set.clubs,
    created_at: set.createdAt, updated_at: ts(),
  }, { onConflict: 'id' });
}

export async function syncPracticeLog(log: PracticeLogEntry): Promise<void> {
  const uid = await userId();
  if (!uid) return;
  await supabase.from('practice_logs').upsert({
    id: log.id, user_id: uid,
    date: log.date, menu_name: log.menuName ?? null,
    ball_count: log.ballCount ?? null,
    created_at: log.createdAt, updated_at: ts(),
  }, { onConflict: 'id' });
}

export async function syncGoalThreshold(goal: number, activeClubSetId: string | null): Promise<void> {
  const uid = await userId();
  if (!uid) return;
  await supabase.from('profiles').upsert({
    id: uid, goal_threshold: goal,
    active_club_set_id: activeClubSetId,
    updated_at: ts(),
  }, { onConflict: 'id' });
}

export async function syncGreenPoint(point: GreenPoint): Promise<void> {
  const uid = await userId();
  if (!uid) return;
  // Upsert by id; course ownership verified via RLS (courses.user_id = auth.uid())
  await supabase.from('green_points').upsert({
    id: point.id,
    course_id: point.courseId,
    hole_number: point.holeNumber,
    lat: point.lat,
    lng: point.lng,
    point_type: point.pointType,
    updated_at: ts(),
  }, { onConflict: 'id' });
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deleteSyncCourse(id: string): Promise<void> {
  await supabase.from('courses').delete().eq('id', id);
}

export async function deleteSyncRound(id: string): Promise<void> {
  await supabase.from('rounds').delete().eq('id', id);
}

export async function deleteSyncClubSet(id: string): Promise<void> {
  await supabase.from('club_sets').delete().eq('id', id);
}

export async function deleteSyncPracticeLog(id: string): Promise<void> {
  await supabase.from('practice_logs').delete().eq('id', id);
}

export async function deleteSyncGreenPoint(id: string): Promise<void> {
  await supabase.from('green_points').delete().eq('id', id);
}

// ── Pull all (on login / startup) ─────────────────────────────────────────

export type PullResult = {
  courses: Course[];
  rounds: Round[];
  clubSets: ClubSet[];
  practiceLogs: PracticeLogEntry[];
  greenPoints: GreenPoint[];
  goalThreshold: number | null;
  activeClubSetId: string | null;
};

export async function pullAll(): Promise<PullResult | null> {
  const uid = await userId();
  if (!uid) return null;

  const [cr, rr, sr, lr, pr] = await Promise.all([
    supabase.from('courses').select('*').eq('user_id', uid),
    supabase.from('rounds').select('*').eq('user_id', uid),
    supabase.from('club_sets').select('*').eq('user_id', uid),
    supabase.from('practice_logs').select('*').eq('user_id', uid),
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
  ]);

  const courseIds = (cr.data ?? []).map((c: { id: string }) => c.id);
  const gr = courseIds.length > 0
    ? await supabase.from('green_points').select('*').in('course_id', courseIds)
    : { data: [] };

  const courses: Course[] = (cr.data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string, name: r.name as string,
    location: (r.location as string | null) ?? undefined,
    prefecture: (r.prefecture as string | null) ?? undefined,
    source: (r.source as Course['source']) ?? undefined,
    sourceId: (r.source_id as string | null) ?? undefined,
    sourceUrl: (r.source_url as string | null) ?? undefined,
    memo: (r.memo as string | null) ?? undefined,
    holes: (r.holes as Course['holes']) ?? [],
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }));

  const rounds: Round[] = (rr.data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    courseId: (r.course_id as string) ?? '',
    courseName: (r.course_name as string) ?? '',
    date: r.date as string,
    teeName: (r.tee_name as string | null) ?? undefined,
    targetScore: (r.target_score as number | null) ?? undefined,
    weather: (r.weather as string | null) ?? undefined,
    memo: (r.memo as string | null) ?? undefined,
    status: r.status as 'recording' | 'completed',
    holes: (r.holes as Round['holes']) ?? [],
    createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  }));

  const clubSets: ClubSet[] = (sr.data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string, name: r.name as string,
    clubs: (r.clubs as ClubSet['clubs']) ?? [],
    createdAt: r.created_at as string,
  }));

  const practiceLogs: PracticeLogEntry[] = (lr.data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string, date: r.date as string,
    menuName: (r.menu_name as string | null) ?? '',
    ballCount: (r.ball_count as number | null) ?? undefined,
    createdAt: r.created_at as string,
  }));

  const greenPoints: GreenPoint[] = (gr.data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    courseId: r.course_id as string,
    holeNumber: r.hole_number as number,
    lat: r.lat as number,
    lng: r.lng as number,
    pointType: 'center' as const,
    updatedAt: r.updated_at as string,
  }));

  return {
    courses, rounds, clubSets, practiceLogs, greenPoints,
    goalThreshold: (pr.data as Record<string, unknown> | null)?.goal_threshold as number | null ?? null,
    activeClubSetId: (pr.data as Record<string, unknown> | null)?.active_club_set_id as string | null ?? null,
  };
}

// ── Bulk push (initial migration) ─────────────────────────────────────────

export async function pushAll(
  courses: Course[],
  rounds: Round[],
  clubSets: ClubSet[],
  practiceLogs: PracticeLogEntry[],
  greenPoints: GreenPoint[],
  goalThreshold: number,
  activeClubSetId: string | null,
): Promise<void> {
  const uid = await userId();
  if (!uid) return;
  const now = ts();

  await Promise.all([
    courses.length > 0
      ? supabase.from('courses').upsert(courses.map(c => ({
          id: c.id, user_id: uid, name: c.name,
          location: c.location ?? null, prefecture: c.prefecture ?? null,
          source: c.source ?? null, source_id: c.sourceId ?? null,
          source_url: c.sourceUrl ?? null, memo: c.memo ?? null,
          holes: c.holes, created_at: c.createdAt, updated_at: now,
        })), { onConflict: 'id' })
      : Promise.resolve(),

    rounds.length > 0
      ? supabase.from('rounds').upsert(rounds.map(r => ({
          id: r.id, user_id: uid, course_id: r.courseId,
          course_name: r.courseName, date: r.date,
          tee_name: r.teeName ?? null, target_score: r.targetScore ?? null,
          weather: r.weather ?? null, memo: r.memo ?? null,
          status: r.status, holes: r.holes,
          created_at: r.createdAt, updated_at: now,
        })), { onConflict: 'id' })
      : Promise.resolve(),

    clubSets.length > 0
      ? supabase.from('club_sets').upsert(clubSets.map(s => ({
          id: s.id, user_id: uid, name: s.name, clubs: s.clubs,
          created_at: s.createdAt, updated_at: now,
        })), { onConflict: 'id' })
      : Promise.resolve(),

    practiceLogs.length > 0
      ? supabase.from('practice_logs').upsert(practiceLogs.map(l => ({
          id: l.id, user_id: uid, date: l.date,
          menu_name: l.menuName ?? null, ball_count: l.ballCount ?? null,
          created_at: l.createdAt, updated_at: now,
        })), { onConflict: 'id' })
      : Promise.resolve(),

    greenPoints.length > 0
      ? supabase.from('green_points').upsert(greenPoints.map(g => ({
          id: g.id, course_id: g.courseId,
          hole_number: g.holeNumber, lat: g.lat, lng: g.lng,
          point_type: g.pointType, updated_at: now,
        })), { onConflict: 'id' })
      : Promise.resolve(),

    supabase.from('profiles').upsert({
      id: uid, goal_threshold: goalThreshold,
      active_club_set_id: activeClubSetId, updated_at: now,
    }, { onConflict: 'id' }),
  ]);
}

// ── Merge helper (last-write-wins by updatedAt) ────────────────────────────

function mergeById<T extends { id: string; updatedAt?: string; createdAt?: string }>(
  local: T[], cloud: T[],
): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(item.id, item);
  for (const item of cloud) {
    const existing = map.get(item.id);
    const cloudTime = item.updatedAt ?? item.createdAt ?? '';
    const localTime = existing ? (existing.updatedAt ?? existing.createdAt ?? '') : '';
    if (!existing || cloudTime > localTime) map.set(item.id, item);
  }
  return Array.from(map.values());
}

export function mergeWithLocal(
  pulled: PullResult,
  local: {
    courses: Course[]; rounds: Round[];
    clubSets: ClubSet[]; practiceLogs: PracticeLogEntry[];
    greenPoints: GreenPoint[];
  },
): {
  courses: Course[]; rounds: Round[];
  clubSets: ClubSet[]; practiceLogs: PracticeLogEntry[];
  greenPoints: GreenPoint[];
} {
  return {
    courses:      mergeById(local.courses,      pulled.courses),
    rounds:       mergeById(local.rounds,       pulled.rounds),
    clubSets:     mergeById(local.clubSets,     pulled.clubSets),
    practiceLogs: mergeById(local.practiceLogs, pulled.practiceLogs),
    greenPoints:  mergeById(local.greenPoints,  pulled.greenPoints),
  };
}
