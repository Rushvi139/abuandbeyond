"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BOOKKEEPERS, assertRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { UploadError, saveUpload } from "@/lib/files";

const MAX = 15 * 1024 * 1024;
const filesOf = (fd: FormData) => fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 10);

/**
 * Photos on an expense already in the register: the slip turned up later, or
 * a second picture helps. The first ever photo becomes the expense's own file;
 * more go to spend_photos.
 */
export async function addExpensePhotos(fd: FormData): Promise<{ error?: string; added?: number }> {
  const staff = await assertRole(BOOKKEEPERS);
  const id = z.string().uuid().safeParse(fd.get("expenseId"));
  if (!id.success) return { error: "Unknown expense." };
  const files = filesOf(fd);
  if (!files.length) return { error: "Pick a photo first." };
  const sql = db();
  const [e] = await sql<{ file: string | null }[]>`select file_path as file from expenses where id = ${id.data}`;
  if (!e) return { error: "Unknown expense." };
  try {
    let first = !e.file;
    for (const f of files) {
      const p = await saveUpload(f, "expenses", { maxBytes: MAX });
      if (first) {
        await sql`update expenses set file_path = ${p}, updated_by = ${staff.id} where id = ${id.data} and file_path is null`;
        first = false;
      } else {
        await sql`insert into spend_photos (expense_id, file_path, created_by) values (${id.data}, ${p}, ${staff.id})`;
      }
    }
  } catch (err) {
    if (err instanceof UploadError) return { error: err.message };
    throw err;
  }
  revalidatePath("/admin/accounts/expenses");
  return { added: files.length };
}

/** Photos of the handwritten daily book, filed under the day they belong to. */
export async function addDaybookPages(fd: FormData): Promise<{ error?: string; added?: number }> {
  const staff = await assertRole(BOOKKEEPERS);
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(fd.get("day"));
  if (!day.success) return { error: "Pick the date of the book page." };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (day.data > today) return { error: "That date is in the future." };
  const note = String(fd.get("note") ?? "").trim().slice(0, 200) || null;
  const files = filesOf(fd);
  if (!files.length) return { error: "Pick a photo of the page first." };
  try {
    for (const f of files) {
      const p = await saveUpload(f, "daybook", { maxBytes: MAX });
      await db()`insert into daybook_pages (day, file_path, note, created_by) values (${day.data}, ${p}, ${note}, ${staff.id})`;
    }
  } catch (err) {
    if (err instanceof UploadError) return { error: err.message };
    throw err;
  }
  revalidatePath("/admin/accounts/daybook");
  return { added: files.length };
}

/** Owner only: a wrong photo comes off. The file stays on disk with the backups. */
export async function deleteDaybookPage(id: string): Promise<{ error?: string }> {
  await assertRole(["owner"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Unknown photo." };
  await db()`delete from daybook_pages where id = ${id}`;
  revalidatePath("/admin/accounts/daybook");
  return {};
}
