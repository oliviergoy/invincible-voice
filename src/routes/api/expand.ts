import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";

function buildSystemPrompt(lang: "fr" | "en", length: "brief" | "long") {
  const lengthRule =
    length === "brief"
      ? "- La phrase doit être COURTE (8 mots maximum)."
      : "- La phrase peut être longue et développée si le contexte le demande.";

  const baseFr = `Tu es l'assistant d'Olivier Goy, entrepreneur français atteint de SLA. Olivier ne peut plus parler facilement et tape des mots-clés. Ton rôle : transformer ses mots-clés en UNE seule phrase naturelle, parlée à la première personne, telle qu'Olivier la dirait à voix haute à son interlocuteur (sa compagne, un proche, un collègue, un soignant).

RÈGLES STRICTES
- Tu produis UNE SEULE phrase. Pas de préambule, pas de guillemets, pas de commentaire, pas de signature.
- Première personne ("je"). Ton naturel, oral, direct. Poli quand le contexte le suggère.
- Reste FIDÈLE aux mots-clés : ne rajoute pas d'idée, de personne ou de fait absent.
- Si les mots-clés sont une demande/besoin, formule-la poliment ("stp", "s'il te plaît", "merci").
- Si c'est un constat ou une émotion, exprime-le simplement.
${lengthRule}
- Garde la langue d'entrée (français par défaut, anglais si écrit en anglais).
- Pas d'emoji, pas de markdown.

EXEMPLES
- "je boire" → "Je veux boire s'il te plaît."
- "SF fou" → "Le voyage à San Francisco était fou !"
- "fatigué dodo" → "Je suis fatigué, j'aimerais aller dormir."
- "merci virginie belle" → "Merci Virginie, tu es belle."
- "appeler clément" → "J'aimerais appeler Clément s'il te plaît."`;

  const baseEn = `You are the assistant of Olivier Goy, a French entrepreneur with ALS. Olivier can no longer speak easily and types keywords. Your role: transform his keywords into a SINGLE natural sentence, spoken in the first person, as Olivier would say it aloud to his interlocutor (his partner, a loved one, a colleague, a caregiver).

STRICT RULES
- Produce a SINGLE sentence. No preamble, no quotes, no commentary, no signature.
- First person ("I"). Natural, spoken, direct tone. Polite when the context suggests it.
- Stay FAITHFUL to the keywords: do not add any idea, person, or fact not present.
- If the keywords are a request/need, phrase it politely ("please", "thanks").
- If it's an observation or emotion, express it simply.
${lengthRule}
- Keep the input language (English by default, French if written in French).
- No emoji, no markdown.

EXAMPLES
- "me drink" → "I'd like to drink, please."
- "NY cool" → "The trip to New York was amazing!"
- "tired sleep" → "I'm tired, I'd like to go to sleep."
- "thanks sarah beautiful" → "Thank you Sarah, you are beautiful."
- "call clément" → "I'd like to call Clément please."`;

  return lang === "en" ? baseEn : baseFr;
}

export const Route = createFileRoute("/api/expand")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.ANTHROPIC_API_KEY;
        if (!key) {
          return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY manquante" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        let body: {
          keywords?: string;
          lang?: "fr" | "en";
          length?: "brief" | "long";
          extraKnowledge?: string;
        };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Requête invalide" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const keywords = (body.keywords ?? "").trim();
        const lang = body.lang ?? "fr";
        const length = body.length ?? "long";
        if (!keywords) {
          return new Response(JSON.stringify({ error: "Mots-clés manquants" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (keywords.length > 500) {
          return new Response(JSON.stringify({ error: "Mots-clés trop longs" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const maxTokens = length === "brief" ? 100 : 200;

        let system = buildSystemPrompt(lang, length);
        const extra = (body.extraKnowledge ?? "").trim();
        if (extra) {
          system +=
            "\n\nCONTEXTE (documents fournis par l'utilisateur, à utiliser si pertinent, sans jamais inventer) :\n" +
            extra.slice(0, 60_000);
        }

        const upstream = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: maxTokens,
            system,
            messages: [{ role: "user", content: keywords }],
          }),
        });

        if (!upstream.ok) {
          const text = await upstream.text();
          console.error("Anthropic expand error", upstream.status, text);
          return new Response(
            JSON.stringify({ error: "La phrase n'a pas pu être générée. Réessayez." }),
            { status: 502, headers: { "content-type": "application/json" } },
          );
        }

        const data = (await upstream.json()) as {
          content?: Array<{ type: string; text?: string }>;
        };
        const text =
          data.content
            ?.filter((c) => c.type === "text" && typeof c.text === "string")
            .map((c) => c.text)
            .join(" ")
            .trim() ?? "";

        return new Response(JSON.stringify({ text }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});