import "server-only";
import {
  DeleteTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  TranscribeClient,
  type LanguageCode,
  type MediaFormat,
} from "@aws-sdk/client-transcribe";
import type { Word } from "@/server/coach/metrics";
import { storage } from "./storage";

/**
 * Speech-to-text and the scoring model for the speech coach (spec/12 §3).
 * TRANSCRIBE_PROVIDER: aws (Amazon Transcribe, word confidence) | groq (Whisper, no confidence) | console.
 * AI_PROVIDER: groq (open-weight model with a strict JSON schema) | console.
 * The console providers make the whole flow work locally without keys; they never run in production.
 */

export type Transcript = { text: string; words: Word[]; durationSeconds: number };
export type TranscribeInput = { key: string; contentType: string; durationHint: number; attemptId: string };

export interface Transcriber {
  name: string;
  transcribe(input: TranscribeInput): Promise<Transcript>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- Amazon Transcribe ---------- */

let transcribeClient: TranscribeClient | null = null;
function awsTranscriber(): Transcriber {
  transcribeClient ??= new TranscribeClient({ region: process.env.AWS_REGION });
  const c = transcribeClient;
  return {
    name: "aws-transcribe",
    async transcribe({ key, contentType, attemptId }) {
      const uri = storage().uri(key);
      if (!uri) throw new Error("Amazon Transcribe needs STORAGE_PROVIDER=s3");
      const job = `bgdi-speech-${attemptId}`;
      const format: MediaFormat = /mp4|m4a|aac/.test(contentType) ? "mp4" : contentType.includes("ogg") ? "ogg" : contentType.includes("mpeg") ? "mp3" : contentType.includes("wav") ? "wav" : "webm";
      await c.send(
        new StartTranscriptionJobCommand({
          TranscriptionJobName: job,
          Media: { MediaFileUri: uri },
          MediaFormat: format,
          LanguageCode: (process.env.TRANSCRIBE_LANGUAGE ?? "en-GB") as LanguageCode,
        }),
      );
      try {
        // Poll with backoff, up to 90 s (spec/12 §3).
        const started = Date.now();
        let wait = 1500;
        for (;;) {
          const r = await c.send(new GetTranscriptionJobCommand({ TranscriptionJobName: job }));
          const st = r.TranscriptionJob?.TranscriptionJobStatus;
          if (st === "COMPLETED") {
            const res = await fetch(r.TranscriptionJob!.Transcript!.TranscriptFileUri!);
            return parseAwsTranscript(await res.json());
          }
          if (st === "FAILED") throw new Error(`transcription failed: ${r.TranscriptionJob?.FailureReason ?? "unknown"}`);
          if (Date.now() - started > 90_000) throw new Error("transcription timed out");
          await sleep(wait);
          wait = Math.min(wait * 1.5, 6000);
        }
      } finally {
        await c.send(new DeleteTranscriptionJobCommand({ TranscriptionJobName: job })).catch(() => {});
      }
    },
  };
}

type AwsItem = { type: "pronunciation" | "punctuation"; start_time?: string; end_time?: string; alternatives: { content: string; confidence?: string }[] };

/** Amazon Transcribe's JSON → words with timings and confidence. Punctuation joins the word before it. */
export function parseAwsTranscript(json: { results: { transcripts: { transcript: string }[]; items: AwsItem[] } }): Transcript {
  const words: Word[] = [];
  for (const it of json.results.items) {
    const alt = it.alternatives[0];
    if (!alt) continue;
    if (it.type === "punctuation") {
      if (words.length) words[words.length - 1]!.w += alt.content;
      continue;
    }
    words.push({ w: alt.content, start: Number(it.start_time ?? 0), end: Number(it.end_time ?? 0), conf: alt.confidence === undefined ? null : Number(alt.confidence) });
  }
  return { text: json.results.transcripts[0]?.transcript ?? words.map((w) => w.w).join(" "), words, durationSeconds: words.at(-1)?.end ?? 0 };
}

/* ---------- Groq Whisper ---------- */

function groqTranscriber(): Transcriber {
  return {
    name: "groq-whisper",
    async transcribe({ key, contentType, durationHint }) {
      const key_ = process.env.GROQ_API_KEY;
      if (!key_) throw new Error("GROQ_API_KEY is required for TRANSCRIBE_PROVIDER=groq");
      const audio = await storage().get(key);
      const form = new FormData();
      const ext = contentType.includes("mp4") ? "m4a" : contentType.includes("ogg") ? "ogg" : "webm";
      form.append("file", new Blob([audio as BlobPart], { type: contentType }), `speech.${ext}`);
      form.append("model", process.env.GROQ_TRANSCRIBE_MODEL ?? "whisper-large-v3-turbo");
      form.append("response_format", "verbose_json");
      form.append("timestamp_granularities[]", "word");
      form.append("language", "en");
      // A prompt that lists fillers makes Whisper keep them instead of tidying them away.
      form.append("prompt", "Umm, so, uh, I mean, like, you know, the speech.");
      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key_}` },
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`groq transcription ${res.status}`);
      const j = (await res.json()) as { text: string; duration?: number; words?: { word: string; start: number; end: number }[] };
      const words = (j.words ?? []).map((w) => ({ w: w.word.trim(), start: w.start, end: w.end, conf: null }));
      return { text: j.text.trim(), words, durationSeconds: j.duration ?? words.at(-1)?.end ?? durationHint };
    },
  };
}

/* ---------- Console (development and tests) ---------- */

/** A fixed practice speech spread over the real recording length, so every screen can be tried without keys. */
export const CONSOLE_SPEECH =
  "Good morning. I strongly believe that debate should be taught in every school, um, because it teaches us to listen before we answer. " +
  "My first point is confidence. When I speak in front of my class I learn that my voice matters. For example, last term my friend Bisi was too shy to answer questions, and after three debate sessions she led our group presentation. " +
  "My second point is thinking. Debate makes us find reasons and evidence, so we, you know, get better at every subject. " +
  "Some people say debate takes time away from maths and science. But debate helps us explain our answers in those subjects too. " +
  "So, debate builds confidence and clear thinking. Every school should teach it. Thank you.";

function consoleTranscriber(): Transcriber {
  return {
    name: "console",
    async transcribe({ durationHint }) {
      const tokens = CONSOLE_SPEECH.split(/\s+/);
      const dur = Math.max(20, durationHint || 100);
      const step = dur / tokens.length;
      const words = tokens.map((w, i) => ({ w, start: +(i * step).toFixed(2), end: +((i + 0.8) * step).toFixed(2), conf: 0.95 }));
      return { text: CONSOLE_SPEECH, words, durationSeconds: dur };
    },
  };
}

export function transcriber(): Transcriber {
  const p = process.env.TRANSCRIBE_PROVIDER ?? "console";
  if (p === "aws") return awsTranscriber();
  if (p === "groq") return groqTranscriber();
  if (p === "console" && process.env.NODE_ENV !== "production") return consoleTranscriber();
  throw new Error(`transcribe provider "${p}" is not available here`);
}

/* ---------- Scoring model ---------- */

export type ModelReply = { text: string; model: string; tokensIn: number; tokensOut: number };
export interface Scorer {
  name: string;
  complete(input: { system: string; user: string; schemaName: string; schema: object }): Promise<ModelReply>;
}

function groqScorer(): Scorer {
  return {
    name: "groq",
    async complete({ system, user, schemaName, schema }) {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new Error("GROQ_API_KEY is required for AI_PROVIDER=groq");
      const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_completion_tokens: 2500,
          reasoning_effort: "medium",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`groq ${res.status}`);
      const j = (await res.json()) as { model: string; choices: { message: { content: string | null } }[]; usage?: { prompt_tokens: number; completion_tokens: number } };
      return { text: j.choices[0]?.message.content ?? "", model: j.model, tokensIn: j.usage?.prompt_tokens ?? 0, tokensOut: j.usage?.completion_tokens ?? 0 };
    },
  };
}

/** Development only: a plausible, schema-valid answer built from simple word checks. */
function consoleScorer(): Scorer {
  return {
    name: "console",
    async complete({ user }) {
      const i = JSON.parse(user) as { transcript: string; focusSkill: { key: string } | null };
      const t = i.transcript.toLowerCase();
      const has = (...w: string[]) => (w.some((x) => t.includes(x)) ? 4 : 2);
      const sentence = i.transcript.split(/(?<=[.!?])\s+/).find((x) => x.split(" ").length > 6) ?? i.transcript.slice(0, 120);
      const skills = {
        opening: has("i strongly", "i believe", "i agree", "i disagree"),
        signposting: has("first point", "second point", "firstly"),
        reasoning: has("because", "which means"),
        evidence: has("for example", "for instance"),
        rebuttal: t.includes("some people say") ? 4 : null,
        closing: has("so,", "to finish", "in conclusion"),
      };
      const focusKey = i.focusSkill?.key as keyof typeof skills | undefined;
      const out = {
        skills,
        structure: Math.round((skills.opening + skills.signposting + skills.closing) / 3),
        argument: Math.round((skills.reasoning + skills.evidence) / 2),
        focus: focusKey ? { score: skills[focusKey] ?? 3, feedback: "(console coach) This is where real feedback on the focus skill will appear." } : { score: null, feedback: null },
        strengths: ["(console coach) You stated your side clearly.", "(console coach) You gave an example to support a point."],
        next_steps: ["(console coach) Add one more example for your second point.", "(console coach) Finish with a short, memorable final line."],
        better_line: { original: sentence, improved: sentence.replace(/^(um,?\s*)/i, ""), why: "(console coach) The real coach rewrites one of your sentences here." },
        encouragement: "(console coach) Great effort. Keep practising!",
        safeguarding_flag: /hurt myself|kill myself|someone hits me|abuse/.test(t),
        off_topic: false,
      };
      return { text: JSON.stringify(out), model: "console", tokensIn: 0, tokensOut: 0 };
    },
  };
}

export function scorer(): Scorer {
  const p = process.env.AI_PROVIDER ?? "console";
  if (p === "groq") return groqScorer();
  if (p === "console" && process.env.NODE_ENV !== "production") return consoleScorer();
  throw new Error(`AI provider "${p}" is not available here`);
}
