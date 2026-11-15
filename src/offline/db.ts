"use client";

import Dexie, { type Table } from "dexie";

/** IndexedDB stores (spec/01 §8). Intake drafts stay on the phone until submit succeeds. */
export type IntakeDraft = { id: string; data: unknown; step: number; updatedAt: number };
export type IntakeQueued = { id: string; payload: unknown; locale: string; queuedAt: number };

class OfflineDb extends Dexie {
  intakeDrafts!: Table<IntakeDraft, string>;
  intakeQueue!: Table<IntakeQueued, string>;
  constructor() {
    super("bgdi");
    this.version(1).stores({ intakeDrafts: "id", intakeQueue: "id" });
  }
}

let instance: OfflineDb | null = null;
export function offlineDb(): OfflineDb | null {
  if (typeof indexedDB === "undefined") return null;
  instance ??= new OfflineDb();
  return instance;
}
