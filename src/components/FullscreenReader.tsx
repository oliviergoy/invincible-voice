import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const MIN_SCALE = 0.6;
const MAX_SCALE = 3;
const STEP = 1.2;

export default function FullscreenReader({
  text,
  onClose,
  labelClose,
  startRotated = true,
}: {
  text: string;
  onClose: () => void;
  labelClose: string;
  startRotated?: boolean;
}) {
  const [rotated, setRotated] = useState(startRotated);
  const [scale, setScale] = useState(1);
  const loadedRef = useRef(false);

  // Restore the user's saved text size and default rotation.
  useEffect(() => {
    void supabase
      .from("user_settings")
      .select("reader_scale,reader_rotated")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setScale(data.reader_scale || 1);
          if (!data.reader_rotated) setRotated(false);
        }
        loadedRef.current = true;
      });
  }, []);

  // Remember text size changes for next time.
  useEffect(() => {
    if (!loadedRef.current) return;
    const t = setTimeout(() => {
      void supabase.auth.getUser().then(({ data }) => {
        if (data.user)
          void supabase
            .from("user_settings")
            .upsert({ user_id: data.user.id, reader_scale: scale }, { onConflict: "user_id" });
      });
    }, 600);
    return () => clearTimeout(t);
  }, [scale]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") {
        setScale((s) => Math.min(MAX_SCALE, s * STEP));
      }
      if (e.key === "-" || e.key === "_") {
        setScale((s) => Math.max(MIN_SCALE, s / STEP));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const btnClass =
    "rounded-full border px-2.5 py-1.5 text-[13px] leading-none transition-opacity hover:opacity-80 sm:px-3 sm:py-2 sm:text-sm";
  const btnStyle = { borderColor: "var(--edge)", color: "var(--cream-soft)" };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto grid place-items-center px-4 pb-20 sm:px-16 sm:pb-16"
      style={{
        background: "var(--bg)",
        paddingTop: "calc(env(safe-area-inset-top) + 4.5rem)",
      }}
      onClick={onClose}
    >
      <div
        className="absolute right-3 z-10 flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-end gap-1.5 sm:gap-2"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setScale((s) => Math.max(MIN_SCALE, s / STEP));
          }}
          disabled={scale <= MIN_SCALE}
          className={`${btnClass} disabled:opacity-30`}
          style={btnStyle}
          title="Réduire le texte"
          aria-label="Réduire le texte"
        >
          A−
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setScale((s) => Math.min(MAX_SCALE, s * STEP));
          }}
          disabled={scale >= MAX_SCALE}
          className={`${btnClass} disabled:opacity-30`}
          style={btnStyle}
          title="Agrandir le texte"
          aria-label="Agrandir le texte"
        >
          A+
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setRotated((r) => !r);
          }}
          className={btnClass}
          style={btnStyle}
          title="Retourner le texte"
          aria-label="Retourner le texte à 180°"
        >
          ↻
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={btnClass}
          style={btnStyle}
          aria-label={labelClose}
        >
          {labelClose} ✕
        </button>
      </div>
      <div
        className="max-w-5xl text-center transition-transform duration-500 w-full"
        style={{
          color: "var(--cream)",
          fontSize: `calc(clamp(2.8rem, 10vw, 7rem) * ${scale})`,
          lineHeight: 1.4,
          fontWeight: 300,
          transform: rotated ? "rotate(180deg)" : "rotate(0deg)",
        }}
      >
        {text}
      </div>
    </div>
  );
}
