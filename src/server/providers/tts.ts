import "server-only";
import { Engine, OutputFormat, PollyClient, SynthesizeSpeechCommand, type VoiceId } from "@aws-sdk/client-polly";

/**
 * Read-aloud for the scorecard (spec/12 §6). TTS_PROVIDER=polly uses Amazon Polly with POLLY_VOICE
 * (default Amy, British English), neural where the voice supports it. Without a provider the route
 * answers 404 and the page reads the feedback with the phone's own voice instead.
 */
export interface Speaker {
  name: string;
  synthesize(text: string): Promise<Uint8Array>;
}

let client: PollyClient | null = null;

function polly(): Speaker {
  client ??= new PollyClient({ region: process.env.AWS_REGION });
  const c = client;
  const voice = (process.env.POLLY_VOICE || "Amy") as VoiceId;
  const run = async (text: string, engine: Engine) => {
    const r = await c.send(new SynthesizeSpeechCommand({ Text: text, VoiceId: voice, OutputFormat: OutputFormat.MP3, Engine: engine, LanguageCode: "en-GB" }));
    if (!r.AudioStream) throw new Error("polly returned no audio");
    return r.AudioStream.transformToByteArray();
  };
  return {
    name: "polly",
    async synthesize(text) {
      try {
        return await run(text, Engine.NEURAL);
      } catch {
        // Not every voice or region has a neural engine; the standard one always exists.
        return run(text, Engine.STANDARD);
      }
    },
  };
}

export function speaker(): Speaker | null {
  const p = process.env.TTS_PROVIDER ?? "";
  if (p === "polly") return polly();
  if (p === "" || p === "browser" || p === "console") return null;
  throw new Error(`tts provider "${p}" is not known`);
}
