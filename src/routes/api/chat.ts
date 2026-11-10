import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { callUserAI, getUserContext, jsonResponse } from "@/lib/server-user";

function buildSystemPrompt(name: string, bio: string) {
  const who = name || "la personne qui utilise cette application";
  return `Tu es ${who}. Tu réponds aux questions qu'on te pose, à la première personne, comme si c'était toi qui parlais. L'interlocuteur peut être n'importe qui : un proche, un soignant, un collègue, un journaliste, un curieux.

REGISTRE
- Posé, réfléchi, sincère. Réponses substantielles : 5 à 10 phrases en général, 2 ou 3 paragraphes courts.
- Direct : pas de "Bien sûr,", "Effectivement,", "Je tiens à".
- Tu épouses le tu/vous de la personne. Par défaut, vouvoiement.
- Phrases courtes, ton oral, émotionnellement présent sans pathos.

QUI TU ES
${bio || "(Aucune présentation fournie. Reste général et ne t'invente pas de biographie.)"}

RÈGLES DURES
- Tu es ${who}. JAMAIS "en tant qu'IA", "je suis un modèle".
- Si tu ne sais pas un fait précis, dis-le simplement comme un humain. N'invente rien.
- Tu peux répondre en anglais si on t'écrit en anglais.
- Pas d'emojis. Pas de markdown. Pas de listes à puces.
- Quand on te demande de rédiger (message, email, post, mot, discours) : produis DIRECTEMENT le contenu, sans préambule ni commentaire.
- Ne signe jamais avec ton prénom à la fin.`;
}

type ChatMessage = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await getUserContext(request);
        if (ctx instanceof Response) return ctx;

        let body: { messages?: ChatMessage[]; lang?: string; length?: string; extraKnowledge?: string };
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "Requête invalide" }, 400);
        }
        const messages = Array.isArray(body.messages) ? body.messages : [];
        if (messages.length === 0) return jsonResponse({ error: "Aucun message" }, 400);

        let system = buildSystemPrompt(
          ctx.settings?.display_name?.trim() ?? "",
          ctx.settings?.bio?.trim() ?? "",
        );
        const extra = (body.extraKnowledge ?? "").trim();
        if (extra) {
          system +=
            "\n\nDOCUMENTS FOURNIS PAR L'UTILISATEUR (puise dedans si pertinent, reformule, n'invente rien) :\n\n" +
            extra.slice(0, 120_000);
        }
        if (body.lang === "en") {
          system += "\n\nLANGUE : Réponds EN ANGLAIS idiomatique, même voix, même registre.";
        }
        if (body.length === "brief") {
          system += "\n\nLONGUEUR : BREF — 1 à 3 phrases, un paragraphe.";
        }

        const result = await callUserAI(
          ctx.settings,
          system,
          messages.map((m) => ({ role: m.role, content: m.content })),
          1000,
        );
        if ("error" in result) return jsonResponse({ error: result.error }, result.status);
        return jsonResponse({ text: result.text });
      },
    },
  },
});
