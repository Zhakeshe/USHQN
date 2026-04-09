-- Job applications & pipeline (status), work mode, company privacy, portfolio links,
-- onboarding snooze + stricter bonus criteria (profile depth + first action).

-- ---------------------------------------------------------------------------
-- Job application status + table
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.job_application_status AS ENUM (
    'submitted', 'viewed', 'replied', 'test_task', 'interview', 'accepted', 'rejected', 'withdrawn'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.job_application_status NOT NULL DEFAULT 'submitted',
  cv_url text,
  portfolio_url text,
  interview_slot timestamptz,
  owner_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, applicant_id)
);

CREATE INDEX IF NOT EXISTS job_applications_job_idx ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS job_applications_applicant_idx ON public.job_applications(applicant_id);

DROP TRIGGER IF EXISTS job_applications_updated_at ON public.job_applications;
CREATE TRIGGER job_applications_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_app_select ON public.job_applications;
CREATE POLICY job_app_select ON public.job_applications
  FOR SELECT TO authenticated
  USING (
    applicant_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.owner_id = auth.uid())
    OR public.current_is_admin()
  );

DROP POLICY IF EXISTS job_app_insert ON public.job_applications;
CREATE POLICY job_app_insert ON public.job_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    applicant_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id AND j.owner_id IS DISTINCT FROM auth.uid()
    )
  );

DROP POLICY IF EXISTS job_app_update ON public.job_applications;
CREATE POLICY job_app_update ON public.job_applications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.owner_id = auth.uid())
    OR public.current_is_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.owner_id = auth.uid())
    OR public.current_is_admin()
  );

-- ---------------------------------------------------------------------------
-- Jobs: work mode & optional company (hidden until applicant — enforced in app)
-- ---------------------------------------------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS work_mode text NOT NULL DEFAULT 'any';

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_work_mode_chk;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_work_mode_chk CHECK (work_mode IN ('any', 'remote', 'onsite', 'hybrid'));

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS company_name text;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS hide_company_until_applied boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.jobs.work_mode IS 'any | remote | onsite | hybrid';
COMMENT ON COLUMN public.jobs.hide_company_until_applied IS 'When true, company_name shown only to owner, admins, and applicants.';

-- ---------------------------------------------------------------------------
-- Profiles: portfolio JSON + onboarding snooze (vs permanent dismiss)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS portfolio_links jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_snoozed_until timestamptz;

COMMENT ON COLUMN public.profiles.portfolio_links IS 'Array of {label, url, kind?} (link | video); max length enforced in app.';
COMMENT ON COLUMN public.profiles.onboarding_snoozed_until IS 'Hide onboarding panel until this time (remind later).';

-- ---------------------------------------------------------------------------
-- Onboarding bonus: ~80% profile (5/6 signals) + first network action
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_onboarding_bonus()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_id uuid;
  prof record;
  profile_pts integer;
  has_skill boolean;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF prof.is_banned THEN
    RAISE EXCEPTION 'Account suspended';
  END IF;
  IF prof.onboarding_bonus_claimed THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profile_skills WHERE user_id = auth.uid() LIMIT 1
  ) INTO has_skill;

  profile_pts :=
    (CASE WHEN prof.headline IS NOT NULL AND length(trim(prof.headline)) > 0 THEN 1 ELSE 0 END)
    + (CASE WHEN prof.location IS NOT NULL AND length(trim(prof.location)) > 0 THEN 1 ELSE 0 END)
    + (CASE WHEN prof.school_or_org IS NOT NULL AND length(trim(prof.school_or_org)) > 0 THEN 1 ELSE 0 END)
    + (CASE WHEN prof.bio IS NOT NULL AND length(trim(prof.bio)) >= 20 THEN 1 ELSE 0 END)
    + (CASE WHEN prof.avatar_url IS NOT NULL AND length(trim(prof.avatar_url)) > 0 THEN 1 ELSE 0 END)
    + (CASE WHEN has_skill THEN 1 ELSE 0 END)
    + (CASE
         WHEN jsonb_typeof(prof.portfolio_links) = 'array' AND jsonb_array_length(prof.portfolio_links) > 0
         THEN 1 ELSE 0 END);

  IF profile_pts < 6 THEN
    RAISE EXCEPTION 'Complete your profile further — need at least 6 of 7 (headline, location, school/org, bio 20+ chars, photo, skill, portfolio link)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.achievements WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Add at least one achievement first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profile_interests WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Pick at least one interest first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE sender_id = auth.uid())
     AND NOT EXISTS (SELECT 1 FROM public.job_applications WHERE applicant_id = auth.uid()) THEN
    RAISE EXCEPTION 'Send a message or apply to a vacancy to finish onboarding';
  END IF;

  SELECT id INTO cat_id FROM public.achievement_categories WHERE slug = 'other' LIMIT 1;
  IF cat_id IS NULL THEN
    RAISE EXCEPTION 'Missing achievement category';
  END IF;

  INSERT INTO public.user_category_scores (user_id, category_id, points)
  VALUES (auth.uid(), cat_id, 50)
  ON CONFLICT (user_id, category_id)
  DO UPDATE SET points = public.user_category_scores.points + excluded.points;

  UPDATE public.profiles
  SET onboarding_bonus_claimed = true,
      onboarding_completed_at = now()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_onboarding_bonus() TO authenticated;
