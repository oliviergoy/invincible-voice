import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Form = {
  display_name: string;
  bio: string;
  voice_id: string;
  ai_provider: string;
  reader_rotated: boolean;
};

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
          </select>
        </Field>
        <Field label="Ma clé"
          hint={form.ai_provider === "openai"
            ? "À créer sur platform.openai.com, rubrique API keys (commence par sk-)."
            : "À créer sur console.anthropic.com, rubrique API Keys (commence par sk-ant-)."}>
          <input type="password" autoComplete="off" className={inputClass} value={aiKey}
            placeholder={hasAiKey ? "•••••••• enregistrée, tapez pour remplacer" : "Collez votre clé"}
            onChange={(e) => setAiKey(e.target.value)} />
        </Field>
      </Section>

      <Section num="03" color="var(--say)" title="Ma voix">
        <Field label="Ma clé ElevenLabs" hint="Sur elevenlabs.io : Profil, puis API Keys.">
          <input type="password" autoComplete="off" className={inputClass} value={elKey}
            placeholder={hasElKey ? "•••••••• enregistrée, tapez pour remplacer" : "Collez votre clé"}
            onChange={(e) => setElKey(e.target.value)} />
        </Field>
        <Field label="Identifiant de ma voix" hint="Dans ElevenLabs, rubrique Voices : ouvrez votre voix et copiez son ID.">
          <input className={inputClass} value={form.voice_id}
            onChange={(e) => set("voice_id", e.target.value)} />
        </Field>
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
