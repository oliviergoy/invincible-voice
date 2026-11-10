import { supabase } from "@/integrations/supabase/client";

export type KnowledgeDoc = {
  id: string;
  name: string;
  text: string;
  addedAt: number;
  size: number;
};

const MAX_TOTAL_CHARS = 120_000; // ~30k tokens safety cap

export async function loadDocs(): Promise<KnowledgeDoc[]> {
  const { data } = await supabase
    .from("user_documents")
    .select("id,name,text,size,created_at")
    .order("created_at");
  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    text: d.text,
    size: d.size,
    addedAt: new Date(d.created_at).getTime(),
  }));
}

export async function addDoc(doc: { name: string; text: string; size: number }) {
  const { error } = await supabase.from("user_documents").insert(doc);
  if (error) throw error;
}

export async function deleteDoc(id: string) {
  await supabase.from("user_documents").delete().eq("id", id);
}

export async function deleteAllDocs(ids: string[]) {
  if (ids.length) await supabase.from("user_documents").delete().in("id", ids);
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

export async function getExtraKnowledge(): Promise<string> {
  return buildExtraKnowledge(await loadDocs());
}
