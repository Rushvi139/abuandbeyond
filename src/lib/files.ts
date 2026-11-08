import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".uploads");

const IMAGE = new Set(["image/jpeg", "image/png", "image/webp"]);
const DOC = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/** Saves an uploaded file under UPLOAD_DIR/<folder>/ and returns its relative path (for /files/...). */
export async function saveUpload(file: File, folder: "menu" | "bills" | "expenses" | "wall", opts: { maxBytes?: number; kinds?: Set<string> } = {}) {
  const kinds = opts.kinds ?? (folder === "bills" || folder === "expenses" ? DOC : IMAGE);
  if (!kinds.has(file.type)) throw new Error("File type not allowed");
  if (file.size > (opts.maxBytes ?? 8 * 1024 * 1024)) throw new Error("File too large");
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" }[file.type] ?? "bin";
  const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  await mkdir(path.join(UPLOAD_DIR, folder), { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, folder, name), Buffer.from(await file.arrayBuffer()));
  return `${folder}/${name}`;
}
