import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { getUserContext } from "@/lib/server-user";
import { activeVoice, synthesize } from "@/lib/server-voice";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await getUserContext(request);
        if (ctx instanceof Response) return ctx;
        const voice = activeVoice(ctx.settings);
        if (!voice) return new Response("no_voice", { status: 400 });

        let body: { text?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("bad_request", { status: 400 });
        }

        const text = (body.text ?? "").trim();
        if (!text) return new Response("missing_params", { status: 400 });

        return synthesize(voice, text);
      },
    },
  },
});
