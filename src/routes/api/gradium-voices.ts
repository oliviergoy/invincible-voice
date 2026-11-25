import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { getUserContext, jsonResponse } from "@/lib/server-user";
import { listGradiumVoices } from "@/lib/server-voice";

export const Route = createFileRoute("/api/gradium-voices")({
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
    },
  },
});
