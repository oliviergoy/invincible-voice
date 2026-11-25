import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { getUserContext, jsonResponse } from "@/lib/server-user";
import { GRADIUM_VOICE_LANGUAGES, createGradiumVoice, listGradiumVoices } from "@/lib/server-voice";

const MAX_SAMPLE_BYTES = 50 * 1024 * 1024;

export const Route = createFileRoute("/api/gradium-voices")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await getUserContext(request);
        if (ctx instanceof Response) return ctx;
        const key = ctx.settings?.gradium_key?.trim();
        if (!key) return jsonResponse({ error: "no_key" }, 400);

        const result = await listGradiumVoices(key);
        if ("error" in result) return jsonResponse({ error: result.error }, result.status);
        return jsonResponse({ voices: result.voices });
      },
      POST: async ({ request }) => {
        const ctx = await getUserContext(request);
        if (ctx instanceof Response) return ctx;
        const key = ctx.settings?.gradium_key?.trim();
        if (!key) return jsonResponse({ error: "no_key" }, 400);

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return jsonResponse({ error: "bad_request" }, 400);
        }
        const audio = form.get("audio_file");
        const name = String(form.get("name") ?? "").trim();
        const language = String(form.get("language") ?? "");
        if (!(audio instanceof File) || audio.size === 0 || !name || name.length > 100) {
          return jsonResponse({ error: "missing_params" }, 400);
        }
        if (!GRADIUM_VOICE_LANGUAGES.includes(language)) {
          return jsonResponse({ error: "bad_language" }, 400);
        }
        if (audio.size > MAX_SAMPLE_BYTES) {
          return jsonResponse({ error: "file_too_large" }, 400);
        }

        const result = await createGradiumVoice(key, audio, name, language);
        if ("error" in result) return jsonResponse({ error: result.error }, result.status);
        return jsonResponse({ voice: result.voice });
      },
    },
  },
});
