import "server-only";
import { randomBytes } from "node:crypto";

/**
 * Video rooms for live group sessions (D-025). VIDEO_PROVIDER picks the service:
 * - `daily`: Daily.co with DAILY_API_KEY. Each session gets a private room that expires, with
 *   recording and Daily's own chat off; everyone joins with a short-lived token naming them.
 * - `jitsi`: a self-hosted Jitsi Meet at JITSI_DOMAIN (e.g. meet.example.org). Rooms are long
 *   random names; lock the server down (JWT or a lobby) before using it with students.
 * - empty: no real video (local development); the session page shows a stand-in.
 * Rooms are never recorded.
 */

export type Room = { url: string };
export type JoinAs = { name: string; isOwner: boolean; expiresAt: Date };

export interface VideoProvider {
  name: "daily" | "jitsi" | "none";
  createRoom(name: string, expiresAt: Date): Promise<Room>;
  /** The URL to put in the page's iframe for one person. */
  joinUrl(room: Room, as: JoinAs): Promise<string | null>;
  deleteRoom(room: Room): Promise<void>;
}

const secs = (d: Date) => Math.floor(d.getTime() / 1000);

function daily(): VideoProvider {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new Error("VIDEO_PROVIDER=daily needs DAILY_API_KEY");
  const api = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(`https://api.daily.co/v1${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    if (!r.ok) throw new Error(`daily ${path} ${r.status}`);
    return r.json() as Promise<Record<string, unknown>>;
  };
  return {
    name: "daily",
    async createRoom(name, expiresAt) {
      const res = await api("/rooms", {
        method: "POST",
        body: JSON.stringify({
          name,
          privacy: "private",
          properties: { exp: secs(expiresAt), eject_at_room_exp: true, max_participants: 60, enable_chat: false, enable_prejoin_ui: true, lang: "en" },
        }),
      });
      if (typeof res.url !== "string") throw new Error("daily: no room url");
      return { url: res.url };
    },
    async joinUrl(room, as) {
      const roomName = new URL(room.url).pathname.replace(/^\//, "");
      const res = await api("/meeting-tokens", {
        method: "POST",
        body: JSON.stringify({ properties: { room_name: roomName, user_name: as.name.slice(0, 40), is_owner: as.isOwner, exp: secs(as.expiresAt) } }),
      });
      if (typeof res.token !== "string") throw new Error("daily: no token");
      return `${room.url}?t=${encodeURIComponent(res.token)}`;
    },
    async deleteRoom(room) {
      const roomName = new URL(room.url).pathname.replace(/^\//, "");
      await api(`/rooms/${encodeURIComponent(roomName)}`, { method: "DELETE" }).catch(() => undefined);
    },
  };
}

function jitsi(): VideoProvider {
  const domain = (process.env.JITSI_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!domain) throw new Error("VIDEO_PROVIDER=jitsi needs JITSI_DOMAIN");
  return {
    name: "jitsi",
    async createRoom(name) {
      return { url: `https://${domain}/${name}` };
    },
    async joinUrl(room, as) {
      const name = encodeURIComponent(JSON.stringify(as.name.slice(0, 40)));
      return `${room.url}#userInfo.displayName=${name}&config.prejoinPageEnabled=true&config.disableDeepLinking=true`;
    },
    async deleteRoom() {},
  };
}

const none: VideoProvider = {
  name: "none",
  async createRoom(name) {
    return { url: `local:${name}` };
  },
  async joinUrl() {
    return null;
  },
  async deleteRoom() {},
};

export function videoProvider(): VideoProvider {
  const p = process.env.VIDEO_PROVIDER;
  if (p === "daily") return daily();
  if (p === "jitsi") return jitsi();
  return none;
}

/** A room name nobody can guess. */
export const newRoomName = () => `bgdi-${randomBytes(9).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
