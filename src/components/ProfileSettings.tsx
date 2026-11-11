import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Form = {
  display_name: string;
  bio: string;
  voice_id: string;
  ai_provider: string;
  reader_rotated: boolean;
};

const inputClass = "mt-1.5 w-full rounded-xl border px-3 py-2 text-[14px] outline-none";
const inputStyle = { borderColor: "var(--edge)", background: "var(--surface)", color: "var(--cream)" };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-left">
      <span className="text-[13px]" style={{ color: "var(--cream-soft)" }}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px]" style={{ color: "var(--muted)" }}>{hint}</span>}
    </label>
  );
}

export function ProfileSettings() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [form, setForm] = useState<Form>({
    display_name: "",
    bio: "",
    voice_id: "",
    ai_provider: "anthropic",
    reader_rotated: true,
  });
  const [hasAiKey, setHasAiKey] = useState(false);
  const [hasElKey, setHasElKey] = useState(false);
  const [aiKey, setAiKey] = useState("");
  const [elKey, setElKey] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      setUserId(data.user.id);
      setEmail(data.user.email ?? "");
      const { data: s } = await supabase.from("user_settings").select("*").maybeSingle();
      if (s) {
        setForm({
          display_name: s.display_name,
          bio: s.bio,
          voice_id: s.voice_id,
          ai_provider: s.ai_provider,
          reader_rotated: s.reader_rotated,
        });
        setHasAiKey(!!s.ai_key);
        setHasElKey(!!s.elevenlabs_key);
      } else {
        setForm((f) => ({ ...f, display_name: data.user!.user_metadata?.full_name ?? "" }));
      }
    })();
  }, []);

  const save = async () => {
    if (!userId) return;
    setStatus("Enregistrement…");
    const row: Record<string, unknown> = { user_id: userId, ...form, updated_at: new Date().toISOString() };
    if (aiKey.trim()) row.ai_key = aiKey.trim();
    if (elKey.trim()) row.elevenlabs_key = elKey.trim();
    const { error } = await supabase
      .from("user_settings")
      .upsert(row as never, { onConflict: "user_id" });
    if (error) {
      setStatus("L'enregistrement a échoué.");
      return;
    }
    if (aiKey.trim()) setHasAiKey(true);
    if (elKey.trim()) setHasElKey(true);
    setAiKey("");
    setElKey("");
    setStatus("Enregistré ✓");
  };

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <section className="mt-10 space-y-5">
      <div className="flex items-center justify-between text-[12.5px]" style={{ color: "var(--muted)" }}>
        <span>Connecté : {email}</span>
        <button type="button" className="underline" onClick={() => void supabase.auth.signOut()}>
          Se déconnecter
        </button>
      </div>

      <h2 className="font-display text-[22px]" style={{ color: "var(--gold)" }}>Mon profil</h2>
      <Field label="Mon prénom et nom">
        <input className={inputClass} style={inputStyle} value={form.display_name}
          onChange={(e) => set("display_name", e.target.value)} />
      </Field>
      <Field label="Qui je suis" hint="Quelques lignes sur vous, vos proches, vos projets. L'IA s'en sert pour parler comme vous.">
        <textarea className={inputClass} style={inputStyle} rows={6} value={form.bio}
          onChange={(e) => set("bio", e.target.value)} />
      </Field>

      <h2 className="font-display pt-4 text-[22px]" style={{ color: "var(--gold)" }}>Mon IA</h2>
      <Field label="Service">
        <select className={inputClass} style={inputStyle} value={form.ai_provider}
          onChange={(e) => set("ai_provider", e.target.value)}>
          <option value="anthropic">Claude (Anthropic)</option>
          <option value="openai">ChatGPT (OpenAI)</option>
        </select>
      </Field>
      <Field label="Ma clé"
        hint={form.ai_provider === "openai"
          ? "À créer sur platform.openai.com → API keys (commence par sk-)."
          : "À créer sur console.anthropic.com → API Keys (commence par sk-ant-)."}>
        <input type="password" autoComplete="off" className={inputClass} style={inputStyle} value={aiKey}
          placeholder={hasAiKey ? "•••••••• enregistrée — tapez pour remplacer" : "Collez votre clé"}
          onChange={(e) => setAiKey(e.target.value)} />
      </Field>

      <h2 className="font-display pt-4 text-[22px]" style={{ color: "var(--gold)" }}>Ma voix (ElevenLabs)</h2>
      <Field label="Ma clé ElevenLabs" hint="elevenlabs.io → Profil → API Keys.">
        <input type="password" autoComplete="off" className={inputClass} style={inputStyle} value={elKey}
          placeholder={hasElKey ? "•••••••• enregistrée — tapez pour remplacer" : "Collez votre clé"}
          onChange={(e) => setElKey(e.target.value)} />
      </Field>
      <Field label="Identifiant de ma voix" hint="Dans ElevenLabs → Voices, ouvrez votre voix et copiez son ID.">
        <input className={inputClass} style={inputStyle} value={form.voice_id}
          onChange={(e) => set("voice_id", e.target.value)} />
      </Field>

      <h2 className="font-display pt-4 text-[22px]" style={{ color: "var(--gold)" }}>Affichage</h2>
      <label className="flex items-center gap-3 text-[14px]" style={{ color: "var(--cream-soft)" }}>
        <input type="checkbox" checked={form.reader_rotated}
          onChange={(e) => set("reader_rotated", e.target.checked)} />
        Ouvrir le plein écran retourné (pour la personne en face)
      </label>

      <div className="flex items-center gap-4 pt-2">
        <button type="button" onClick={() => void save()}
          className="font-display rounded-full px-6 py-2.5 text-[14px]"
          style={{ background: "var(--gold)", color: "var(--bg)" }}>
          Enregistrer
        </button>
        {status && <span className="text-[13px]" style={{ color: "var(--muted)" }}>{status}</span>}
      </div>
    </section>
  );
}
