import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];

function sbFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Verifies the caller's session and loads their personal settings. */
export async function getUserContext(
  request: Request,
): Promise<{ userId: string; settings: UserSettings | null } | Response> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!url || !key || token.split(".").length !== 3) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  const supabase = createClient<Database>(url, key, {
    global: { fetch: sbFetch(key), headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) return jsonResponse({ error: "unauthorized" }, 401);
  const { data: settings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return { userId, settings: settings ?? null };
}

type Msg = { role: "user" | "assistant"; content: string };

/** Calls the user's own Claude, ChatGPT or Mistral key. */
export async function callUserAI(
  settings: UserSettings | null,
  system: string,
  messages: Msg[],
  maxTokens: number,
): Promise<{ text: string } | { error: string; status: number }> {
  const aiKey = settings?.ai_key?.trim();
  if (!aiKey) return { error: "no_ai_key", status: 400 };

  if (settings?.ai_provider === "mistral") {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${aiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "mistral-large-latest",
        max_tokens: maxTokens,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    if (!r.ok) {
      console.error("Mistral error", r.status, await r.text());
      return { error: "ai_error", status: 502 };
    }
    const d = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { text: (d.choices?.[0]?.message?.content ?? "").trim() };
  }

  if (settings?.ai_provider === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${aiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.4",
        max_completion_tokens: maxTokens * 4,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    if (!r.ok) {
      console.error("OpenAI error", r.status, await r.text());
      return { error: "ai_error", status: 502 };
    }
    const d = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return { text: (d.choices?.[0]?.message?.content ?? "").trim() };
  }

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": aiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages }),
  });
  if (!r.ok) {
    console.error("Anthropic error", r.status, await r.text());
    return { error: "ai_error", status: 502 };
  }
  const d = (await r.json()) as { content?: Array<{ type: string; text?: string }> };
  return {
    text:
      d.content
        ?.filter((c) => c.type === "text" && c.text)
        .map((c) => c.text)
        .join("\n")
        .trim() ?? "",
  };
}
