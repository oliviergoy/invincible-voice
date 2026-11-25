import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { authFetch } from "@/lib/auth-fetch";
import { recordWav } from "@/lib/record-wav";

type Form = {
  display_name: string;
  bio: string;
  voice_provider: string;
  voice_id: string;
  gradium_voice_id: string;
  ai_provider: string;
  reader_rotated: boolean;
};

type LibraryVoice = {
  id: string;
  name: string;
  description: string | null;
  language: string | null;
  own: boolean;
};

const LANGUAGES: Array<[string, string]> = [
  ["fr", "Français"],
  ["en", "English"],
  ["de", "Deutsch"],
  ["es", "Español"],
  ["pt", "Português"],
];

function groupVoices(voices: LibraryVoice[]): Array<[string, LibraryVoice[]]> {
  const known = new Set(LANGUAGES.map(([code]) => code));
  const groups: Array<[string, LibraryVoice[]]> = [
    ["Mes voix", voices.filter((v) => v.own)],
    ...LANGUAGES.map(([code, label]): [string, LibraryVoice[]] => [
      label,
      voices.filter((v) => !v.own && v.language === code),
    ]),
    ["Autres", voices.filter((v) => !v.own && !known.has(v.language ?? ""))],
  ];
  return groups.filter(([, list]) => list.length > 0);
}

const inputClass = "field mt-2";

export function Section({ num, color, title, children }: { num: string; color: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 py-8 sm:grid-cols-[140px_1fr]">
      <div className="font-display text-[64px] leading-none" style={{ color }}>{num}</div>
      <div className="space-y-5">
        <h2 className="font-display text-[30px] leading-tight">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-left">
      <span className="text-[16px] font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[14px]" style={{ color: "var(--muted)" }}>{hint}</span>}
    </label>
  );
}

export function ProfileSettings() {
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({
    display_name: "",
    bio: "",
    voice_provider: "elevenlabs",
    voice_id: "",
    gradium_voice_id: "",
    ai_provider: "anthropic",
    reader_rotated: true,
  });
  const [hasAiKey, setHasAiKey] = useState(false);
  const [hasElKey, setHasElKey] = useState(false);
  const [hasGradiumKey, setHasGradiumKey] = useState(false);
  const [aiKey, setAiKey] = useState("");
  const [elKey, setElKey] = useState("");
  const [gradiumKey, setGradiumKey] = useState("");
  const [library, setLibrary] = useState<LibraryVoice[] | "loading" | "error" | null>(null);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      const { data: s } = await supabase.from("user_settings").select("*").maybeSingle();
      if (s) {
        setForm({
          display_name: s.display_name,
          bio: s.bio,
          voice_provider: s.voice_provider,
          voice_id: s.voice_id,
          gradium_voice_id: s.gradium_voice_id,
          ai_provider: s.ai_provider,
          reader_rotated: s.reader_rotated,
        });
        setHasAiKey(!!s.ai_key);
        setHasElKey(!!s.elevenlabs_key);
        setHasGradiumKey(!!s.gradium_key);
      } else {
        setForm((f) => ({ ...f, display_name: data.user!.user_metadata?.full_name ?? "" }));
      }
    })();
  }, []);

  const showLibrary = form.voice_provider === "gradium" && hasGradiumKey;
  useEffect(() => {
    if (!showLibrary) return;
    let cancelled = false;
    setLibrary("loading");
    authFetch("/api/gradium-voices")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { voices: LibraryVoice[] }) => {
        if (!cancelled) setLibrary(data.voices);
      })
      .catch(() => {
        if (!cancelled) setLibrary("error");
      });
    return () => {
      cancelled = true;
    };
  }, [showLibrary, libraryVersion]);

  const save = async () => {
    if (!userId) return;
    setStatus("Enregistrement…");
    const row: Record<string, unknown> = { user_id: userId, ...form, updated_at: new Date().toISOString() };
    if (aiKey.trim()) row.ai_key = aiKey.trim();
    if (elKey.trim()) row.elevenlabs_key = elKey.trim();
    if (gradiumKey.trim()) row.gradium_key = gradiumKey.trim();
    const { error } = await supabase
      .from("user_settings")
      .upsert(row as never, { onConflict: "user_id" });
    if (error) {
      setStatus("L'enregistrement a échoué.");
      return;
    }
    if (aiKey.trim()) setHasAiKey(true);
    if (elKey.trim()) setHasElKey(true);
    if (gradiumKey.trim()) {
      setHasGradiumKey(true);
      setLibraryVersion((n) => n + 1);
    }
    setAiKey("");
    setElKey("");
    setGradiumKey("");
    setStatus("Enregistré ✓");
  };

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setStatus(null);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const voiceCreated = async (voice: LibraryVoice) => {
    setLibrary((l) => (Array.isArray(l) ? [voice, ...l] : l));
    set("gradium_voice_id", voice.id);
    if (!userId) return;
    const { error } = await supabase
      .from("user_settings")
      .upsert(
        { user_id: userId, voice_provider: "gradium", gradium_voice_id: voice.id },
        { onConflict: "user_id" },
      );
    setStatus(
      error ? "Voix créée. Cliquez sur Enregistrer pour la garder." : "Voix créée et choisie ✓",
    );
  };

  return (
    <div className="mt-6">
      <Section num="01" color="var(--ask)" title="Mon profil">
        <Field label="Mon prénom et nom">
          <input className={inputClass} value={form.display_name}
            onChange={(e) => set("display_name", e.target.value)} />
        </Field>
        <Field label="Qui je suis" hint="Quelques lignes sur vous, vos proches, vos projets. L'IA s'en sert pour parler comme vous.">
          <textarea className={inputClass} rows={6} value={form.bio}
            onChange={(e) => set("bio", e.target.value)} />
        </Field>
        <label className="flex min-h-[44px] items-center gap-3 text-[16px]">
          <input type="checkbox" className="h-5 w-5" checked={form.reader_rotated}
            onChange={(e) => set("reader_rotated", e.target.checked)} />
          Ouvrir le plein écran retourné (pour la personne en face)
        </label>
      </Section>

      <Section num="02" color="var(--ink)" title="Mon IA">
        <Field label="Service">
          <select className={inputClass} value={form.ai_provider}
            onChange={(e) => set("ai_provider", e.target.value)}>
            <option value="anthropic">Claude (Anthropic)</option>
            <option value="openai">ChatGPT (OpenAI)</option>
            <option value="mistral">Le Chat (Mistral)</option>
          </select>
        </Field>
        <Field label="Ma clé"
          hint={form.ai_provider === "openai"
            ? "À créer sur platform.openai.com, rubrique API keys (commence par sk-)."
            : form.ai_provider === "mistral"
            ? "À créer sur console.mistral.ai, rubrique API Keys."
            : "À créer sur console.anthropic.com, rubrique API Keys (commence par sk-ant-)."}>
          <input type="password" autoComplete="off" className={inputClass} value={aiKey}
            placeholder={hasAiKey ? "•••••••• enregistrée, tapez pour remplacer" : "Collez votre clé"}
            onChange={(e) => setAiKey(e.target.value)} />
        </Field>
      </Section>

      <Section num="03" color="var(--say)" title="Ma voix">
        <Field label="Service">
          <select
            className={inputClass}
            value={form.voice_provider}
            onChange={(e) => set("voice_provider", e.target.value)}
          >
            <option value="elevenlabs">ElevenLabs</option>
            <option value="gradium">Kyutai (Gradium)</option>
          </select>
        </Field>
        {form.voice_provider === "gradium" ? (
          <>
            <Field
              label="Ma clé Gradium"
              hint="À créer dans Gradium Studio, sur studio.gradium.ai."
            >
              <input
                type="password"
                autoComplete="off"
                className={inputClass}
                value={gradiumKey}
                placeholder={
                  hasGradiumKey ? "•••••••• enregistrée, tapez pour remplacer" : "Collez votre clé"
                }
                onChange={(e) => setGradiumKey(e.target.value)}
              />
            </Field>
            <GradiumVoicePicker
              hasKey={hasGradiumKey}
              library={library}
              value={form.gradium_voice_id}
              onChange={(id) => set("gradium_voice_id", id)}
            />
            {hasGradiumKey && Array.isArray(library) && (
              <CreateGradiumVoice
                defaultName={form.display_name.trim() || "Ma voix"}
                onCreated={(voice) => void voiceCreated(voice)}
              />
            )}
          </>
        ) : (
          <>
            <Field label="Ma clé ElevenLabs" hint="Sur elevenlabs.io : Profil, puis API Keys.">
              <input
                type="password"
                autoComplete="off"
                className={inputClass}
                value={elKey}
                placeholder={
                  hasElKey ? "•••••••• enregistrée, tapez pour remplacer" : "Collez votre clé"
                }
                onChange={(e) => setElKey(e.target.value)}
              />
            </Field>
            <Field
              label="Identifiant de ma voix"
              hint="Dans ElevenLabs, rubrique Voices : ouvrez votre voix et copiez son ID."
            >
              <input
                className={inputClass}
                value={form.voice_id}
                onChange={(e) => set("voice_id", e.target.value)}
              />
            </Field>
          </>
        )}
      </Section>

      <div className="flex items-center justify-end gap-4 pt-6">
        {status && <span className="text-[15px]" style={{ color: "var(--muted)" }}>{status}</span>}
        <button type="button" onClick={() => void save()} className="btn btn-primary px-8">
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function GradiumVoicePicker({
  hasKey,
  library,
  value,
  onChange,
}: {
  hasKey: boolean;
  library: LibraryVoice[] | "loading" | "error" | null;
  value: string;
  onChange: (id: string) => void;
}) {
  const muted = { color: "var(--muted)" };
  if (!hasKey) {
    return (
      <p className="text-[15px]" style={muted}>
        Enregistrez votre clé pour choisir une voix.
      </p>
    );
  }
  if (library === null || library === "loading") {
    return (
      <p className="text-[15px]" style={muted}>
        Chargement des voix…
      </p>
    );
  }
  if (library === "error") {
    return (
      <p className="text-[15px]" style={{ color: "var(--say)" }}>
        Impossible de charger les voix Gradium. Vérifiez votre clé.
      </p>
    );
  }
  const selected = library.find((v) => v.id === value);
  return (
    <Field
      label="Ma voix"
      hint={
        selected?.description ?? "Les voix que vous créez apparaissent en tête, sous « Mes voix »."
      }
    >
      <select
        className={inputClass}
        value={selected ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Choisir une voix
        </option>
        {groupVoices(library).map(([label, voices]) => (
          <optgroup key={label} label={label}>
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </Field>
  );
}

const CREATE_ERRORS: Record<string, string> = {
  bad_audio: "Gradium n'a pas pu lire ce fichier. Essayez un autre enregistrement.",
  file_too_large: "Ce fichier dépasse 50 Mo. Choisissez un extrait plus court.",
  invalid_key: "Votre clé Gradium n'est pas valide.",
  voice_limit:
    "Vous avez atteint le nombre de voix permis par votre offre Gradium (6 avec l'offre gratuite). Supprimez-en une dans Gradium Studio, sur studio.gradium.ai.",
};

function CreateGradiumVoice({
  defaultName,
  onCreated,
}: {
  defaultName: string;
  onCreated: (voice: LibraryVoice) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [language, setLanguage] = useState("fr");
  const [sample, setSample] = useState<{ file: File; label: string } | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<{ stop: () => Promise<File> } | null>(null);
  const recording = recordingSeconds !== null;

  const sampleUrl = useMemo(() => (sample ? URL.createObjectURL(sample.file) : null), [sample]);
  useEffect(
    () => () => {
      if (sampleUrl) URL.revokeObjectURL(sampleUrl);
    },
    [sampleUrl],
  );

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecordingSeconds((s) => (s === null ? s : s + 1)), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const releaseMic = () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setRecordingSeconds(null);
    return recorder;
  };

  useEffect(
    () => () => {
      void recorderRef.current?.stop().catch(() => undefined);
    },
    [],
  );

  const startRecording = async () => {
    setError(null);
    try {
      recorderRef.current = await recordWav();
      setRecordingSeconds(0);
    } catch {
      setError("Impossible d'accéder au micro. Autorisez-le dans le navigateur.");
    }
  };

  const stopRecording = async () => {
    const seconds = recordingSeconds ?? 0;
    const recorder = releaseMic();
    if (!recorder) return;
    try {
      setSample({ file: await recorder.stop(), label: `Enregistrement de ${seconds} s` });
    } catch {
      setError("L'enregistrement est vide. Recommencez.");
    }
  };

  const close = () => {
    void releaseMic()
      ?.stop()
      .catch(() => undefined);
    setSample(null);
    setConsent(false);
    setError(null);
    setOpen(false);
  };

  const create = async () => {
    if (!sample) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("audio_file", sample.file, sample.file.name);
    body.append("name", name.trim());
    body.append("language", language);
    try {
      const r = await authFetch("/api/gradium-voices", { method: "POST", body });
      const data = (await r.json()) as { voice?: LibraryVoice; error?: string };
      if (!r.ok || !data.voice) throw new Error(data.error);
      onCreated(data.voice);
      close();
    } catch (err) {
      setError(CREATE_ERRORS[(err as Error).message] ?? "La création a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Créer ma voix
      </button>
    );
  }

  const muted = { color: "var(--muted)" };
  return (
    <div className="space-y-5 rounded-2xl border-2 p-5" style={{ borderColor: "var(--ink)" }}>
      <h3 className="text-[20px] font-medium">Créer ma voix</h3>
      <p className="text-[15px]" style={muted}>
        Enregistrez-vous au moins 10 secondes, au calme et sans autre voix. Vous pouvez aussi
        choisir un ancien enregistrement : mémo vocal, message ou vidéo.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {recording ? (
          <button type="button" className="btn btn-say" onClick={() => void stopRecording()}>
            Arrêter ({recordingSeconds} s)
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => void startRecording()}>
            Enregistrer au micro
          </button>
        )}
        <label className={`btn btn-secondary ${recording ? "pointer-events-none opacity-40" : ""}`}>
          Choisir un fichier
          <input
            type="file"
            accept="audio/*,video/*"
            className="sr-only"
            disabled={recording}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) setSample({ file, label: file.name });
            }}
          />
        </label>
      </div>
      {sample && sampleUrl && (
        <div className="space-y-2">
          <p className="text-[15px]">{sample.label}</p>
          <audio controls src={sampleUrl} className="w-full" />
        </div>
      )}
      <Field label="Nom de la voix">
        <input
          className={inputClass}
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Langue parlée dans l'enregistrement">
        <select
          className={inputClass}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          {LANGUAGES.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex min-h-[44px] items-center gap-3 text-[16px]">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        C'est ma voix, ou j'ai l'accord de la personne enregistrée.
      </label>
      {error && (
        <p className="text-[15px]" style={{ color: "var(--say)" }}>
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className="btn btn-secondary" onClick={close} disabled={busy}>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void create()}
          disabled={busy || recording || !sample || !name.trim() || !consent}
        >
          {busy ? "Création…" : "Créer la voix"}
        </button>
      </div>
    </div>
  );
}
