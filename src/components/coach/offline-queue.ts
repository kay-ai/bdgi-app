"use client";

/**
 * Speeches recorded with no connection wait in IndexedDB and are sent when the phone is back
 * online (spec/12 §2 step 4: "offline queue, max 3"). Only the recording and the fields the
 * upload needs are kept; nothing else about the student is stored on the phone.
 */

export type QueuedSpeech = {
  id: string;
  blob: Blob;
  kind: "placement" | "lesson" | "free";
  lessonKey?: string;
  motionId?: string | null;
  side?: "for" | "against" | "open";
  seconds: number;
  title: string;
  savedAt: number;
};

export const MAX_QUEUED = 3;
const DB = "bgdi-coach";
const STORE = "queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexeddb"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const r = run(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}

export async function listQueued(): Promise<QueuedSpeech[]> {
  try {
    const all = await tx<QueuedSpeech[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedSpeech[]>);
    return all.sort((a, b) => a.savedAt - b.savedAt);
  } catch {
    return [];
  }
}

/** False when the queue is full or the browser can't store it. */
export async function queueSpeech(item: Omit<QueuedSpeech, "id" | "savedAt">): Promise<boolean> {
  try {
    if ((await listQueued()).length >= MAX_QUEUED) return false;
    await tx("readwrite", (s) => s.put({ ...item, id: crypto.randomUUID(), savedAt: Date.now() }));
    window.dispatchEvent(new Event("bgdi-coach-queue"));
    return true;
  } catch {
    return false;
  }
}

export async function removeQueued(id: string) {
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* already gone */
  }
  window.dispatchEvent(new Event("bgdi-coach-queue"));
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string; retry: boolean };

/** The one upload used by the recorder and the queue. */
export async function uploadSpeech(i: Pick<QueuedSpeech, "blob" | "kind" | "lessonKey" | "motionId" | "side" | "seconds">): Promise<SendResult> {
  const fd = new FormData();
  const ext = i.blob.type.includes("mp4") ? "m4a" : i.blob.type.includes("ogg") ? "ogg" : "webm";
  fd.append("audio", i.blob, `speech.${ext}`);
  fd.append("kind", i.kind);
  if (i.lessonKey) fd.append("lessonKey", i.lessonKey);
  if (i.motionId) fd.append("motionId", i.motionId);
  if (i.side) fd.append("side", i.side);
  fd.append("duration", String(Math.round(i.seconds)));
  try {
    const res = await fetch("/api/speech", { method: "POST", body: fd });
    const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    if (res.ok && j.id) return { ok: true, id: j.id };
    // Busy and rate limits clear by themselves; the rest won't succeed on a retry.
    return { ok: false, error: j.error ?? "default", retry: res.status >= 500 || j.error === "busy" || j.error === "rate_limited" };
  } catch {
    return { ok: false, error: "offline", retry: true };
  }
}
