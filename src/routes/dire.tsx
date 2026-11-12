import { createFileRoute } from "@tanstack/react-router";
import { AppHeader, ModeTabs, PillGroup } from "@/components/Brand";
import { useCallback, useEffect, useRef, useState } from "react";
import { getExtraKnowledge } from "@/lib/knowledge-store";
import { authFetch, ERROR_HINTS } from "@/lib/auth-fetch";
import FullscreenReader from "@/components/FullscreenReader";

export const Route = createFileRoute("/dire")({
  component: DirePage,
  head: () => ({
    meta: [
      { title: "Invincible Voice — Je veux te dire" },
      { name: "description", content: "Préparez une phrase, modifiez-la, affichez-la en plein écran ou lisez-la avec votre voix." },
      { property: "og:title", content: "Invincible Voice — Je veux te dire" },
      { property: "og:description", content: "Exprimez un besoin avec une phrase personnalisée, votre voix et un affichage plein écran." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type TtsState = "idle" | "loading" | "playing";
type Lang = "fr" | "en";
type Mode = "asis" | "improve";

const LABELS: Record<Lang, {
  placeholder: string;
  generate: string;
  generating: string;
  edit: string;
  cancel: string;
  save: string;
  read: string;
  stop: string;
  fullscreen: string;
  fullscreenPlain: string;
  close: string;
  synth: string;
  edited: string;
  emptyHint: string;
  error: string;
  errorTTS: string;
  voiceUnavailable: string;
}> = {
  fr: {
    placeholder: "Quelques mots : je boire, je dormir…",
    generate: "Générer",
    generating: "…",
    edit: "Éditer",
    cancel: "Annuler",
    save: "Enregistrer",
    read: "▸ Lire",
    stop: "■ Stop",
    fullscreen: "⛶↻",
    fullscreenPlain: "⛶",
    close: "Fermer",
    synth: "Synthèse…",
    edited: "· édité",
    emptyHint: "Vos phrases apparaîtront ici.",
    error: "La phrase n'a pas pu être générée. Réessayez.",
    errorTTS: "La voix n'a pas pu être générée.",
    voiceUnavailable: "Voix non configurée, voir Paramètres",
  },
  en: {
    placeholder: "e.g. me drink, me sleep…",
    generate: "Generate",
    generating: "…",
    edit: "Edit",
    cancel: "Cancel",
    save: "Save",
    read: "▸ Read",
    stop: "■ Stop",
    fullscreen: "⛶↻",
    fullscreenPlain: "⛶",
    close: "Close",
    synth: "Synthesizing…",
    edited: "· edited",
    emptyHint: "Your sentences will appear here.",
    error: "The sentence could not be generated. Please try again.",
    errorTTS: "The voice could not be generated.",
    voiceUnavailable: "Voice not set up, see Settings",
  },
};

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type Item = {
  id: string;
  keywords: string;
  sentence: string;
  edited?: boolean;
};

function DirePage() {
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [lang, setLang] = useState<Lang>("fr");
  const [mode, setMode] = useState<Mode>("asis");
  const [editing, setEditing] = useState<Record<string, string | undefined>>({});
  const [ttsState, setTtsState] = useState<Record<string, TtsState>>({});
  const [voice, setVoice] = useState<{ id: string; name: string } | null>(null);
  const [voiceFailed, setVoiceFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState<{ text: string; rotated: boolean } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch("/api/voices")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { voice_id: string; name: string }) => {
        if (!cancelled) setVoice({ id: data.voice_id, name: data.name });
      })
      .catch(() => {
        if (!cancelled) setVoiceFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [items, loading]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (playingIdRef.current) {
      const id = playingIdRef.current;
      setTtsState((s) => ({ ...s, [id]: "idle" }));
      playingIdRef.current = null;
    }
  }, []);

  const t = LABELS[lang];

  const expandWith = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || loading) return;
    if (mode === "asis") {
      setError(null);
      setItems((cur) => [...cur, { id: genId(), keywords: trimmed, sentence: trimmed }]);
      setKeywords("");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/expand", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keywords: trimmed,
          lang,
          length: "long",
          extraKnowledge: await getExtraKnowledge(),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        if (err.error && ERROR_HINTS[err.error]) {
          setError(ERROR_HINTS[err.error]);
          return;
        }
        throw new Error("expand");
      }
      const data = (await res.json()) as { text?: string };
      const sentence = (data.text ?? "").trim();
      if (!sentence) throw new Error("empty");
      setItems((cur) => [...cur, { id: genId(), keywords: trimmed, sentence }]);
      setKeywords("");
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [loading, lang, mode, t]);
  const expand = useCallback(() => expandWith(keywords), [expandWith, keywords]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void expand();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void expand();
    }
  };

  const startEdit = (item: Item) =>
    setEditing((e) => ({ ...e, [item.id]: item.sentence }));
  const cancelEdit = (id: string) =>
    setEditing((e) => {
      const n = { ...e };
      delete n[id];
      return n;
    });
  const saveEdit = (id: string) => {
    const val = editing[id];
    if (val === undefined) return;
    setItems((cur) =>
      cur.map((it) => (it.id === id ? { ...it, sentence: val.trim(), edited: true } : it)),
    );
    cancelEdit(id);
  };

  const playTTS = useCallback(
    async (item: Item) => {
      if (!voice) return;
      if (playingIdRef.current === item.id) {
        stopAudio();
        return;
      }
      stopAudio();
      setTtsState((s) => ({ ...s, [item.id]: "loading" }));
      try {
        const res = await authFetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: item.sentence, voice_id: voice.id }),
        });
        if (!res.ok) throw new Error("tts");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        playingIdRef.current = item.id;
        setTtsState((s) => ({ ...s, [item.id]: "playing" }));
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (playingIdRef.current === item.id) {
            playingIdRef.current = null;
            audioRef.current = null;
            setTtsState((s) => ({ ...s, [item.id]: "idle" }));
          }
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          playingIdRef.current = null;
          audioRef.current = null;
          setTtsState((s) => ({ ...s, [item.id]: "idle" }));
        };
        await audio.play();
      } catch {
        setTtsState((s) => ({ ...s, [item.id]: "idle" }));
        setError(t.errorTTS);
      }
    },
    [voice, stopAudio, t],
  );

  const last = items[items.length - 1];
  const lastEditing = last ? editing[last.id] !== undefined : false;
  const lastState = last ? ttsState[last.id] ?? "idle" : "idle";
  const history = items.slice(0, -1).reverse();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        voiceName={voice?.name}
        voiceFailed={voiceFailed}
        voiceLabel={lang === "fr" ? "Voix" : "Voice"}
        unavailableLabel={t.voiceUnavailable}
      />
      <ModeTabs active="dire" />

      <main className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col px-5 pb-8 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PillGroup
            options={[
              { value: "fr", label: "Français" },
              { value: "en", label: "English" },
            ]}
            value={lang}
            onChange={(v) => setLang(v as Lang)}
          />
          <div className="flex flex-wrap gap-2">
            {(lang === "fr" ? ["je boire", "je dormir"] : ["me drink", "me sleep"]).map((ex) => (
              <button key={ex} type="button" onClick={() => setKeywords(ex)} className="chip">
                {ex}
              </button>
            ))}
          </div>
          <PillGroup
            options={[
              { value: "asis", label: lang === "fr" ? "Tel quel" : "As is" },
              { value: "improve", label: lang === "fr" ? "Améliorer" : "Improve" },
            ]}
            value={mode}
            onChange={(v) => setMode(v as Mode)}
          />
        </div>

        <div ref={scrollRef} className="mt-8 flex-1">
          {!last && !loading && (
            <p className="font-display mt-10 text-center text-[22px]" style={{ color: "var(--muted)" }}>
              {t.emptyHint}
            </p>
          )}

          {last && (
            <div className="anim-msg-in" key={last.id}>
              <div className="mb-3 text-[13px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
                {lang === "fr" ? "Mots-clés" : "Keywords"} : {last.keywords}
              </div>
              <div className="relative">
                <div
                  className="font-display px-7 py-8 text-[36px] leading-[1.15] whitespace-pre-wrap sm:px-10 sm:py-10 sm:text-[64px]"
                  style={{ background: "var(--say)", color: "var(--ink)", borderRadius: 36 }}
                >
                  {lastEditing ? (
                    <textarea
                      aria-label={t.edit}
                      value={editing[last.id] ?? ""}
                      onChange={(e) => setEditing((cur) => ({ ...cur, [last.id]: e.target.value }))}
                      rows={4}
                      className="field font-display text-[28px]"
                      autoFocus
                    />
                  ) : (
                    last.sentence
                  )}
                </div>
                <svg className="absolute -bottom-[26px] left-12" width="44" height="30" viewBox="0 0 44 30" aria-hidden="true">
                  <path d="M0 0 H44 L6 30 Z" fill="var(--say)" />
                </svg>
              </div>

              <div className="mt-10 flex flex-wrap items-center justify-end gap-3">
                {lastEditing ? (
                  <>
                    <button type="button" onClick={() => cancelEdit(last.id)} className="btn btn-secondary">{t.cancel}</button>
                    <button type="button" onClick={() => saveEdit(last.id)} className="btn btn-primary">{t.save}</button>
                  </>
                ) : (
                  <>
                    {last.edited && <span className="text-[14px]" style={{ color: "var(--muted)" }}>{t.edited}</span>}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setFullscreen({ text: last.sentence, rotated: false })}
                      title="Plein écran, dans le sens de lecture"
                    >
                      {lang === "fr" ? "Plein écran" : "Full screen"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setFullscreen({ text: last.sentence, rotated: true })}
                      title="Plein écran retourné, pour la personne en face"
                      aria-label="Plein écran retourné, pour la personne en face"
                    >
                      <span className="inline-block rotate-180">{lang === "fr" ? "Plein écran" : "Full screen"}</span>
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => startEdit(last)}>{t.edit}</button>
                    {voice && (
                      <button
                        type="button"
                        onClick={() => void playTTS(last)}
                        disabled={lastState === "loading"}
                        className={`btn btn-primary min-h-[68px] px-8 text-[22px] ${lastState === "playing" ? "pulse-gold" : ""}`}
                      >
                        {lastState === "loading" ? (
                          <><span className="spinner" /> {t.synth}</>
                        ) : lastState === "playing" ? (
                          t.stop
                        ) : (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4l14 8-14 8z" fill="currentColor" /></svg>
                            {lang === "fr" ? "Lire" : "Read"}
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="anim-msg-in mt-6 inline-block rounded-full border-2 bg-card px-5 py-3">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          )}
          {error && <p className="mt-4 text-[15px]" style={{ color: "var(--muted)" }}>{error}</p>}

          {history.length > 0 && (
            <ul className="mt-10 space-y-2">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void playTTS(item)}
                    className="w-full rounded-2xl border-2 bg-card px-4 py-3 text-left text-[17px]"
                    aria-label={`${lang === "fr" ? "Lire" : "Read"} : ${item.sentence}`}
                  >
                    {(ttsState[item.id] ?? "idle") === "playing" ? "■ " : "▸ "}
                    {item.sentence}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={onSubmit} className="composer mt-8">
          <textarea
            aria-label={t.placeholder}
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={t.placeholder}
            className="flex-1 resize-none bg-transparent px-4 py-2 text-[19px] placeholder:opacity-60"
            style={{ color: "var(--ink)", maxHeight: 200 }}
          />
          <button type="submit" disabled={loading || !keywords.trim()} className="btn btn-say text-[18px]">
            {loading ? t.generating : t.generate}
          </button>
        </form>
      </main>

      {fullscreen && (
        <FullscreenReader
          text={fullscreen.text}
          startRotated={fullscreen.rotated}
          onClose={() => setFullscreen(null)}
          labelClose={t.close}
        />
      )}
    </div>
  );
}
