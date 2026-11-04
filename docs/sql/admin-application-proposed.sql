-- =============================================================================
-- PROPOSED — NOT EXECUTED. Review first. Run docs/sql/admin-application-inspect.sql
-- first, share the output, then run this file in the Supabase SQL editor ONLY after approval.
--
-- Purpose
--   * Allow any registered account to submit an Administration application (requested_role = 'admin').
--     Holding another role (including Admin or CEO) does not block submission.
--   * Store the Administration policy record: version, typed signature and the seven acknowledgements.
--     The database sets policy_accepted_at itself. Client values for it are ignored.
--   * Keep applications writable only through review_role_application (no direct UPDATE).
--   * Only an authenticated CEO can approve or reject Administration applications.
--   * Admins can review partner, delivery and commission applications only.
--   * Approval of an Administration application assigns the 'admin' role atomically.
--   * Provide a CEO-only lookup for verified applicant identity (NEXA ID, auth email, registration date).
--   * Existing partner, delivery and commission rules are preserved.
--
-- Note: all existing policies on role_applications are replaced by the set below,
-- so the inspection output must be reviewed before running this file.
-- Contract for the frontend: docs/admin-application-contract.md
-- =============================================================================

BEGIN;

-- 1. Helper: does the signed-in user hold a role? Used by policies and the review function.
CREATE OR REPLACE FUNCTION public.nexa_current_user_has_role(p_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = p_role
  );
$$;

REVOKE ALL ON FUNCTION public.nexa_current_user_has_role(public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nexa_current_user_has_role(public.app_role) TO authenticated;

-- 2. Allow 'admin' as a requested role; keep the existing three roles.
ALTER TABLE public.role_applications
  DROP CONSTRAINT IF EXISTS role_applications_requested_role_check;

ALTER TABLE public.role_applications
  ADD CONSTRAINT role_applications_requested_role_check
  CHECK (requested_role::text IN ('partner', 'delivery', 'commission', 'admin'));

-- 3. Policy record columns (no-op if they already exist).
ALTER TABLE public.role_applications
  ADD COLUMN IF NOT EXISTS policy_version text,
  ADD COLUMN IF NOT EXISTS policy_signatory_name text,
  ADD COLUMN IF NOT EXISTS policy_acknowledgements jsonb,
  ADD COLUMN IF NOT EXISTS policy_accepted_at timestamptz;

-- 4. Trigger: validates the Administration policy record and sets the acceptance time in the database.
CREATE OR REPLACE FUNCTION public.nexa_enforce_admin_application_policy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_required_keys text[] := ARRAY[
    'information_accurate', 'not_employment_offer', 'confidentiality',
    'no_credential_sharing', 'security_and_privacy', 'access_revocable', 'consent_to_review'
  ];
  v_key text;
BEGIN
  IF NEW.requested_role::text <> 'admin' THEN
    RETURN NEW;
  END IF;

  -- Authoritative acceptance time is generated here. Any client-supplied value is discarded.
  NEW.policy_accepted_at := now();

  IF NEW.policy_version IS DISTINCT FROM 'nexa-admin-application-v1' THEN
    RAISE EXCEPTION 'Administration policy version is not accepted' USING ERRCODE = '23514';
  END IF;

  IF NEW.policy_signatory_name IS NULL
     OR length(btrim(NEW.policy_signatory_name)) < 2
     OR length(NEW.policy_signatory_name) > 120 THEN
    RAISE EXCEPTION 'A typed signature is required' USING ERRCODE = '23514';
  END IF;

  IF NEW.policy_acknowledgements IS NULL OR jsonb_typeof(NEW.policy_acknowledgements) <> 'object' THEN
    RAISE EXCEPTION 'Policy acknowledgements are required' USING ERRCODE = '23514';
  END IF;

  FOREACH v_key IN ARRAY v_required_keys LOOP
    IF (NEW.policy_acknowledgements ->> v_key) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'All policy acknowledgements are required' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nexa_admin_application_policy ON public.role_applications;
CREATE TRIGGER nexa_admin_application_policy
  BEFORE INSERT ON public.role_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.nexa_enforce_admin_application_policy();

-- 5. Replace policies on role_applications with the reviewed set below.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'role_applications'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.role_applications', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.role_applications ENABLE ROW LEVEL SECURITY;

-- Direct UPDATE is removed for all client roles. Reviews go through review_role_application only.
REVOKE UPDATE ON public.role_applications FROM anon, authenticated;

-- 6. SELECT rules
-- Applicants see their own applications.
CREATE POLICY role_applications_select_own
  ON public.role_applications FOR SELECT TO authenticated
  USING (applicant_id = auth.uid());

-- CEO sees every application, including Administration applications.
CREATE POLICY role_applications_select_ceo
  ON public.role_applications FOR SELECT TO authenticated
  USING (public.nexa_current_user_has_role('ceo'::public.app_role));

-- Admin sees partner, delivery and commission applications only, never Administration applications.
CREATE POLICY role_applications_select_admin_non_admin_requests
  ON public.role_applications FOR SELECT TO authenticated
  USING (
    public.nexa_current_user_has_role('admin'::public.app_role)
    AND requested_role::text <> 'admin'
  );

-- 7. INSERT rules: applicant submits for themselves only, always as a clean pending application.
-- Holding another role does not block submission. Approval is still CEO-only for Administration.
CREATE POLICY role_applications_insert_own
  ON public.role_applications FOR INSERT TO authenticated
  WITH CHECK (
    applicant_id = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND review_notes IS NULL
    AND requested_role::text IN ('partner', 'delivery', 'commission', 'admin')
  );

-- 8. Secure review function. Same name and signature as before, with stricter rules.
CREATE OR REPLACE FUNCTION public.review_role_application(
  p_application_id uuid,
  p_decision text,
  p_review_notes text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reviewer uuid := auth.uid();
  v_app public.role_applications%ROWTYPE;
  v_notes text := NULLIF(btrim(COALESCE(p_review_notes, '')), '');
BEGIN
  IF v_reviewer IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected' USING ERRCODE = '22023';
  END IF;

  IF v_notes IS NOT NULL AND length(v_notes) > 500 THEN
    RAISE EXCEPTION 'Review note is too long' USING ERRCODE = '22001';
  END IF;

  -- Lock the row so two reviewers cannot decide the same application at once.
  SELECT * INTO v_app
  FROM public.role_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending applications can be reviewed' USING ERRCODE = '55000';
  END IF;

  IF v_app.applicant_id = v_reviewer THEN
    RAISE EXCEPTION 'You cannot review your own application' USING ERRCODE = '42501';
  END IF;

  IF v_app.requested_role = 'admin'::public.app_role THEN
    IF NOT public.nexa_current_user_has_role('ceo'::public.app_role) THEN
      RAISE EXCEPTION 'Only the CEO can review Administration applications' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT (
      public.nexa_current_user_has_role('ceo'::public.app_role)
      OR public.nexa_current_user_has_role('admin'::public.app_role)
    ) THEN
      RAISE EXCEPTION 'Only authorised NEXA reviewers can review this application' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.role_applications
  SET status = p_decision,
      reviewed_by = v_reviewer,
      reviewed_at = now(),
      review_notes = v_notes,
      updated_at = now()
  WHERE id = v_app.id;

  -- Administration approval assigns the role in the same transaction. Duplicates are prevented.
  IF p_decision = 'approved' AND v_app.requested_role = 'admin'::public.app_role THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT v_app.applicant_id, 'admin'::public.app_role
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_app.applicant_id
        AND ur.role = 'admin'::public.app_role
    );
  END IF;

  RETURN p_decision;
END;
$$;

REVOKE ALL ON FUNCTION public.review_role_application(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_role_application(uuid, text, text) TO authenticated;

-- 9. CEO-only applicant identity lookup for pending Administration applications.
-- Returns only the fields the review panel needs. It does not expose auth.users or identity tables directly.
CREATE OR REPLACE FUNCTION public.get_admin_application_dossiers(p_application_ids uuid[])
RETURNS TABLE (
  application_id uuid,
  applicant_id uuid,
  nexa_id text,
  account_email text,
  account_created_at timestamptz,
  account_confirmed_at timestamptz,
  profile_full_name text,
  profile_phone text,
  assigned_roles text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.nexa_current_user_has_role('ceo'::public.app_role) THEN
    RAISE EXCEPTION 'Only the CEO can view Administration applicant records' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ra.id,
    ra.applicant_id,
    (SELECT npi.person_code::text FROM public.nexa_person_identities npi WHERE npi.user_id = ra.applicant_id LIMIT 1),
    u.email::text,
    u.created_at,
    u.email_confirmed_at,
    p.full_name::text,
    p.phone::text,
    COALESCE(
      (SELECT array_agg(ur.role::text ORDER BY ur.role::text) FROM public.user_roles ur WHERE ur.user_id = ra.applicant_id),
      ARRAY[]::text[]
    )
  FROM public.role_applications ra
  LEFT JOIN auth.users u ON u.id = ra.applicant_id
  LEFT JOIN public.profiles p ON p.id = ra.applicant_id
  WHERE ra.id = ANY (p_application_ids)
    AND ra.requested_role = 'admin'::public.app_role;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_application_dossiers(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_application_dossiers(uuid[]) TO authenticated;

COMMIT;

-- =============================================================================
-- Post-run checks (read-only). Expected: policies listed above, constraint includes 'admin',
-- policy columns present, trigger present and the CEO lookup function present.
-- =============================================================================
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'role_applications';
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'role_applications_requested_role_check';
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.role_applications'::regclass AND NOT tgisinternal;
-- SELECT proname FROM pg_proc WHERE proname IN ('review_role_application', 'get_admin_application_dossiers');
