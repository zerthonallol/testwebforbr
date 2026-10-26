CREATE TABLE public.players (
  tg_id bigint PRIMARY KEY,
  first_name text NOT NULL DEFAULT '',
  username text,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE INDEX players_username_idx ON public.players (lower(username));

CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1,
  price_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  announcement text,
  announcement_id text,
  announcement_by bigint,
  maintenance boolean NOT NULL DEFAULT false,
  maintenance_text text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings are public" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.app_settings (id) VALUES (1);

CREATE TABLE public.pending_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tg_id bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('coins','case')),
  amount bigint NOT NULL DEFAULT 0,
  case_id text,
  note text,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.pending_grants TO service_role;
ALTER TABLE public.pending_grants ENABLE ROW LEVEL SECURITY;
CREATE INDEX pending_grants_open_idx ON public.pending_grants (tg_id) WHERE claimed_at IS NULL;

CREATE TABLE public.promo_codes (
  code text PRIMARY KEY,
  coins bigint NOT NULL CHECK (coins > 0),
  max_uses int NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  uses int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.promo_redemptions (
  code text NOT NULL REFERENCES public.promo_codes(code) ON DELETE CASCADE,
  tg_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, tg_id)
);
GRANT ALL ON public.promo_redemptions TO service_role;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.redeem_promo(_code text, _tg_id bigint)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.promo_codes;
BEGIN
  SELECT * INTO r FROM public.promo_codes WHERE code = upper(_code) FOR UPDATE;
  IF NOT FOUND OR NOT r.active THEN RAISE EXCEPTION 'Промокод не найден'; END IF;
  IF r.uses >= r.max_uses THEN RAISE EXCEPTION 'Промокод закончился'; END IF;
  BEGIN
    INSERT INTO public.promo_redemptions (code, tg_id) VALUES (r.code, _tg_id);
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Ты уже активировал этот промокод';
  END;
  UPDATE public.promo_codes SET uses = uses + 1 WHERE code = r.code;
  RETURN r.coins;
END $$;
REVOKE ALL ON FUNCTION public.redeem_promo(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo(text, bigint) TO service_role;

CREATE TABLE public.live_drops (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tg_id bigint NOT NULL,
  user_name text NOT NULL,
  brainrot_id text NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.live_drops TO service_role;
ALTER TABLE public.live_drops ENABLE ROW LEVEL SECURITY;
CREATE INDEX live_drops_created_idx ON public.live_drops (created_at DESC);