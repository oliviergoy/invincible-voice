ALTER TABLE public.user_settings

  ADD COLUMN voice_provider text NOT NULL DEFAULT 'elevenlabs',

  ADD COLUMN gradium_key text NOT NULL DEFAULT '',

  ADD COLUMN gradium_voice_id text NOT NULL DEFAULT '';