import { supabase } from "@/integrations/supabase/client";

/** fetch() that attaches the signed-in user's session to our own API routes. */
export async function authFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session) headers.set("authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}

export const ERROR_HINTS: Record<string, string> = {
  no_ai_key: "Ajoutez votre clé Claude ou ChatGPT dans les Paramètres (⚙).",
  no_voice: "Ajoutez votre clé et votre voix ElevenLabs dans les Paramètres (⚙).",
};
