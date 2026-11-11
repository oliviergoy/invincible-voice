import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Brand";
import { useEffect, useRef, useState } from "react";
import {
  loadDocs,
  addDoc,
  deleteDoc,
  deleteAllDocs,
  type KnowledgeDoc,
} from "@/lib/knowledge-store";
import { ProfileSettings, Section } from "@/components/ProfileSettings";

export const Route = createFileRoute("/parametres")({
  component: ParametresPage,
  head: () => ({
    meta: [
      { title: "Invincible Voice — Paramètres" },
      { property: "og:title", content: "Invincible Voice — Paramètres" },
    ],
  }),
});


// Safari lacks async iteration on ReadableStream, which pdf.js uses for text extraction
function polyfillStreamIterator() {
  const proto = ReadableStream.prototype as unknown as Record<symbol, unknown>;
  if (proto[Symbol.asyncIterator]) return;
  proto[Symbol.asyncIterator] = async function* (this: ReadableStream) {
    const reader = this.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };
}

async function extractPdf(file: File): Promise<string> {
  polyfillStreamIterator();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"))
    .default;
  (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    workerUrl;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => (it as { str?: string }).str ?? "")
      .join(" ");
    out += text + "\n\n";
  }
  // Postgres rejects NUL chars, common in print-ready PDFs
  return out.replace(/\u0000/g, "").replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, " ").trim();
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const buf = await file.arrayBuffer();
  const result = await (mammoth as unknown as {
    extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  }).extractRawText({ arrayBuffer: buf });
  return result.value.trim();
}

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdf(file);
  }
  if (
    name.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocx(file);
  }
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
    return (await file.text()).trim();
  }
  throw new Error("unsupported");
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}

function ParametresPage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [email, setEmail] = useState("");
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    void loadDocs().then(setDocs);
  }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    let added = 0;
    for (const file of Array.from(files)) {
      try {
        const text = await extractText(file);
        if (!text) {
          setError(`Aucun texte extrait de ${file.name}.`);
          continue;
        }
        const clean = text.replace(/\u0000/g, "");
        await addDoc({ name: file.name, text: clean, size: file.size });
        added++;
      } catch (err) {
        console.error("extract failed", err);
        setError(
          `Impossible de lire ${file.name}. Formats supportés : PDF, Word (.docx), texte (.txt).` +
            ((err as { message?: string })?.message ? ` (${(err as { message?: string }).message})` : ""),
        );
      }
    }
    if (added) setDocs(await loadDocs());
    if (inputRef.current) inputRef.current.value = "";
    setBusy(false);
  };

  const remove = (id: string) => {
    setDocs(docs.filter((d) => d.id !== id));
    void deleteDoc(id);
  };

  const totalChars = docs.reduce((s, d) => s + d.text.length, 0);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[980px] flex-col px-5 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <Link to="/dire" className="flex min-h-[44px] items-center gap-3">
          <Logo size={52} />
          <span className="font-display text-[24px]">Invincible Voice</span>
        </Link>
        <nav className="flex flex-wrap gap-2" aria-label="Retour">
          <Link to="/ask" className="btn btn-ask">Demandez-moi</Link>
          <Link to="/dire" className="btn btn-say">Je veux te dire</Link>
        </nav>
      </header>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[48px] leading-none sm:text-[72px]">Paramètres</h1>
        <div className="text-right text-[15px]" style={{ color: "var(--muted)" }}>
          <div>{email}</div>
          <button type="button" className="min-h-[44px] underline" style={{ color: "var(--ink)" }}
            onClick={() => void supabase.auth.signOut()}>
            Se déconnecter
          </button>
        </div>
      </div>

      <ProfileSettings />

      <Section num="04" color="var(--ink)" title="Mes documents">

      <div className="mt-4">
        <div
          className="rounded-2xl border p-6 text-center"
          style={{
            borderColor: "var(--edge)",
            background: "var(--white)",
            borderStyle: "dashed", borderWidth: 2,
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            multiple
            className="hidden"
            onChange={(e) => void onFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="btn btn-primary"
          >
            {busy ? "Lecture…" : "Ajouter des fichiers"}
          </button>
          <div
            className="mt-3 text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            PDF · Word (.docx) · Texte (.txt)
          </div>
          {error && (
            <div className="mt-3 text-[12.5px]" style={{ color: "var(--say)" }}>
              {error}
            </div>
          )}
        </div>

        <div className="mt-6">
          <div
            className="mb-3 flex items-center justify-between text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            <span>
              {docs.length} document{docs.length > 1 ? "s" : ""} ·{" "}
              {totalChars.toLocaleString("fr-FR")} caractères
            </span>
            {docs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  void deleteAllDocs(docs.map((d) => d.id));
                  setDocs([]);
                }}
                className="underline transition-opacity hover:opacity-80"
              >
                Tout supprimer
              </button>
            )}
          </div>

          {docs.length === 0 ? (
            <div
              className="rounded-2xl border-2 px-4 py-8 text-center text-[14px]"
              style={{ color: "var(--muted)", borderColor: "var(--edge)" }}
            >
              Aucun document ajouté.
            </div>
          ) : (
            <ul className="space-y-2">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3"
                  style={{
                    borderColor: "var(--edge)",
                    background: "var(--surface)",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[14px]"
                      style={{ color: "var(--cream)" }}
                    >
                      {d.name}
                    </div>
                    <div
                      className="text-[11.5px]"
                      style={{ color: "var(--muted)" }}
                    >
                      {formatBytes(d.size)} ·{" "}
                      {d.text.length.toLocaleString("fr-FR")} caractères extraits
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(d.id)}
                    className="btn btn-secondary text-[14px]"
                    style={{
                      color: "var(--muted)",
                      borderColor: "var(--edge)",
                    }}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      </Section>
    </div>
  );
}