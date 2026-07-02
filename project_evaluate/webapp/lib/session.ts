import { cookies } from "next/headers";
import { getSql } from "./db";

const COOKIE_NAME = "eval_session";

export interface Session {
  userId: number;
  name: string;
  role: "student" | "instructor";
  groupId: number | null;
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function setSession(session: Session): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12시간
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export interface UserRow {
  id: number;
  name: string;
  role: "student" | "instructor";
  group_id: number | null;
}

export async function findUserByName(name: string): Promise<UserRow | undefined> {
  const sql = getSql();
  const rows = await sql<UserRow[]>`SELECT * FROM users WHERE name = ${name} AND role = 'student'`;
  return rows[0];
}

export async function findInstructor(): Promise<UserRow | undefined> {
  const sql = getSql();
  const rows = await sql<UserRow[]>`SELECT * FROM users WHERE role = 'instructor'`;
  return rows[0];
}

export async function listStudentsByGroup(): Promise<Map<number, UserRow[]>> {
  const sql = getSql();
  const rows = await sql<UserRow[]>`SELECT * FROM users WHERE role = 'student' ORDER BY group_id, id`;
  const map = new Map<number, UserRow[]>();
  for (const r of rows) {
    if (r.group_id == null) continue;
    if (!map.has(r.group_id)) map.set(r.group_id, []);
    map.get(r.group_id)!.push(r);
  }
  return map;
}
