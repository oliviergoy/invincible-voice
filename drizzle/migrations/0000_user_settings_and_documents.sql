CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  voice_id text NOT NULL DEFAULT '',
  elevenlabs_key text NOT NULL DEFAULT '',
  ai_provider text NOT NULL DEFAULT 'anthropic',
  ai_key text NOT NULL DEFAULT '',
  reader_rotated boolean NOT NULL DEFAULT true,
  reader_scale real NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  text text NOT NULL,
  size integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_documents TO authenticated;
GRANT ALL ON public.user_documents TO service_role;
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own docs" ON public.user_documents FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);