import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TabNav } from "./dire";
import { getExtraKnowledge } from "@/lib/knowledge-store";
import { authFetch, ERROR_HINTS } from "@/lib/auth-fetch";
import { recordWav } from "@/lib/record-wav";
import FullscreenReader from "@/components/FullscreenReader";

export const Route = createFileRoute("/ask")({
  component: Index,
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
    read: "▸ Lire",
    stop: "■ Stop",
    fullscreen: "⛶↻",
    fullscreenPlain: "⛶",
    close: "Fermer",
    synth: "Synthèse…",
    placeholder: "Posez votre question…",
    edited: "· édité",
    voiceUnavailable: "Voix non configurée — voir ⚙",
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
    read: "▸ Read",
    stop: "■ Stop",
    fullscreen: "⛶↻",
    fullscreenPlain: "⛶",
    close: "Close",
    synth: "Synthesizing…",
    placeholder: "Ask your question…",
    edited: "· edited",
    voiceUnavailable: "Voice not set up — see ⚙",
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
        <Link
          to="/parametres"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[11.5px] transition-opacity hover:opacity-80"
          style={{
            borderColor: "var(--edge)",
            background: "rgba(201,161,88,0.06)",
            color: "var(--gold)",
          }}
        >
          ⚙ Paramètres
        </Link>
        <p
          className="mt-4 max-w-[520px] text-sm sm:text-[15px]"
          style={{ color: "var(--muted)" }}
        >
          Posez votre question — éditez la réponse, écoutez-la à voix haute.
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
              <span style={{ color: "var(--gold)" }}>●</span> Voix : {voice.name}
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
      <TabNav active="ask" />

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
            { value: "brief", label: "Bref" },
            { value: "long", label: "Long" },
          ]}
          value={length}
          onChange={(v) => setLength(v as Length)}
        />
      </div>

      {/* Suggestions */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setInput(s.prompt)}
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
            {s.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="mt-8 flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <div
            className="font-display mt-8 text-center text-[15px]"
            style={{ color: "var(--muted)" }}
          >
            La conversation commence ici.
          </div>
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
            onFullscreen={() => setFullscreen({ text: m.content, rotated: true })}
            onFullscreenFlat={() => setFullscreen({ text: m.content, rotated: false })}
          />
        ))}
        {loading && (
          <div className="anim-msg-in flex justify-start">
            <div
              className="rounded-2xl px-4 py-3"
              style={{
                background: "var(--surface)",
                borderBottomLeftRadius: 4,
                border: "1px solid var(--edge)",
              }}
            >
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
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
        <button
          type="button"
          onClick={() => void toggleDictation()}
          disabled={dictation === "transcribing"}
          title={dictation === "recording" ? t.listening : t.dictate}
          aria-label={dictation === "recording" ? t.listening : t.dictate}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[15px] transition-opacity hover:opacity-80 disabled:opacity-60 ${dictation === "recording" ? "pulse-gold" : ""}`}
          style={{
            borderColor: "var(--edge)",
            background: dictation === "recording" ? "var(--gold)" : "transparent",
            color: dictation === "recording" ? "var(--bg)" : "var(--cream-soft)",
          }}
        >
          {dictation === "transcribing" ? (
            <span className="spinner" />
          ) : dictation === "recording" ? (
            "■"
          ) : (
            "🎙"
          )}
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={t.placeholder}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed placeholder:opacity-60"
          style={{ color: "var(--cream)", maxHeight: 200 }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="font-display rounded-full px-5 py-2 text-[14px] transition-opacity disabled:opacity-40"
          style={{
            background: "var(--gold)",
            color: "var(--bg)",
            fontWeight: 400,
          }}
        >
          {t.send}
        </button>
      </form>

      {(dictation !== "idle" || dictateError) && (
        <div
          className="mt-2 text-center text-[12.5px] italic"
          style={{ color: dictateError ? "var(--gold)" : "var(--muted)" }}
        >
          {dictateError ??
            (dictation === "recording" ? t.listening : t.transcribing)}
        </div>
      )}

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
  onFullscreenFlat,
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
  onFullscreenFlat: () => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={`anim-msg-in flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={isEditing ? "w-full" : "max-w-[88%] sm:max-w-[80%]"}>
        <div
          className="px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap"
          style={{
            background: isUser ? "rgba(201,161,88,0.10)" : "var(--surface)",
            color: "var(--cream)",
            borderRadius: 16,
            borderBottomRightRadius: isUser ? 4 : 16,
            borderBottomLeftRadius: isUser ? 16 : 4,
            border: "1px solid var(--edge)",
          }}
        >
          {isEditing ? (
            <textarea
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              rows={Math.min(48, Math.max(16, editValue.split("\n").length * 2 + 4))}
              className="w-full resize-y bg-transparent text-[15px] leading-relaxed"
              style={{ color: "var(--cream)", minHeight: 480 }}
              autoFocus
            />
          ) : (
            msg.content
          )}
        </div>

        {!isUser && (
          <div className="mt-2.5 flex items-center gap-2 px-1 text-[14px]">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="rounded-full border px-4 py-1.5 transition-opacity hover:opacity-80"
                  style={{ color: "var(--muted)", borderColor: "var(--edge)" }}
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={onSaveEdit}
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
                  onClick={onFullscreen}
                  className="rounded-full border px-3 py-1.5 transition-opacity hover:opacity-80"
                  style={{ color: "var(--cream-soft)", borderColor: "var(--edge)" }}
                  title="Plein écran retourné, pour la personne en face"
                >
                  {t.fullscreen}
                </button>
                <button
                  type="button"
                  onClick={onFullscreenFlat}
                  className="rounded-full border px-3 py-1.5 transition-opacity hover:opacity-80"
                  style={{ color: "var(--cream-soft)", borderColor: "var(--edge)" }}
                  title="Plein écran dans votre sens, sans retourner"
                >
                  {t.fullscreenPlain}
                </button>
                <button
                  type="button"
                  onClick={onStartEdit}
                  className="rounded-full border px-4 py-1.5 transition-opacity hover:opacity-80"
                  style={{ color: "var(--cream-soft)", borderColor: "var(--edge)" }}
                >
                  {t.edit}
                </button>
                {voice && (
                  <button
                    type="button"
                    onClick={onPlay}
                    disabled={ttsState === "loading"}
                    className={`font-display rounded-full px-4 py-1.5 transition-opacity hover:opacity-80 ${ttsState === "playing" ? "pulse-gold" : ""}`}
                    style={{ background: "var(--gold)", color: "var(--bg)" }}
                  >
                    {ttsState === "loading" ? (
                      <>
                        <span className="spinner" /> {t.synth}
                      </>
                    ) : ttsState === "playing" ? (
                      t.stop
                    ) : (
                      t.read
                    )}
                  </button>
                )}
                {msg.edited && (
                  <span style={{ color: "var(--muted)" }} className="italic text-[12px]">
                    {t.edited}
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
