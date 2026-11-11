import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TabNav } from "./dire";
import {
  loadDocs,
  addDoc,
  deleteDoc,
  deleteAllDocs,
  type KnowledgeDoc,
} from "@/lib/knowledge-store";
import { ProfileSettings } from "@/components/ProfileSettings";

export const Route = createFileRoute("/parametres")({
  component: ParametresPage,
});


async function extractPdf(file: File): Promise<string> {
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

  useEffect(() => {
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
            (err instanceof Error && err.message ? ` (${err.message})` : ""),
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
    <div className="mx-auto flex min-h-screen w-full max-w-[780px] flex-col px-5 pb-10 pt-10 sm:pt-14">
      <header className="flex flex-col items-center text-center">
        <h1
          className="font-display mt-5 text-[44px] sm:text-[56px] leading-[1.05]"
          style={{ fontWeight: 300, color: "var(--cream)" }}
        >
          <span style={{ color: "var(--gold)" }}>
            Paramètres
          </span>
        </h1>
        <p
          className="mt-4 max-w-[560px] text-sm sm:text-[15px]"
          style={{ color: "var(--muted)" }}
        >
          Votre voix, vos clés et vos documents sont enregistrés dans votre
          compte et vous suivent sur tous vos appareils.
        </p>
      </header>

      <TabNav />

      <ProfileSettings />

      <h2 className="font-display mt-12 text-[22px]" style={{ color: "var(--gold)" }}>
        Mes documents
      </h2>
      <div className="mt-4">
        <div
          className="rounded-2xl border p-6 text-center"
          style={{
            borderColor: "var(--edge)",
            background: "rgba(20,35,59,0.4)",
            borderStyle: "dashed",
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
            className="font-display rounded-full px-6 py-2.5 text-[14px] transition-opacity disabled:opacity-40"
            style={{ background: "var(--gold)", color: "var(--bg)" }}
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
            <div className="mt-3 text-[12.5px]" style={{ color: "#e8a87c" }}>
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
              className="font-display rounded-2xl border px-4 py-8 text-center text-[14px]"
              style={{ color: "var(--muted)", borderColor: "var(--edge)" }}
            >
              Aucun document ajouté.
            </div>
          ) : (
            <ul className="space-y-2">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
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
                    className="rounded-full border px-3 py-1 text-[12px] transition-opacity hover:opacity-80"
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
    </div>
  );
}