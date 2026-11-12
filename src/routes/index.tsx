import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Invincible Voice — Accueil" },
      { name: "description", content: "Invincible Voice vous aide à répondre aux questions et à communiquer avec votre voix." },
      { property: "og:title", content: "Invincible Voice — Accueil" },
      { property: "og:description", content: "Votre espace personnalisé pour répondre, écrire et parler avec votre voix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dire" });
  },
});
