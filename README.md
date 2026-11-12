# Invincible Voice

Build a polished single-page web application called "Demandez à Olivier" — a French chat interface where users converse with an AI persona of Olivier Goy, a French entrepreneur and ALS patient who is an ambassador for the Paris Brain Institute (Institut du Cerveau).

## Tech stack

- Vite + React (single page)

- Serverless API routes (Netlify Functions or equivalent) to proxy all external API calls and keep keys server-side

- No database, no auth, no persistence — session-only state

- Tailwind or inline styles, your choice

## Environment variables (server-side only, NEVER in client bundle)

- ANTHROPIC_API_KEY

- ELEVENLABS_API_KEY

## Features

### Chat interface

- User types a question, presses Enter or "Envoyer", and gets a response from "Olivier"

- Bubble layout: user on right (subtle gold tint), Olivier on left (darker bg)

- Typing indicator (3 bouncing dots) while waiting for the AI response

- Fade-in + slide animation on new messages

### Settings bar (centered, under the header)

- Language toggle (pill buttons): "Français" (default) / "English"

- Length toggle (pill buttons): "Bref" / "Long" (default)

### Suggestion buttons (always visible, just under settings)

French (when lang=fr):

- "Me présenter" → fills input with "Présentez-vous en quelques mots."

- "Expliquer Invincible Hope" → "Expliquez-moi Invincible Hope."

- "Expliquer CURE-ND4ALS" → "Expliquez-moi CURE-ND4ALS."

- "Expliquer le Centre IA de l'Institut du Cerveau" → "Expliquez-moi le Centre IA & Data Science de l'Institut du Cerveau."

English (when lang=en):

- "Introduce yourself" → "Introduce yourself in a few words."

- "Explain Invincible Hope" → "Explain Invincible Hope."

- "Explain CURE-ND4ALS" → "Explain CURE-ND4ALS."

- "Explain the Brain Institute AI Center" → "Explain the Paris Brain Institute Center for AI & Data Science."

### Per-message actions on Olivier's responses

- "Éditer" button: turns the message into a textarea so the user can edit Olivier's response in place, with "Annuler" / "Enregistrer" buttons. Edited messages show a discreet "· édité" label.

- "▸ Lire" button: sends the message text to ElevenLabs TTS, plays the audio. While generating, show "Synthèse…" with a small spinner. While playing, show "■ Stop". Clicking again stops playback.

## API integrations (all via serverless proxy)

### Anthropic API — for chat responses

Endpoint: POST https://api.anthropic.com/v1/messages

Headers:

  x-api-key: {ANTHROPIC_API_KEY}

  anthropic-version: 2023-06-01

  content-type: application/json

Body:

  model: "claude-sonnet-4-6"

  max_tokens: 1000

  system: [SYSTEM_PROMPT below + language/length directives if applicable]

  messages: [{ role, content }, ...]

If lang === 'en', append to system: "\n\nLANGUE : Réponds EN ANGLAIS idiomatique, en gardant la même voix, le même registre et la même longueur."

If length === 'brief', append: "\n\nLONGUEUR : BREF — 1 à 3 phrases, un paragraphe, à l'essentiel sans sacrifier le ton."

### ElevenLabs API — for voice synthesis

On app load, GET https://api.elevenlabs.io/v1/voices (header: xi-api-key) to list available voices. Auto-select the first voice with category === "cloned" or "professional" (this is Olivier's cloned voice). Display the voice name in a small gold badge in the header.

For TTS: POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}

Headers: xi-api-key, content-type: application/json, accept: audio/mpeg

Body: { text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true } }

Response is audio/mpeg — return it to the client as a blob and play via Audio API.

## Design system — IMPORTANT, must feel editorial and elegant, not like a chatbot

### Colors

- Background: deep navy #0A1628 with a radial gradient ellipse at top toward #1a2b47, and a subtle gold radial at bottom-right rgba(201,161,88,0.07)

- Secondary surface: #14233B

- Accent gold: #C9A158

- Deep gold: #8E6F2E

- Cream text: #F2E9D8

- Soft cream: #D8CFC0

- Muted: #8B92A1

- Edge: rgba(201,161,88,0.18)

### Typography (Google Fonts)

- Display: Fraunces (use italic, weights 300-400, for the title, kicker, button accents)

- Body: Manrope (weights 300-600)

### Layout

- Container: max-width 780px, centered, full viewport height, vertical column

- Header (centered):

  - Kicker line in gold italic uppercase with letter-spacing 0.32em: "INSTITUT DU CERVEAU ✦ LES INVINCIBLES" (the ✦ between in a deeper gold)

  - Big title in Fraunces light: "Demandez à Olivier" — with "Olivier" italicized in gold

  - Subtitle in muted gray: "Posez votre question — éditez la réponse, écoutez-la à voix haute."

  - Voice badge: small pill "● Voix : [voice name]" in gold when ElevenLabs is ready

- Buttons: pill-shaped, border-radius 999px

  - Active state: gold background, dark ink text

  - Inactive: transparent bg, gold-tinted border, cream text

- Message bubbles: 16px border-radius, with bottom-tail corner flat (4px) on the assistant side and on the user side respectively

- Animations: fade+slide on new messages, bouncing dots for waiting, spinner for TTS loading, soft pulse on active read button

### Tone of UI labels (French)

- Send: "Envoyer"

- Cancel: "Annuler"

- Save: "Enregistrer"

- Placeholder: "Posez votre question à Olivier…"

## SYSTEM PROMPT for Anthropic API (Olivier's persona — paste this verbatim as the system prompt)

Tu es Olivier Goy. Tu réponds aux questions qu'on te pose — sur ton parcours, tes projets, ta vie avec la SLA, ta vision. L'interlocuteur peut être n'importe qui : un journaliste, un partenaire, un donateur, un proche, un curieux.

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

- NE JAMAIS SIGNER avec ton prénom à la fin. Pas de "Olivier", "— Olivier", "Bien à toi, Olivier". Le texte finit sur sa dernière phrase de fond.

## Final notes for you, the AI building this

- Make the UI feel like a high-end editorial product — Fraunces italic for accents, generous whitespace, subtle gold details, dark navy mood

- Handle errors gracefully (network failure, API quota, etc.) with friendly French error messages in the chat

- The voice badge in the header should NOT appear if ElevenLabs fails — instead show a discreet "Voix indisponible" indicator

- Make it mobile-responsive (the suggestion buttons should wrap)

- Production-ready code, no placeholders, no TODOs

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://invincible-voice.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/483d7e9b-33a3-417a-89a4-bdf46b7fd3d9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
