export type KnowledgeDoc = {
  id: string;
  name: string;
  text: string;
  addedAt: number;
  size: number;
};

const KEY = "olivier.knowledge.docs.v1";
const MAX_TOTAL_CHARS = 120_000; // ~30k tokens safety cap

export function loadDocs(): KnowledgeDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as KnowledgeDoc[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveDocs(docs: KnowledgeDoc[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(docs));
}

export function buildExtraKnowledge(docs: KnowledgeDoc[]): string {
  if (!docs.length) return "";
  let total = 0;
  const parts: string[] = [];
  for (const d of docs) {
    const remaining = MAX_TOTAL_CHARS - total;
    if (remaining <= 200) break;
    const slice = d.text.length > remaining ? d.text.slice(0, remaining) : d.text;
    parts.push(`--- DOCUMENT : ${d.name} ---\n${slice}`);
    total += slice.length;
  }
  return parts.join("\n\n");
}

export function getExtraKnowledge(): string {
  return buildExtraKnowledge(loadDocs());
}