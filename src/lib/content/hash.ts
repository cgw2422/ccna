import { createHash } from "node:crypto";
import { normalizeForHash } from "./sanitize";

export function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

export function cardHashes(front: string, back: string) {
  const f = normalizeForHash(front);
  const b = normalizeForHash(back);
  return { frontHash: sha1(f), contentHash: sha1(`${f}␞${b}`) };
}
