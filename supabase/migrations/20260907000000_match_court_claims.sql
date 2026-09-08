-- A unique, transactional claim prevents simultaneous create/assign/unlock
-- requests from opening two matches on the same canonical court.
-- Existing duplicate matches are preserved; they can finish normally, but
-- prevent any new claim until the court is free.
BEGIN;

CREATE TABLE IF NOT EXISTS public.match_court_claims (
  court_key text PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE public.match_court_claims ENABLE ROW LEVEL SECURITY;

INSERT INTO public.match_court_claims(court_key, match_id)
SELECT DISTINCT ON (court_key) court_key, id
FROM (
  SELECT m.id, m.created_at,
    CASE WHEN COALESCE(m.court_id, c.id) IS NOT NULL
      THEN 'court:' || COALESCE(m.court_id, c.id)::text
      ELSE 'legacy:' || m.court_number::text END AS court_key
  FROM public.matches m
  LEFT JOIN public.courts c ON c.legacy_number = m.court_number
  WHERE m.is_completed = false AND (m.court_id IS NOT NULL OR m.court_number IS NOT NULL)
) active
ORDER BY court_key, created_at DESC, id
ON CONFLICT (court_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.guard_match_court_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  canonical_id uuid;
  canonical_number integer;
  claim_key text;
  claimed integer;
BEGIN
  IF NEW.is_completed IS DISTINCT FROM false THEN
    DELETE FROM public.match_court_claims WHERE match_id = NEW.id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_completed = false
    AND OLD.court_id IS NOT DISTINCT FROM NEW.court_id
    AND OLD.court_number IS NOT DISTINCT FROM NEW.court_number THEN
    RETURN NEW;
  END IF;

  canonical_id := NEW.court_id;
  canonical_number := NEW.court_number;
  IF canonical_id IS NOT NULL THEN
    SELECT legacy_number INTO canonical_number FROM public.courts WHERE id = canonical_id;
    NEW.court_number := canonical_number;
  ELSIF canonical_number IS NOT NULL THEN
    SELECT id INTO canonical_id FROM public.courts WHERE legacy_number = canonical_number LIMIT 1;
    NEW.court_id := canonical_id;
  END IF;

  -- Existing duplicates remain editable: only entering/re-entering/changing a
  -- court requires a new claim. Ordinary score updates do not touch the claim.
  IF TG_OP = 'UPDATE' AND OLD.is_completed = false
    AND OLD.court_id IS NOT DISTINCT FROM NEW.court_id
    AND OLD.court_number IS NOT DISTINCT FROM NEW.court_number THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.match_court_claims WHERE match_id = NEW.id;
  IF canonical_id IS NULL AND canonical_number IS NULL THEN RETURN NEW; END IF;
  claim_key := CASE WHEN canonical_id IS NOT NULL THEN 'court:' || canonical_id::text
    ELSE 'legacy:' || canonical_number::text END;

  IF EXISTS (
    SELECT 1 FROM public.matches m WHERE m.id <> NEW.id AND m.is_completed = false
      AND ((canonical_id IS NOT NULL AND m.court_id = canonical_id)
        OR (canonical_number IS NOT NULL AND m.court_number = canonical_number))
  ) THEN RAISE EXCEPTION 'court_occupied' USING ERRCODE = '23505'; END IF;

  INSERT INTO public.match_court_claims(court_key, match_id) VALUES(claim_key, NEW.id)
    ON CONFLICT (court_key) DO UPDATE SET match_id = EXCLUDED.match_id
      WHERE public.match_court_claims.match_id = EXCLUDED.match_id;
  GET DIAGNOSTICS claimed = ROW_COUNT;
  IF claimed = 0 THEN RAISE EXCEPTION 'court_occupied' USING ERRCODE = '23505'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_court_claim_guard ON public.matches;
CREATE TRIGGER match_court_claim_guard
BEFORE INSERT OR UPDATE OF court_id, court_number, is_completed ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.guard_match_court_claim();
COMMIT;
