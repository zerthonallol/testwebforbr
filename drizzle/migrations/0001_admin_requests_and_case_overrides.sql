ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS case_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.pending_grants ADD COLUMN IF NOT EXISTS brainrot_id text;
ALTER TABLE public.pending_grants DROP CONSTRAINT IF EXISTS pending_grants_kind_check;
ALTER TABLE public.pending_grants ADD CONSTRAINT pending_grants_kind_check CHECK (kind IN ('coins','case','brainrot'));

CREATE TABLE public.transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  tg_id bigint NOT NULL,
  user_name text NOT NULL DEFAULT '',
  type text NOT NULL CHECK (type IN ('deposit','withdraw')),
  brainrot_id text NOT NULL,
  roblox_nick text NOT NULL,
  credit_as text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (tg_id, client_id)
);
GRANT ALL ON public.transfer_requests TO service_role;
ALTER TABLE public.transfer_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX transfer_requests_status_idx ON public.transfer_requests (status, created_at DESC);