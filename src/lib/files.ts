import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".uploads");

const PLAIN = new Set(["image/jpeg", "image/png", "image/webp"]);
/**
 * Bills and slips are photographed, usually on a phone, and an iPhone shoots
 * HEIC by default — so refusing HEIC refuses the single most common way a
 * receipt arrives. It is converted to JPEG on the way in, because no browser
 * but Safari will display one.
 */
const HEIC = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);
/** Every image surface takes a phone photo; HEIC is converted below. */
const IMAGE = new Set([...PLAIN, ...HEIC]);
const DOC = new Set([...IMAGE, "application/pdf"]);

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** A phone photo of a bill is often 6 MB; this is plenty to read one by. */
const MAX_EDGE = 2200;

export class UploadError extends Error {}

/**
 * Works out the type even when the browser does not say, which happens with
 * HEIC on some Android browsers and with files dragged from odd places.
 */
function kindOf(file: File): string {
  const t = (file.type || "").toLowerCase();
  if (t) return t;
  const ext = path.extname(file.name || "").slice(1).toLowerCase();
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif", pdf: "application/pdf" }[ext] ?? "";
}

/** Saves an uploaded file under UPLOAD_DIR/<folder>/ and returns its relative path (for /files/...). */
export async function saveUpload(
  file: File,
  folder: "menu" | "bills" | "expenses" | "wall",
  opts: { maxBytes?: number; kinds?: Set<string> } = {},
) {
  const docs = folder === "bills" || folder === "expenses";
  const kinds = opts.kinds ?? (docs ? DOC : IMAGE);
  const kind = kindOf(file);

  if (!kinds.has(kind)) {
    throw new UploadError(
      docs
        ? "That file isn't a photo or a PDF. Use a photo of the bill (JPG, PNG or HEIC) or a PDF."
        : "That file isn't an image. Use a photo (JPG, PNG or HEIC).",
    );
  }
  const maxBytes = opts.maxBytes ?? 8 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new UploadError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }

  let buf = Buffer.from(await file.arrayBuffer());
  let ext = EXT[kind] ?? "bin";

  // HEIC becomes JPEG so it opens anywhere; any large photo is scaled down so
  // the uploads volume doesn't fill with 6 MB pictures of receipts. A failure
  // here must never lose the bill, so we keep the original instead.
  if (kind !== "application/pdf") {
    try {
      const sharp = (await import("sharp")).default;
      const img = sharp(buf, { failOn: "none" });
      const { width = 0, height = 0 } = await img.metadata();
      const oversize = Math.max(width, height) > MAX_EDGE;
      if (HEIC.has(kind) || oversize) {
        buf = await img
          .rotate() // honour the EXIF orientation, or phone photos come in sideways
          .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer();
        ext = "jpg";
      }
    } catch (e) {
      if (HEIC.has(kind)) {
        throw new UploadError("That iPhone photo couldn't be read. In Settings → Camera → Formats pick \"Most Compatible\", or send it as a PDF.");
      }
      console.error("upload: image processing failed, keeping the original", e);
    }
  }

  const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  await mkdir(path.join(UPLOAD_DIR, folder), { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, folder, name), buf);
  return `${folder}/${name}`;
}
