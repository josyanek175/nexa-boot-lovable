ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS messages_external_id_unique ON public.messages(external_id) WHERE external_id IS NOT NULL;