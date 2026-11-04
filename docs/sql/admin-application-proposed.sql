-- =============================================================================
-- PROPOSED — NOT EXECUTED. Review first, run the inspection file first, then run
-- this in the Supabase SQL editor only after approval.
--
-- Purpose
--   * Allow customers to submit an Administration application (requested_role = 'admin').
--   * Keep applications writable only through review_role_application (no direct UPDATE).
--   * Only an authenticated CEO can approve or reject Administration applications.
--   * Admins can review partner, delivery and commission applications only.
--   * Approval of an Administration application assigns the 'admin' role atomically.
--   * Existing partner, delivery and commission rules are preserved.
--
-- Note: all existing policies on role_applications are replaced by the set below,
-- so the inspection output must be reviewed before running this file.
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

-- 3. Replace existing policies on role_applications with the reviewed set below.
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

-- 4. SELECT rules
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

-- 5. INSERT rules: applicant submits for themselves only, always as a clean pending application.
CREATE POLICY role_applications_insert_own
  ON public.role_applications FOR INSERT TO authenticated
  WITH CHECK (
    applicant_id = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND review_notes IS NULL
    AND requested_role::text IN ('partner', 'delivery', 'commission', 'admin')
    AND NOT public.nexa_current_user_has_role(requested_role)
  );

-- 6. Secure review function. Same name and signature as before, with stricter rules.
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

COMMIT;

-- =============================================================================
-- Post-run checks (read-only). Expected: policies listed above, constraint includes 'admin'.
-- =============================================================================
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'role_applications';
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'role_applications_requested_role_check';
