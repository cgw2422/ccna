import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "./db";
import { getStorage, imageContentType } from "./storage";

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Store an image and register it by filename so card HTML <img src="filename"> resolves. */
export async function saveMedia(opts: { userId: string; deckId?: string | null; importBatchId?: string | null; filename: string; data: Uint8Array }) {
  const filename = opts.filename.replace(/^.*[\\/]/, "").slice(0, 250);
  const contentType = imageContentType(filename);
  if (!contentType || !filename) return null;
  if (opts.data.byteLength > MAX_IMAGE_BYTES) return null;
  const sha1 = createHash("sha1").update(opts.data).digest("hex");
  const ext = filename.split(".").pop()!.toLowerCase();
  const storageKey = `media/${opts.userId}/${sha1}.${ext}`;
  await getStorage().put(storageKey, opts.data, contentType);
  const data = { storageKey, contentType, size: opts.data.byteLength, sha1 };
  return prisma.mediaAsset.upsert({
    where: { userId_filename: { userId: opts.userId, filename } },
    update: { ...data, ...(opts.importBatchId ? { importBatchId: opts.importBatchId } : {}) },
    create: { ...data, userId: opts.userId, filename, deckId: opts.deckId ?? null, importBatchId: opts.importBatchId ?? null },
  });
}
