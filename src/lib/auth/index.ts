import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export type StaffRole = "owner" | "manager" | "kitchen" | "rider";
export type Staff = { id: string; fullName: string; role: StaffRole; phone: string | null; email: string | null; username?: string | null };

const COOKIE = "ab_staff";
const SESSION_DAYS = 30;

const hashToken = (t: string) => createHash("sha256").update(t + (process.env.SESSION_SECRET ?? "")).digest("hex");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 11);
}

/** Username, phone or email + password → session cookie. Returns the staff member, or null. */
export async function login(identifier: string, password: string, userAgent?: string): Promise<Staff | null> {
  const id = identifier.trim().toLowerCase();
  const phone = id.replace(/\D/g, "");
  const rows = await db()<(Staff & { passwordHash: string })[]>`
    select id, full_name as "fullName", role, phone, email, username, password_hash as "passwordHash"
    from staff_users
    where active and (
      lower(username) = ${id}
      or lower(email) = ${id}
      or (${phone} <> '' and length(${phone}) >= 10 and regexp_replace(phone, '\D', '', 'g') like ${"%" + phone})
    )
    limit 1`;
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) return null;

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db()`insert into sessions (id, staff_id, expires_at, user_agent) values (${hashToken(token)}, ${u.id}, ${expires}, ${userAgent ?? null})`;
  await db()`update staff_users set last_login_at = now() where id = ${u.id}`;
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires, path: "/" });
  return { id: u.id, fullName: u.fullName, role: u.role, phone: u.phone, email: u.email, username: u.username };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db()`delete from sessions where id = ${hashToken(token)}`;
  jar.delete(COOKIE);
}

export async function currentStaff(): Promise<Staff | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db()<Staff[]>`
    select u.id, u.full_name as "fullName", u.role, u.phone, u.email
    from sessions s join staff_users u on u.id = s.staff_id
    where s.id = ${hashToken(token)} and s.expires_at > now() and u.active`;
  return rows[0] ?? null;
}

/** For pages: redirect to /login unless signed in with one of the roles. */
export async function requireRole(roles: StaffRole[], next?: string): Promise<Staff> {
  const staff = await currentStaff();
  if (!staff) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (!roles.includes(staff.role)) redirect("/login?denied=1");
  return staff;
}

/** For route handlers / server actions: throws instead of redirecting. */
export async function assertRole(roles: StaffRole[]): Promise<Staff> {
  const staff = await currentStaff();
  if (!staff || !roles.includes(staff.role)) throw new Error("forbidden");
  return staff;
}

export const ALL_STAFF: StaffRole[] = ["owner", "manager", "kitchen", "rider"];
export const MANAGERS: StaffRole[] = ["owner", "manager"];
