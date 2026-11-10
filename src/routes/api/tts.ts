import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.ELEVENLABS_API_KEY;
        if (!key) {
          return new Response("missing_key", { status: 500 });
        }

        let body: { text?: string; voice_id?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("bad_request", { status: 400 });
        }

        const text = (body.text ?? "").trim();
        const voiceId = (body.voice_id ?? "").trim();
        if (!text || !voiceId) {
          return new Response("missing_params", { status: 400 });
        }

        const upstream = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
          {
            method: "POST",
            headers: {
              "xi-api-key": key,
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
          const errText = await upstream.text();
          console.error("ElevenLabs TTS error", upstream.status, errText);
          return new Response("upstream_error", { status: 502 });
        }

        const audio = await upstream.arrayBuffer();
        return new Response(audio, {
          status: 200,
          headers: {
            "content-type": "audio/mpeg",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});