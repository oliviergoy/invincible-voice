import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { getUserContext, jsonResponse } from "@/lib/server-user";
import { activeVoice, voiceName } from "@/lib/server-voice";

export const Route = createFileRoute("/api/voices")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await getUserContext(request);
        if (ctx instanceof Response) return ctx;
        const voice = activeVoice(ctx.settings);
        if (!voice) return jsonResponse({ error: "no_voice" }, 400);

        const name = await voiceName(voice);
        if (!name) return jsonResponse({ error: "upstream_error" }, 502);
        return jsonResponse({ voice_id: voice.voiceId, name });
      },
    },
  },
});
