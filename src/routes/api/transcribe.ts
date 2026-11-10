import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { getUserContext } from "@/lib/server-user";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MODEL = "openai/gpt-transcribe";

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await getUserContext(request);
        if (ctx instanceof Response) return ctx;
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return jsonError("missing_key", 500);
        }

        const declared = Number(request.headers.get("content-length") ?? 0);
        if (declared > MAX_FILE_BYTES + 1024 * 1024) {
          return jsonError("file_too_large", 400);
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return jsonError("bad_request", 400);
        }

        const file = form.get("file");
        if (!(file instanceof File) || !file.size || file.size > MAX_FILE_BYTES) {
          return jsonError("invalid_audio", 400);
        }

        const upstreamForm = new FormData();
        upstreamForm.append("model", MODEL);
        upstreamForm.append("file", file, file.name || "recording.wav");
        upstreamForm.append("response_format", "json");
        upstreamForm.append("stream", "true");

        const upstream = await fetch(
          "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: upstreamForm,
          },
        );

        if (!upstream.ok) {
          const errText = await upstream.text();
          console.error("Transcription error", upstream.status, errText);
          return new Response(errText || JSON.stringify({ error: "upstream_error" }), {
            status: upstream.status,
            headers: { "content-type": "application/json" },
          });
        }

        const raw = await upstream.text();
        let text = "";
        let done = "";
        for (const block of raw.split("\n\n")) {
          for (const line of block.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const event = JSON.parse(payload) as {
                type?: string;
                delta?: string;
                text?: string;
              };
              if (event.type === "transcript.text.delta" && event.delta) {
                text += event.delta;
              } else if (event.type === "transcript.text.done" && event.text) {
                done = event.text;
              }
            } catch {
              // ignore non-JSON SSE lines
            }
          }
        }

        const transcript = (done || text).trim();
        if (!transcript) {
          return jsonError("empty_transcript", 502);
        }

        return new Response(JSON.stringify({ text: transcript }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
