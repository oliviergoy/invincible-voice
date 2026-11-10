import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

export const Route = createFileRoute("/api/voices")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) {
          return new Response(JSON.stringify({ error: "missing_key" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const voiceId = "tZmSLpG2sof86hPenAcP";
        const upstream = await fetch(
          `https://api.elevenlabs.io/v1/voices/${voiceId}`,
          { headers: { "xi-api-key": key } },
        );

        if (!upstream.ok) {
          return new Response(JSON.stringify({ error: "upstream_error" }), {
            status: 502,
            headers: { "content-type": "application/json" },
          });
        }

        const data = (await upstream.json()) as { voice_id?: string; name?: string };
        return new Response(
          JSON.stringify({
            voice_id: data.voice_id ?? voiceId,
            name: data.name ?? "Olivier",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});