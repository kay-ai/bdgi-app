import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Where speech recordings live until they are scored (spec/12: deleted straight after).
 * STORAGE_PROVIDER=local keeps them in .data/uploads (development); s3 uses S3_BUCKET, which
 * Amazon Transcribe needs. The bucket should have a 1-day lifecycle rule as a backstop.
 */
export interface Storage {
  name: string;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
  /** s3://bucket/key, for Amazon Transcribe. Null for local storage. */
  uri(key: string): string | null;
}

const safeKey = (key: string) => {
  if (!/^[\w\-./]+$/.test(key) || key.includes("..")) throw new Error("bad storage key");
  return key;
};

function local(): Storage {
  const root = path.resolve(process.env.UPLOAD_DIR ?? ".data/uploads");
  const at = (key: string) => path.join(root, safeKey(key));
  return {
    name: "local",
    async put(key, body) {
      await mkdir(path.dirname(at(key)), { recursive: true });
      await writeFile(at(key), body);
    },
    get: async (key) => new Uint8Array(await readFile(at(key))),
    delete: (key) => rm(at(key), { force: true }),
    uri: () => null,
  };
}

let s3Client: S3Client | null = null;
function s3(): Storage {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is required when STORAGE_PROVIDER=s3");
  s3Client ??= new S3Client({ region: process.env.AWS_REGION });
  const c = s3Client;
  return {
    name: "s3",
    async put(key, body, contentType) {
      await c.send(new PutObjectCommand({ Bucket: bucket, Key: safeKey(key), Body: body, ContentType: contentType, ServerSideEncryption: "AES256" }));
    },
    async get(key) {
      const r = await c.send(new GetObjectCommand({ Bucket: bucket, Key: safeKey(key) }));
      return r.Body!.transformToByteArray();
    },
    async delete(key) {
      await c.send(new DeleteObjectCommand({ Bucket: bucket, Key: safeKey(key) }));
    },
    uri: (key) => `s3://${bucket}/${safeKey(key)}`,
  };
}

export function storage(): Storage {
  const p = process.env.STORAGE_PROVIDER ?? "local";
  if (p === "s3") return s3();
  if (p !== "local") throw new Error(`storage provider "${p}" is not known`);
  if (process.env.NODE_ENV === "production" && process.env.VERCEL) throw new Error("STORAGE_PROVIDER=local cannot be used on Vercel");
  return local();
}
