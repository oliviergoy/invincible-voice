import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

const GOOGLE_G = (
  <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.820z"/><path fill="#34A853" d="M12 24c3.240 0 5.950-1.080 7.930-2.910l-3.860-3c-1.080.72-2.450 1.160-4.070 1.160-3.130 0-5.780-2.110-6.730-4.960H1.290v3.090C3.260 21.300 7.310 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data: d }) => setSession(d.session));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (session) return <>{children}</>;

  const signIn = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) setError("La connexion a échoué. Réessayez.");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1
        className="font-display text-[44px] sm:text-[56px] leading-[1.05] italic"
        style={{ fontWeight: 300, color: "var(--gold)" }}
      >
        Invincible Voice
      </h1>
      <p className="mt-4 max-w-[440px] text-[15px]" style={{ color: "var(--muted)" }}>
        Connectez-vous pour retrouver votre voix, vos documents et vos réglages.
      </p>
      <button
        type="button"
        onClick={() => void signIn()}
        className="mt-8 inline-flex items-center rounded-full border"
        style={{
          background: "#FFFFFF",
          borderColor: "#747775",
          color: "#1F1F1F",
          padding: "10px 16px 10px 12px",
          gap: 10,
          fontSize: 14,
          lineHeight: "20px",
          fontWeight: 500,
        }}
      >
        {GOOGLE_G}
        Continuer avec Google
      </button>
      {error && (
        <p className="mt-4 text-[13px]" style={{ color: "#e8a87c" }}>
          {error}
        </p>
      )}
    </div>
  );
}
