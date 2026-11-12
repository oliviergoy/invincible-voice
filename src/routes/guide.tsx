import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/Brand";
import askScreenshot from "@/assets/guide/demandez-moi.png";
import direScreenshot from "@/assets/guide/dire.png";
import fullscreenScreenshot from "@/assets/guide/plein-ecran-retourne.png";

export const Route = createFileRoute("/guide")({
  component: GuidePage,
  head: () => ({
    meta: [
      { title: "Invincible Voice — Guide d'utilisation" },
      {
        name: "description",
        content:
          "Apprenez à poser une question, préparer une phrase, utiliser votre voix et afficher un texte en plein écran avec Invincible Voice.",
      },
      { property: "og:title", content: "Invincible Voice — Guide d'utilisation" },
      {
        property: "og:description",
        content: "Le guide illustré des principales fonctions d'Invincible Voice.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Marker = { number: number; x: string; y: string };

function PhoneIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" strokeLinecap="round" />
    </svg>
  );
}

function TabletIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="2.5" width="16" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" strokeLinecap="round" />
    </svg>
  );
}

function ComputerIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M7 20.5h10" strokeLinecap="round" />
    </svg>
  );
}

function DeviceBand() {
  const items = [
    { icon: <PhoneIcon />, label: "Téléphone" },
    { icon: <TabletIcon />, label: "Tablette" },
    { icon: <ComputerIcon />, label: "Ordinateur" },
  ];
  return (
    <section
      className="mt-8 rounded-[24px] border-[3px] px-5 py-5 sm:px-7"
      style={{ background: "var(--ink)", borderColor: "var(--ink)" }}
      aria-label="Fonctionne sur téléphone, tablette et ordinateur"
    >
      <p className="font-display text-center text-[22px] leading-snug sm:text-[28px]" style={{ color: "var(--paper)" }}>
        Fonctionne sur téléphone, tablette et ordinateur
      </p>
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        {items.map((item) => (
          <li
            key={item.label}
            className="font-display inline-flex min-h-[46px] items-center gap-2.5 rounded-full px-5 text-[16px] sm:text-[18px]"
            style={{ background: "var(--paper)", color: "var(--ink)" }}
          >
            {item.icon}
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function NumberBadge({ number, small = false }: { number: number; small?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 font-display ${
        small ? "h-8 w-8 text-[15px]" : "h-9 w-9 text-[17px] sm:h-11 sm:w-11 sm:text-[20px]"
      }`}
      style={{ background: "var(--ink)", color: "var(--paper)", borderColor: "var(--paper)" }}
      aria-hidden="true"
    >
      {number}
    </span>
  );
}

function MicIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" />
    </svg>
  );
}

function MicNotice({ text }: { text: string }) {
  return (
    <div
      className="mt-6 flex items-center gap-4 rounded-[24px] border-[3px] px-5 py-4 sm:px-6"
      style={{ background: "var(--ask)", borderColor: "var(--ask)", color: "var(--white)" }}
    >
      <span className="shrink-0"><MicIcon /></span>
      <p className="font-display text-[19px] leading-snug sm:text-[22px]">{text}</p>
    </div>
  );
}

function IllustratedStep({
  number,
  title,
  description,
  image,
  alt,
  markers,
  tips,
  accent,
  notice,
}: {
  number: string;
  title: string;
  description: string;
  image: string;
  alt: string;
  markers: Marker[];
  tips: string[];
  accent: string;
  notice?: string;
}) {
  return (
    <section className="mt-16" aria-labelledby={`guide-step-${number}`}>
      <div className="flex items-start gap-4">
        <span className="font-display pt-1 text-[28px] leading-none" style={{ color: accent }}>
          {number}
        </span>
        <div>
          <h2 id={`guide-step-${number}`} className="font-display text-[30px] leading-tight sm:text-[40px]">
            {title}
          </h2>
          <p className="mt-3 max-w-[780px] text-[18px] leading-relaxed" style={{ color: "var(--muted)" }}>
            {description}
          </p>
        </div>
      </div>

      {notice ? <MicNotice text={notice} /> : null}

      <figure className="mt-7">
        <div className="relative overflow-hidden rounded-[24px] border-[3px]" style={{ background: "var(--white)" }}>
          <img src={image} alt={alt} className="block h-auto w-full" loading="lazy" />
          {markers.map((marker) => (
            <span
              key={marker.number}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: marker.x, top: marker.y }}
            >
              <NumberBadge number={marker.number} />
            </span>
          ))}
        </div>
        <figcaption>
          <ol className="mt-5 grid gap-4 md:grid-cols-3">
            {tips.map((tip, index) => (
              <li key={tip} className="flex items-start gap-3 text-[17px] leading-relaxed">
                <NumberBadge number={index + 1} small />
                <span>{tip}</span>
              </li>
            ))}
          </ol>
        </figcaption>
      </figure>
    </section>
  );
}

function GuidePage() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1080px] px-5 pb-16 pt-10 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[760px]">
            <p className="text-[14px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--say)" }}>
              Guide d'utilisation
            </p>
            <h1 className="font-display mt-3 text-[44px] leading-[1.05] sm:text-[64px]">
              Comment utiliser Invincible Voice
            </h1>
            <p className="mt-5 text-[20px] leading-relaxed" style={{ color: "var(--muted)" }}>
              Deux modes pour communiquer : répondre à une question ou préparer une phrase à dire.
              Suivez les repères numérotés sur les captures d'écran.
            </p>
          </div>
          <a href="/guide-invincible-voice.pdf" download className="btn btn-secondary">
            Télécharger le PDF
          </a>
        </div>

        <DeviceBand />

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/ask" className="btn btn-ask">Essayer Demandez-moi</Link>
          <Link to="/dire" className="btn btn-say">Essayer Je veux te dire</Link>
        </div>

        <IllustratedStep
          number="01"
          title="Demandez-moi : posez votre question"
          description="Écrivez ou dictez une question. Invincible Voice répond à la première personne, en utilisant la présentation et les documents enregistrés dans vos paramètres."
          notice="Touchez le micro : Invincible Voice écoute votre interlocuteur"
          image={askScreenshot}
          alt="Capture du mode Demandez-moi avec une question, une réponse bleue et les boutons d'action."
          accent="var(--ask)"
          markers={[
            { number: 1, x: "91%", y: "20%" },
            { number: 2, x: "50%", y: "89%" },
            { number: 3, x: "92%", y: "55%" },
          ]}
          tips={[
            "Choisissez le français ou l'anglais, puis une réponse brève ou longue.",
            "Écrivez votre question, utilisez un exemple ou dictez-la avec le micro, puis envoyez.",
            "La réponse apparaît en bleu : modifiez-la, écoutez-la ou affichez-la en plein écran.",
          ]}
        />

        <IllustratedStep
          number="02"
          title="Je veux te dire : préparez une phrase"
          description="Ce mode vous aide à faire une demande ou à exprimer un besoin. Vous gardez toujours la possibilité de modifier la phrase avant de la lire."
          image={direScreenshot}
          alt="Capture du mode Je veux te dire avec une phrase orange et les boutons Plein écran, Éditer et Lire."
          accent="var(--say)"
          markers={[
            { number: 1, x: "92%", y: "20%" },
            { number: 2, x: "50%", y: "89%" },
            { number: 3, x: "94%", y: "52%" },
          ]}
          tips={[
            "Tel quel conserve exactement vos mots. Améliorer formule une phrase à partir de mots-clés.",
            "Écrivez vos mots ou votre phrase dans le champ du bas, puis touchez Générer.",
            "Vérifiez la phrase orange, modifiez-la si nécessaire, puis touchez Lire pour utiliser votre voix.",
          ]}
        />

        <IllustratedStep
          number="03"
          title="Affichez le texte pour communiquer"
          description="Plein écran affiche le texte dans votre sens de lecture. Le bouton dont le nom est écrit à l'envers retourne le texte pour la personne assise en face de vous."
          image={fullscreenScreenshot}
          alt="Capture du plein écran retourné avec le texte à l'envers et les commandes de taille en haut."
          accent="var(--ink)"
          markers={[
            { number: 1, x: "76%", y: "5%" },
            { number: 2, x: "50%", y: "52%" },
          ]}
          tips={[
            "Agrandissez ou réduisez le texte avec A+ et A−. La flèche change son orientation ; Fermer quitte l'affichage.",
            "Le texte retourné à 180° se lit facilement depuis l'autre côté de la table.",
          ]}
        />

        <section className="mt-16 rounded-[28px] border-[3px] p-6 sm:p-8" aria-labelledby="guide-settings">
          <p className="font-display text-[28px]" style={{ color: "var(--say)" }}>04</p>
          <h2 id="guide-settings" className="font-display mt-2 text-[30px] sm:text-[40px]">
            Personnalisez votre espace
          </h2>
          <p className="mt-3 max-w-[760px] text-[18px] leading-relaxed" style={{ color: "var(--muted)" }}>
            Votre compte Google retrouve vos réglages personnels. Dans Paramètres, ajoutez votre présentation,
            votre service d'IA, votre voix et vos documents, puis cliquez sur Enregistrer.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ["Votre présentation", "Indiquez qui vous êtes pour obtenir des réponses à la première personne."],
              ["Votre IA et votre voix", "Renseignez vos propres clés et choisissez la voix utilisée par le bouton Lire."],
              ["Vos documents", "Ajoutez des fichiers PDF, Word ou texte pour enrichir les réponses."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl p-5" style={{ background: "var(--white)" }}>
                <h3 className="font-display text-[21px]">{title}</h3>
                <p className="mt-2 text-[16px] leading-relaxed" style={{ color: "var(--muted)" }}>{text}</p>
              </div>
            ))}
          </div>
          <Link to="/parametres" className="btn btn-primary mt-6">Ouvrir les paramètres</Link>
        </section>
      </main>
    </div>
  );
}
