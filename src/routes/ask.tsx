import { createFileRoute } from "@tanstack/react-router";
import { AppHeader, ModeTabs, PillGroup } from "@/components/Brand";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getExtraKnowledge } from "@/lib/knowledge-store";
import { authFetch, ERROR_HINTS } from "@/lib/auth-fetch";
import { recordWav } from "@/lib/record-wav";
import FullscreenReader from "@/components/FullscreenReader";

export const Route = createFileRoute("/ask")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Invincible Voice — Demandez-moi" },
      { property: "og:title", content: "Invincible Voice — Demandez-moi" },
    ],
  }),
});

type Lang = "fr" | "en";
type Length = "brief" | "long";
type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
  edited?: boolean;
};

const SUGGESTIONS: Record<Lang, { label: string; prompt: string }[]> = {
  fr: [
    { label: "Comment vas-tu ?", prompt: "Comment vas-tu ?" },
    { label: "Présentes toi stp ?", prompt: "Présentes toi stp ?" },
  ],
  en: [
    { label: "How are you?", prompt: "How are you?" },
    { label: "Can you introduce yourself, please?", prompt: "Can you introduce yourself, please?" },
  ],
};

const LABELS = {
  fr: {
    send: "Envoyer",
    cancel: "Annuler",
    save: "Enregistrer",
    edit: "Éditer",
    read: "Lire",
    fullscreenLabel: "Plein écran",
    fullscreenRotatedLabel: "Plein écran retourné",
    stop: "■ Stop",
    fullscreen: "⛶↻",
    fullscreenPlain: "⛶",
    close: "Fermer",
    synth: "Synthèse…",
    placeholder: "Posez votre question…",
    edited: "· édité",
    voiceUnavailable: "Voix non configurée, voir Paramètres",
    errorChat:
      "La réponse n'a pas pu être générée. Vérifiez votre connexion et réessayez.",
    errorTTS: "La voix n'a pas pu être générée pour ce message.",
    dictate: "Dicter la question",
    listening: "Écoute… touchez pour arrêter",
    transcribing: "Transcription…",
    errorMic: "Le micro n'est pas accessible. Vérifiez l'autorisation du navigateur.",
    errorDictate: "La dictée n'a pas pu être transcrite. Réessayez.",
  },
  en: {
    send: "Send",
    cancel: "Cancel",
    save: "Save",
    edit: "Edit",
    read: "Read",
    fullscreenLabel: "Full screen",
    fullscreenRotatedLabel: "Full screen, upside down",
    stop: "■ Stop",
    fullscreen: "⛶↻",
    fullscreenPlain: "⛶",
    close: "Close",
    synth: "Synthesizing…",
    placeholder: "Ask your question…",
    edited: "· edited",
    voiceUnavailable: "Voice not set up, see Settings",
    errorChat:
      "The response could not be generated. Check your connection and try again.",
    errorTTS: "The voice could not be generated for this message.",
    dictate: "Dictate the question",
    listening: "Listening… tap to stop",
    transcribing: "Transcribing…",
    errorMic: "The microphone is not accessible. Check the browser permission.",
    errorDictate: "The dictation could not be transcribed. Please try again.",
  },
};

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function Index() {
  const [lang, setLang] = useState<Lang>("fr");
  const [length, setLength] = useState<Length>("long");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState<{ id: string; name: string } | null>(null);
  const [fullscreen, setFullscreen] = useState<{ text: string; rotated: boolean } | null>(null);
  const [voiceFailed, setVoiceFailed] = useState(false);

  // TTS state per message
  const [ttsState, setTtsState] = useState<Record<string, "idle" | "loading" | "playing">>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingIdRef = useRef<string | null>(null);

  // Edit state per message
  const [editing, setEditing] = useState<Record<string, string | undefined>>({});

  // Dictation state
  const [dictation, setDictation] = useState<"idle" | "recording" | "transcribing">("idle");
  const [dictateError, setDictateError] = useState<string | null>(null);
  const recorderRef = useRef<{ stop: () => Promise<File> } | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const t = LABELS[lang];

  useEffect(() => {
    let cancelled = false;
    authFetch("/api/voices")
      .then(async (r) => {
        if (!r.ok) throw new Error("voice");
        return r.json();
      })
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
  }, [messages, loading]);

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

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      const userMsg: Message = { id: genId(), role: "user", content: trimmed };
      const next = [...messages, userMsg];
      setMessages(next);
      setInput("");
      setLoading(true);
      try {
        const res = await authFetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: next.map(({ role, content }) => ({ role, content })),
            lang,
            length,
            extraKnowledge: await getExtraKnowledge(),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok && !(data.error && ERROR_HINTS[data.error])) throw new Error("chat");
        const reply = res.ok ? (data.text ?? "").trim() : ERROR_HINTS[data.error!];
        setMessages((cur) => [
          ...cur,
          { id: genId(), role: "assistant", content: reply || t.errorChat },
        ]);
      } catch {
        setMessages((cur) => [
          ...cur,
          { id: genId(), role: "assistant", content: t.errorChat },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, lang, length, t],
  );

  const toggleDictation = useCallback(async () => {
    setDictateError(null);
    if (dictation === "recording" && recorderRef.current) {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      setDictation("transcribing");
      try {
        const file = await recorder.stop();
        const form = new FormData();
        form.append("file", file, file.name);
        const res = await authFetch("/api/transcribe", { method: "POST", body: form });
        if (!res.ok) throw new Error("transcribe");
        const data = (await res.json()) as { text?: string };
        const transcript = (data.text ?? "").trim();
        if (!transcript) throw new Error("empty");
        setInput((prev) => (prev.trim() ? prev.trim() + " " + transcript : transcript));
      } catch {
        setDictateError(t.errorDictate);
      } finally {
        setDictation("idle");
      }
      return;
    }
    if (dictation !== "idle") return;
    try {
      recorderRef.current = await recordWav();
      setDictation("recording");
    } catch {
      recorderRef.current = null;
      setDictation("idle");
      setDictateError(t.errorMic);
    }
  }, [dictation, t]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const playTTS = useCallback(
    async (msg: Message) => {
      if (!voice) return;
      if (playingIdRef.current === msg.id) {
        stopAudio();
        return;
      }
      stopAudio();
      setTtsState((s) => ({ ...s, [msg.id]: "loading" }));
      try {
        const res = await authFetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: msg.content, voice_id: voice.id }),
        });
        if (!res.ok) throw new Error("tts");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        playingIdRef.current = msg.id;
        setTtsState((s) => ({ ...s, [msg.id]: "playing" }));
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (playingIdRef.current === msg.id) {
            playingIdRef.current = null;
            audioRef.current = null;
            setTtsState((s) => ({ ...s, [msg.id]: "idle" }));
          }
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          playingIdRef.current = null;
          audioRef.current = null;
          setTtsState((s) => ({ ...s, [msg.id]: "idle" }));
        };
        await audio.play();
      } catch {
        setTtsState((s) => ({ ...s, [msg.id]: "idle" }));
        setMessages((cur) => [
          ...cur,
          { id: genId(), role: "assistant", content: t.errorTTS },
        ]);
      }
    },
    [voice, stopAudio, t],
  );

  const startEdit = (msg: Message) => setEditing((e) => ({ ...e, [msg.id]: msg.content }));
  const cancelEdit = (id: string) =>
    setEditing((e) => {
      const n = { ...e };
      delete n[id];
      return n;
    });
  const saveEdit = (id: string) => {
    const val = editing[id];
    if (val === undefined) return;
    setMessages((cur) =>
      cur.map((m) => (m.id === id ? { ...m, content: val.trim(), edited: true } : m)),
    );
    cancelEdit(id);
  };

  const suggestions = useMemo(() => SUGGESTIONS[lang], [lang]);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        voiceName={voice?.name}
        voiceFailed={voiceFailed}
        voiceLabel={lang === "fr" ? "Voix" : "Voice"}
        unavailableLabel={t.voiceUnavailable}
      />
      <ModeTabs active="ask" />

      <main className="mx-auto flex w-full max-w-[980px] flex-1 flex-col px-5 pb-8 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
              { value: "brief", label: lang === "fr" ? "Bref" : "Brief" },
              { value: "long", label: "Long" },
            ]}
            value={length}
            onChange={(v) => setLength(v as Length)}
          />
        </div>

        <div ref={scrollRef} className="mt-8 flex-1 space-y-6 overflow-y-auto pb-4">
          {messages.length === 0 && (
            <p className="font-display mt-10 text-center text-[22px]" style={{ color: "var(--muted)" }}>
              {lang === "fr" ? "La conversation commence ici." : "The conversation starts here."}
            </p>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              t={t}
              voice={voice}
              isEditing={editing[m.id] !== undefined}
              editValue={editing[m.id] ?? ""}
              onEditChange={(v) => setEditing((e) => ({ ...e, [m.id]: v }))}
              onStartEdit={() => startEdit(m)}
              onCancelEdit={() => cancelEdit(m.id)}
              onSaveEdit={() => saveEdit(m.id)}
              ttsState={ttsState[m.id] ?? "idle"}
              onPlay={() => void playTTS(m)}
              onFullscreen={() => setFullscreen({ text: m.content, rotated: false })}
              onFullscreenRotated={() => setFullscreen({ text: m.content, rotated: true })}
            />
          ))}
          {loading && (
            <div className="anim-msg-in flex justify-end">
              <div className="rounded-[28px] px-6 py-4" style={{ background: "var(--ask)" }}>
                <span className="dot" style={{ background: "var(--white)" }} />
                <span className="dot" style={{ background: "var(--white)" }} />
                <span className="dot" style={{ background: "var(--white)" }} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s.label} type="button" onClick={() => setInput(s.prompt)} className="chip">
              {s.label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="composer mt-4">
          <button
            type="button"
            onClick={() => void toggleDictation()}
            disabled={dictation === "transcribing"}
            title={dictation === "recording" ? t.listening : t.dictate}
            aria-label={dictation === "recording" ? t.listening : t.dictate}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full disabled:opacity-60 ${dictation === "recording" ? "pulse-gold" : ""}`}
            style={{ background: "var(--ask)", color: "var(--white)" }}
          >
            {dictation === "transcribing" ? (
              <span className="spinner" />
            ) : dictation === "recording" ? (
              "■"
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            )}
          </button>
          <textarea
            aria-label={t.placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={t.placeholder}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-[19px] placeholder:opacity-60"
            style={{ color: "var(--ink)", maxHeight: 200 }}
          />
          <button type="submit" disabled={loading || !input.trim()} className="btn btn-primary text-[18px]">
            {t.send}
          </button>
        </form>

        {(dictation !== "idle" || dictateError) && (
          <p className="mt-2 text-center text-[14px]" style={{ color: "var(--muted)" }}>
            {dictateError ?? (dictation === "recording" ? t.listening : t.transcribing)}
          </p>
        )}
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

function MessageBubble({
  msg,
  t,
  voice,
  isEditing,
  editValue,
  onEditChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  ttsState,
  onPlay,
  onFullscreen,
  onFullscreenRotated,
}: {
  msg: Message;
  t: typeof LABELS["fr"];
  voice: { id: string; name: string } | null;
  isEditing: boolean;
  editValue: string;
  onEditChange: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  ttsState: "idle" | "loading" | "playing";
  onPlay: () => void;
  onFullscreen: () => void;
  onFullscreenRotated: () => void;
}) {
  const isUser = msg.role === "user";
  if (isUser) {
    return (
      <div className="anim-msg-in flex justify-start">
        <div className="max-w-[85%] rounded-[28px] border-[3px] bg-card px-6 py-4 text-[19px] whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="anim-msg-in flex flex-col items-end">
      <div
        className={`${isEditing ? "w-full" : "max-w-[90%]"} rounded-[28px] px-6 py-5 text-[24px] leading-snug whitespace-pre-wrap`}
        style={{ background: "var(--ask)", color: "var(--white)" }}
      >
        {isEditing ? (
          <textarea
            aria-label={t.edit}
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            rows={Math.min(30, Math.max(8, editValue.split("\n").length * 2 + 4))}
            className="field"
            autoFocus
          />
        ) : (
          msg.content
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {isEditing ? (
          <>
            <button type="button" onClick={onCancelEdit} className="btn btn-secondary">{t.cancel}</button>
            <button type="button" onClick={onSaveEdit} className="btn btn-primary">{t.save}</button>
          </>
        ) : (
          <>
            {msg.edited && <span className="text-[14px]" style={{ color: "var(--muted)" }}>{t.edited}</span>}
            <button type="button" onClick={onFullscreen} className="btn btn-secondary" title="Plein écran, dans le sens de lecture">
              {t.fullscreenLabel}
            </button>
            <button type="button" onClick={onFullscreenRotated} className="btn btn-secondary" title="Plein écran retourné, pour la personne en face" aria-label={t.fullscreenRotatedLabel}>
              <span className="inline-block rotate-180">{t.fullscreenLabel}</span>
            </button>
            <button type="button" onClick={onStartEdit} className="btn btn-secondary">{t.edit}</button>
            {voice && (
              <button
                type="button"
                onClick={onPlay}
                disabled={ttsState === "loading"}
                className={`btn btn-primary ${ttsState === "playing" ? "pulse-gold" : ""}`}
              >
                {ttsState === "loading" ? (
                  <><span className="spinner" /> {t.synth}</>
                ) : ttsState === "playing" ? (
                  t.stop
                ) : (
                  t.read
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
