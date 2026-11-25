import type { UserSettings } from "@/lib/server-user";

const GRADIUM_API = "https://eu.api.gradium.ai/api";

type ActiveVoice = { provider: "elevenlabs" | "gradium"; key: string; voiceId: string };

export type LibraryVoice = {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  own: boolean;
};

export function activeVoice(settings: UserSettings | null): ActiveVoice | null {
  if (settings?.voice_provider === "gradium") {
    const key = settings.gradium_key?.trim();
    const voiceId = settings.gradium_voice_id?.trim();
    return key && voiceId ? { provider: "gradium", key, voiceId } : null;
  }
  const key = settings?.elevenlabs_key?.trim();
  const voiceId = settings?.voice_id?.trim();
  return key && voiceId ? { provider: "elevenlabs", key, voiceId } : null;
}

/** Gradium catalog (Kyutai voices) plus the caller's own clones, which Gradium lists first. */
export async function listGradiumVoices(
  key: string,
): Promise<{ voices: LibraryVoice[] } | { error: string; status: number }> {
  const limit = 2000;
  const voices: LibraryVoice[] = [];
  for (let skip = 0; skip < 10 * limit; skip += limit) {
    const r = await fetch(
      `${GRADIUM_API}/voices/?include_catalog=true&limit=${limit}&skip=${skip}`,
      { headers: { "x-api-key": key } },
    );
    if (r.status === 401) return { error: "invalid_key", status: 400 };
    if (!r.ok) {
      console.error("Gradium voices error", r.status, await r.text());
      return { error: "upstream_error", status: 502 };
    }
    const page = (await r.json()) as Array<{
      uid: string;
      name: string;
      description?: string | null;
      language?: string | null;
      is_catalog: boolean;
    }>;
    for (const v of page) {
      voices.push({
        id: v.uid,
        name: v.name,
        description: v.description ?? null,
        language: v.language ?? null,
        own: !v.is_catalog,
      });
    }
    if (page.length < limit) break;
  }
  return { voices };
}

export const GRADIUM_VOICE_LANGUAGES = ["fr", "en", "de", "es", "pt"];

/** Gradium answers 201 even when it cannot read the audio: success is a non-null uid. */
export async function createGradiumVoice(
  key: string,
  audio: File,
  name: string,
  language: string,
): Promise<{ voice: LibraryVoice } | { error: string; status: number }> {
  const form = new FormData();
  form.append("audio_file", audio, audio.name);
  form.append("name", name);
  form.append("language", language);
  const r = await fetch(`${GRADIUM_API}/voices/`, {
    method: "POST",
    headers: { "x-api-key": key },
    body: form,
  });
  if (r.status === 401) return { error: "invalid_key", status: 400 };
  if (r.status === 409) return { error: "voice_limit", status: 400 };
  const body = (await r.json().catch(() => null)) as {
    uid?: string | null;
    error?: string | null;
  } | null;
  if (r.ok && body?.uid) {
    return { voice: { id: body.uid, name, description: null, language, own: true } };
  }
  console.error("Gradium voice creation error", r.status, body);
  if (r.ok && body?.error) return { error: "bad_audio", status: 400 };
  return { error: "upstream_error", status: 502 };
}

export async function voiceName(voice: ActiveVoice): Promise<string | null> {
  if (voice.provider === "gradium") {
    const r = await fetch(`${GRADIUM_API}/voices/${encodeURIComponent(voice.voiceId)}`, {
      headers: { "x-api-key": voice.key },
    });
    if (r.ok) return ((await r.json()) as { name?: string }).name ?? "Ma voix";
    if (r.status === 401) return null;
    const listed = await listGradiumVoices(voice.key);
    if ("error" in listed) return null;
    return listed.voices.find((v) => v.id === voice.voiceId)?.name ?? null;
  }
  const r = await fetch(
    `https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voice.voiceId)}`,
    { headers: { "xi-api-key": voice.key } },
  );
  if (!r.ok) return null;
  return ((await r.json()) as { name?: string }).name ?? "Ma voix";
}

const GRADIUM_FREE_PLAN_CHARS = 1500;

function chunkId(view: DataView, at: number) {
  return String.fromCharCode(
    view.getUint8(at),
    view.getUint8(at + 1),
    view.getUint8(at + 2),
    view.getUint8(at + 3),
  );
}

/** Gradium streams WAV with 0xFFFFFFFF size placeholders: write the real sizes. Null when there is no audio. */
function finalizeWav(body: ArrayBuffer): ArrayBuffer | null {
  const view = new DataView(body);
  if (body.byteLength < 12 || chunkId(view, 0) !== "RIFF") return null;
  for (let at = 12; at + 8 <= body.byteLength;) {
    const size = view.getUint32(at + 4, true);
    if (chunkId(view, at) === "data") {
      const dataSize = body.byteLength - at - 8;
      if (dataSize === 0) return null;
      view.setUint32(4, body.byteLength - 8, true);
      view.setUint32(at + 4, dataSize, true);
      return body;
    }
    at += 8 + size + (size % 2);
  }
  return null;
}

function audio(body: ArrayBuffer, contentType: string) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": contentType, "cache-control": "no-store" },
  });
}

export async function synthesize(voice: ActiveVoice, text: string): Promise<Response> {
  if (voice.provider === "gradium") {
    const upstream = await fetch(`${GRADIUM_API}/speech/tts`, {
      method: "POST",
      headers: { "x-api-key": voice.key, "content-type": "application/json" },
      body: JSON.stringify({
        text,
        voice_id: voice.voiceId,
        output_format: "wav",
        only_audio: true,
      }),
    });
    if (!upstream.ok) {
      console.error("Gradium TTS error", upstream.status, await upstream.text());
      return new Response("upstream_error", { status: 502 });
    }
    const wav = finalizeWav(await upstream.arrayBuffer());
    if (!wav) {
      console.error("Gradium TTS returned no audio", { chars: text.length });
      return text.length > GRADIUM_FREE_PLAN_CHARS
        ? new Response("voice_text_too_long", { status: 400 })
        : new Response("upstream_error", { status: 502 });
    }
    return audio(wav, "audio/wav");
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": voice.key,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    },
  );
  if (!upstream.ok) {
    console.error("ElevenLabs TTS error", upstream.status, await upstream.text());
    return new Response("upstream_error", { status: 502 });
  }
  return audio(await upstream.arrayBuffer(), "audio/mpeg");
}
