import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getExtraKnowledge } from "@/lib/knowledge-store";
import { authFetch, ERROR_HINTS } from "@/lib/auth-fetch";
import FullscreenReader from "@/components/FullscreenReader";

export const Route = createFileRoute("/dire")({
  component: DirePage,
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
    placeholder: "Ex : je boire, fatigué dodo, merci virginie…",
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
    voiceUnavailable: "Voix non configurée — voir ⚙",
  },
  en: {
    placeholder: "e.g. me drink, tired sleep, thanks sarah…",
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
    voiceUnavailable: "Voice not set up — see ⚙",
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

  const expand = useCallback(async () => {
    const trimmed = keywords.trim();
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
  }, [keywords, loading, lang, mode, t]);

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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[780px] flex-col px-5 pb-10 pt-10 sm:pt-14">
      {/* Header */}
      <header className="flex flex-col items-center text-center">
        <h1
          className="font-display mt-5 text-[44px] sm:text-[56px] leading-[1.05]"
          style={{ fontWeight: 300, color: "var(--cream)" }}
        >
          Invincible{" "}
          <span style={{ color: "var(--gold)" }}>
            Voice
          </span>
        </h1>
        <p
          className="mt-4 max-w-[520px] text-sm sm:text-[15px]"
          style={{ color: "var(--muted)" }}
        >
          {lang === "fr"
            ? "Tapez quelques mots-clés — une phrase complète apparaît, à éditer et à lire à voix haute."
            : "Type a few keywords — a full sentence appears, ready to edit and read aloud."}
        </p>
        <div className="mt-4 min-h-[24px]">
          {voice ? (
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]"
              style={{
                borderColor: "var(--edge)",
                color: "var(--gold)",
                background: "rgba(201,161,88,0.06)",
              }}
            >
              <span style={{ color: "var(--gold)" }}>●</span> {lang === "fr" ? "Voix" : "Voice"} : {voice.name}
            </span>
          ) : voiceFailed ? (
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]"
              style={{ borderColor: "var(--edge)", color: "var(--muted)" }}
            >
              {t.voiceUnavailable}
            </span>
          ) : null}
        </div>
      </header>

      {/* Tabs */}
      <TabNav active="dire" />

      {/* Settings */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <PillGroup
          options={[
            { value: "fr", label: "Français" },
            { value: "en", label: "English" },
          ]}
          value={lang}
          onChange={(v) => setLang(v as Lang)}
        />
        <PillGroup
          options={[
            { value: "asis", label: lang === "fr" ? "Tel quel" : "As is" },
            { value: "improve", label: lang === "fr" ? "Améliorer" : "Improve" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as Mode)}
        />
      </div>

      {/* Examples */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {(lang === "fr" ? ["je boire", "fatigué dodo", "merci virginie belle", "SF fou"] : ["me drink", "tired sleep", "thanks sarah", "NY cool"]).map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setKeywords(ex)}
            className="rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors"
            style={{
              borderColor: "var(--edge)",
              color: "var(--cream-soft)",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(201,161,88,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Items */}
      <div ref={scrollRef} className="mt-8 flex-1 space-y-4 overflow-y-auto pb-4">
        {items.length === 0 && (
          <div
            className="font-display mt-8 text-center text-[15px]"
            style={{ color: "var(--muted)" }}
          >
            {t.emptyHint}
          </div>
        )}
        {items.map((item) => {
          const isEditing = editing[item.id] !== undefined;
          const state = ttsState[item.id] ?? "idle";
          return (
            <div key={item.id} className="anim-msg-in">
              <div className="px-1 text-[11px] italic" style={{ color: "var(--muted)" }}>
                {item.keywords}
              </div>
              <div
                className="mt-1 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap"
                style={{
                  background: "var(--surface)",
                  color: "var(--cream)",
                  borderRadius: 16,
                  border: "1px solid var(--edge)",
                }}
              >
                {isEditing ? (
                  <textarea
                    value={editing[item.id] ?? ""}
                    onChange={(e) =>
                      setEditing((cur) => ({ ...cur, [item.id]: e.target.value }))
                    }
                    rows={Math.min(12, Math.max(3, (editing[item.id] ?? "").split("\n").length + 2))}
                    className="w-full resize-y bg-transparent text-[15px] leading-relaxed"
                    style={{ color: "var(--cream)", minHeight: 100 }}
                    autoFocus
                  />
                ) : (
                  item.sentence
                )}
              </div>
              <div className="mt-2.5 flex items-center gap-2 px-1 text-[14px]">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => cancelEdit(item.id)}
                      className="rounded-full border px-4 py-1.5 transition-opacity hover:opacity-80"
                      style={{ color: "var(--muted)", borderColor: "var(--edge)" }}
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(item.id)}
                      className="font-display rounded-full px-4 py-1.5 transition-opacity hover:opacity-80"
                      style={{ background: "var(--gold)", color: "var(--bg)" }}
                    >
                      {t.save}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setFullscreen({ text: item.sentence, rotated: true })}
                      className="rounded-full border px-3 py-1.5 transition-opacity hover:opacity-80"
                      style={{ color: "var(--cream-soft)", borderColor: "var(--edge)" }}
                      title="Plein écran retourné, pour la personne en face"
                    >
                      {t.fullscreen}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFullscreen({ text: item.sentence, rotated: false })}
                      className="rounded-full border px-3 py-1.5 transition-opacity hover:opacity-80"
                      style={{ color: "var(--cream-soft)", borderColor: "var(--edge)" }}
                      title="Plein écran dans votre sens, sans retourner"
                    >
                      {t.fullscreenPlain}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      className="rounded-full border px-4 py-1.5 transition-opacity hover:opacity-80"
                      style={{ color: "var(--cream-soft)", borderColor: "var(--edge)" }}
                    >
                      {t.edit}
                    </button>
                    {voice && (
                      <button
                        type="button"
                        onClick={() => void playTTS(item)}
                        disabled={state === "loading"}
                        className={`font-display rounded-full px-4 py-1.5 transition-opacity hover:opacity-80 ${state === "playing" ? "pulse-gold" : ""}`}
                        style={{ background: "var(--gold)", color: "var(--bg)" }}
                      >
                        {state === "loading" ? (
                          <>
                            <span className="spinner" /> {t.synth}
                          </>
                        ) : state === "playing" ? (
                          t.stop
                        ) : (
                          t.read
                        )}
                      </button>
                    )}
                    {item.edited && (
                      <span style={{ color: "var(--muted)" }} className="italic text-[12px]">
                        {t.edited}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="anim-msg-in flex justify-start">
            <div
              className="rounded-2xl px-4 py-3"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--edge)",
              }}
            >
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}
        {error && (
          <div className="px-1 text-[13px]" style={{ color: "var(--muted)" }}>
            {error}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="mt-4 flex items-end gap-2 rounded-2xl border p-2"
        style={{
          background: "rgba(20, 35, 59, 0.6)",
          borderColor: "var(--edge)",
          backdropFilter: "blur(4px)",
        }}
      >
        <textarea
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={t.placeholder}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed placeholder:opacity-60"
          style={{ color: "var(--cream)", maxHeight: 200 }}
        />
        <button
          type="submit"
          disabled={loading || !keywords.trim()}
          className="font-display rounded-full px-5 py-2 text-[14px] transition-opacity disabled:opacity-40"
          style={{
            background: "var(--gold)",
            color: "var(--bg)",
            fontWeight: 400,
          }}
        >
          {loading ? t.generating : t.generate}
        </button>
      </form>

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

function PillGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full border p-1"
      style={{ borderColor: "var(--edge)", background: "rgba(20,35,59,0.4)" }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="rounded-full px-4 py-1.5 text-[12.5px] transition-colors"
            style={{
              background: active ? "var(--gold)" : "transparent",
              color: active ? "var(--bg)" : "var(--cream-soft)",
              fontWeight: active ? 500 : 400,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabNav({ active }: { active: "ask" | "dire" | "settings" }) {
  return (
    <div className="mt-8 flex justify-center">
      <div
        className="inline-flex rounded-full border p-1"
        style={{ borderColor: "var(--edge)", background: "rgba(20,35,59,0.4)" }}
      >
        <Link
          to="/ask"
          className="rounded-full px-4 py-1.5 text-[12.5px] transition-colors"
          style={{
            background: active === "ask" ? "var(--gold)" : "transparent",
            color: active === "ask" ? "var(--bg)" : "var(--cream-soft)",
            fontWeight: active === "ask" ? 500 : 400,
          }}
        >
          Demandez-moi
        </Link>
        <Link
          to="/dire"
          className="rounded-full px-4 py-1.5 text-[12.5px] transition-colors"
          style={{
            background: active === "dire" ? "var(--gold)" : "transparent",
            color: active === "dire" ? "var(--bg)" : "var(--cream-soft)",
            fontWeight: active === "dire" ? 500 : 400,
          }}
        >
          Je veux te dire
        </Link>
        <Link
          to="/parametres"
          aria-label="Paramètres"
          title="Paramètres"
          className="rounded-full px-4 py-1.5 text-[12.5px] transition-colors"
          style={{
            background: active === "settings" ? "var(--gold)" : "transparent",
            color: active === "settings" ? "var(--bg)" : "var(--cream-soft)",
            fontWeight: active === "settings" ? 500 : 400,
          }}
        >
          ⚙
        </Link>
      </div>
    </div>
  );
}
