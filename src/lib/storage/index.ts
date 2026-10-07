import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Object storage abstraction for card images. Bytes never go into Postgres —
 * only MediaAsset metadata does.
 *
 *  STORAGE_DRIVER=local  → files under STORAGE_DIR (attach a Railway Volume)
 *  STORAGE_DRIVER=s3     → any S3-compatible bucket (Railway Buckets, R2, S3…)
 */
export interface StorageDriver {
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

class LocalStorage implements StorageDriver {
  constructor(private root: string) {}
  private resolve(key: string) {
    const p = path.resolve(/*turbopackIgnore: true*/ this.root, key);
    if (!p.startsWith(path.resolve(/*turbopackIgnore: true*/ this.root) + path.sep)) throw new Error("Invalid storage key");
    return p;
  }
  async put(key: string, data: Uint8Array) {
    const p = this.resolve(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
  }
  async get(key: string) {
    try {
      return new Uint8Array(await readFile(this.resolve(key)));
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}

class S3Storage implements StorageDriver {
  private clientPromise;
  constructor(private bucket: string) {
    this.clientPromise = import("@aws-sdk/client-s3").then((m) => ({
      m,
      client: new m.S3Client({
        region: process.env.S3_REGION || "auto",
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        credentials:
          process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
            ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
            : undefined,
      }),
    }));
  }
  async put(key: string, data: Uint8Array, contentType: string) {
    const { m, client } = await this.clientPromise;
    await client.send(new m.PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }));
  }
  async get(key: string) {
    const { m, client } = await this.clientPromise;
    try {
      const out = await client.send(new m.GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return out.Body ? await out.Body.transformToByteArray() : null;
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    const { m, client } = await this.clientPromise;
    await client.send(new m.DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (driver) return driver;
  if (process.env.STORAGE_DRIVER === "s3") {
    if (!process.env.S3_BUCKET) throw new Error("S3_BUCKET is required when STORAGE_DRIVER=s3");
    driver = new S3Storage(process.env.S3_BUCKET);
  } else {
    driver = new LocalStorage(path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR || "./storage"));
  }
  return driver;
}

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
};

export function imageContentType(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? null;
}
