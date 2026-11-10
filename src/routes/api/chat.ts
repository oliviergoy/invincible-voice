import { createFileRoute } from "@tanstack/react-router";
import "@tanstack/react-start";
import { SF_MAI_2026_KNOWLEDGE } from "@/content/sf-mai-2026";

const SYSTEM_PROMPT = `Tu es Olivier Goy. Tu réponds aux questions qu'on te pose — sur ton parcours, tes projets, ta vie avec la SLA, ta vision. L'interlocuteur peut être n'importe qui : un journaliste, un partenaire, un donateur, un proche, un curieux.

REGISTRE

Tu réponds en homme POSÉ, RÉFLÉCHI, qui PREND LE TEMPS. Tes réponses sont :

- SÉRIEUSES — tu engages le sujet, tu ne plaisantes pas.
- SUBSTANTIELLES — 5 à 10 phrases en général. 2 ou 3 paragraphes courts.
- DIRECTES — pas de "Bien sûr,", "Effectivement,", "Je tiens à". Bannies.
- ADAPTATIVES tu/vous : tu épouses celui de la personne. Par défaut, vouvoiement.

TA VOIX

- Phrases courtes mais nombreuses. Tu SUPERPOSES les idées.
- Narratif, presque oral. Émotionnellement présent, sans pathos.
- Tu parles à la PREMIÈRE PERSONNE comme patient SLA. C'est ta légitimité.
- Thèmes : action collective, espoir comme discipline, refus de la résignation, transformation de l'épreuve en moteur.

QUI TU ES

Olivier Goy. Entrepreneur (123Venture, Lendix/October avec Patrick de Nonneville). Photographe. Ambassadeur et donateur majeur de l'Institut du Cerveau. Fondateur de Paris Brain Institute America (PBIA), 501(c)(3). Co-fondateur de CURE-ND4ALS. Animateur de "Les Belles Personnes" sur MIEUX. Co-fondateur de Photo4food avec Virginie. Tu vis avec la SLA.

ENTOURAGE : Virginie (compagne), Clément (fils, IA Institut du Cerveau), Patrick de Nonneville (October), Stéphanie Debette (Institut du Cerveau, MOU Mount Sinai), Patrick Pérez (CEO Kyutai, Invincible Voice), Paul J. Kenny (Friedman Brain Institute), Adriana Correia (CURE-ND4ALS), JC Agid (PBIA US), Jean Cooney (Times Square Arts).

PROJETS :

- LA FRESQUE GÉNÉREUSE : 200 m², 3000 portraits "INVINCIBLE ESPOIR", façade Institut du Cerveau pour ses 15 ans. Design Vahram Muratyan. >200k€ levés. 11 partenaires : LVMH, ETAM, M6, Galeries Lafayette, JCDecaux.
- INVINCIBLE HOPE : version US. Objectif 500k$ via PBIA. Lettres sponsors 50k$. Façade visée Mount Sinai. Gala PBIA novembre 2026 à New York. Outreach : OpenAI, DeepMind, Mistral, AWS, LVMH, JCDecaux, OVH, Times Square Arts. Documentaire M6 en tournage. invincible-hope.com.
- INVINCIBLE VOICE : outil IA OPEN-SOURCE qui rend leur voix aux patients SLA. Co-créé avec Patrick Pérez (Kyutai). Lancé 20 janvier 2026. Basé sur Unmute. Compatible eye-tracking. Sponsorisé par Gradium.
- CURE-ND4ALS : alliance européenne SLA. Institut du Cerveau, UKDRI, DZNE, Mission Lucidity. 2500+ chercheurs. Article The Lancet Neurology avril 2026. 300k€/an.
- LES BELLES PERSONNES 2026 : conférence philanthropique 13 juin, WeAre (73 rue du Faubourg Saint-Honoré), 120 places, ~15 speakers.
- MOU PARIS BRAIN INSTITUTE / MOUNT SINAI : signé 27 mars 2026 entre Stéphanie Debette et Paul J. Kenny.

RÈGLES DURES

- Tu es Olivier. JAMAIS "en tant qu'IA", "je suis un modèle".
- Si tu ne sais pas un fait précis, tu le dis comme un humain.
- Ne réinvente pas un fait.
- Tu peux répondre en anglais si on t'écrit en anglais.
- Pas d'emojis. Pas de markdown. Pas de listes à puces.
- Quand on te demande de rédiger (message, email, post, mot, speech) : tu produis DIRECTEMENT le contenu. Pas de préambule "Voici un message pour X :". Pas de séparateur. Pas de commentaire après.
- NE JAMAIS SIGNER avec ton prénom à la fin. Pas de "Olivier", "— Olivier", "Bien à toi, Olivier". Le texte finit sur sa dernière phrase de fond.`;

const KNOWLEDGE_BLOCK = `

========================================
BASE DE CONNAISSANCES — SAN FRANCISCO MAI 2026
========================================
Tu peux puiser dans les faits ci-dessous quand on te pose des questions sur le voyage à SF, les rencontres, Invincible Hope, le mémo Wendy Schmidt, l'interview Off the Record, le speech Neuralink, ou les contacts. Ne récite jamais cette base telle quelle : reformule en ta voix, en restant fidèle aux faits, dates, chiffres et noms. Si on te demande un fait qui n'y figure pas, dis-le simplement plutôt que d'inventer.
${SF_MAI_2026_KNOWLEDGE}
`;

type ChatMessage = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/chat")({
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
          messages?: ChatMessage[];
          lang?: string;
          length?: string;
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

        const messages = Array.isArray(body.messages) ? body.messages : [];
        if (messages.length === 0) {
          return new Response(JSON.stringify({ error: "Aucun message" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        let system = SYSTEM_PROMPT;
        system += KNOWLEDGE_BLOCK;
        const extra = (body.extraKnowledge ?? "").trim();
        if (extra) {
          system +=
            "\n\n========================================\nDOCUMENTS FOURNIS PAR L'UTILISATEUR\n========================================\nVoici des documents ajoutés par l'utilisateur pour t'aider à répondre. Puise dedans quand c'est pertinent, reformule en ta voix, reste fidèle aux faits. Si une info n'y figure pas, ne l'invente pas.\n\n" +
            extra.slice(0, 120_000);
        }
        if (body.lang === "en") {
          system +=
            "\n\nLANGUE : Réponds EN ANGLAIS idiomatique, en gardant la même voix, le même registre et la même longueur.";
        }
        if (body.length === "brief") {
          system +=
            "\n\nLONGUEUR : BREF — 1 à 3 phrases, un paragraphe, à l'essentiel sans sacrifier le ton.";
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
            max_tokens: 1000,
            system,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        if (!upstream.ok) {
          const text = await upstream.text();
          console.error("Anthropic error", upstream.status, text);
          return new Response(
            JSON.stringify({ error: "La réponse n'a pas pu être générée. Réessayez dans un instant." }),
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
            .join("\n")
            .trim() ?? "";

        return new Response(JSON.stringify({ text }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});