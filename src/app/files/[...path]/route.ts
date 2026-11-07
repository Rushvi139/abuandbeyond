import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { currentStaff } from "@/lib/auth";
import { UPLOAD_DIR } from "@/lib/files";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

/** Serves uploaded files. menu/ is public; bills/ and wall/ need a staff session. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (parts.some((p) => p.includes("..") || p.includes("/"))) return new Response("bad path", { status: 400 });
  const [folder] = parts;
  if (folder !== "menu") {
    const staff = await currentStaff();
    if (!staff) return new Response("forbidden", { status: 403 });
  }
  const file = path.join(UPLOAD_DIR, ...parts);
  try {
    const s = await stat(file);
    const ext = path.extname(file).slice(1);
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Content-Length": String(s.size), "Cache-Control": folder === "menu" ? "public, max-age=86400" : "private, no-store" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
