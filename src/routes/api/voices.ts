import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { getUserContext, jsonResponse } from "@/lib/server-user";

export const Route = createFileRoute("/api/voices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await getUserContext(request);
        if (ctx instanceof Response) return ctx;
        const key = ctx.settings?.elevenlabs_key?.trim();
        const voiceId = ctx.settings?.voice_id?.trim();
        if (!key || !voiceId) return jsonResponse({ error: "no_voice" }, 400);

        const upstream = await fetch(
          `https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`,
          { headers: { "xi-api-key": key } },
        );
        if (!upstream.ok) return jsonResponse({ error: "upstream_error" }, 502);
        const data = (await upstream.json()) as { voice_id?: string; name?: string };
        return jsonResponse({ voice_id: data.voice_id ?? voiceId, name: data.name ?? "Ma voix" });
      },
    },
  },
});
