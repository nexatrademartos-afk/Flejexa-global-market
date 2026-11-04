-- READ-ONLY INSPECTION. Safe to run. Run this first and share the results.

-- 1. Current policies on the application and role tables
SELECT tablename, policyname, cmd, roles, qual AS using_clause, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('role_applications', 'user_roles')
ORDER BY tablename, policyname;

-- 2. Constraints on role_applications (confirms requested_role check)
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.role_applications'::regclass;

-- 3. Constraints on user_roles (confirms unique user/role handling)
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.user_roles'::regclass;

-- 4. Indexes on role_applications (confirms one-pending-per-role index)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'role_applications';

-- 5. RLS enabled?
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE oid IN ('public.role_applications'::regclass, 'public.user_roles'::regclass);

-- 6. Column types
SELECT table_name, column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('role_applications', 'user_roles')
ORDER BY table_name, ordinal_position;

-- 7. Existing function definitions
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('review_role_application', 'has_role', 'nexa_current_user_has_role');

-- 8. Table grants on role_applications
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'role_applications'
ORDER BY grantee, privilege_type;

-- 9. Your own roles (replace the email with your account email)
SELECT ur.role, ur.user_id
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE u.email = 'thulanijosephtjc@gmail.com';

-- 10. Policy record columns and CEO identity lookup (proposed in admin-application-proposed.sql)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'role_applications'
  AND column_name IN ('policy_version', 'policy_signatory_name', 'policy_acknowledgements', 'policy_accepted_at');

SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND proname IN ('get_admin_application_dossiers', 'nexa_enforce_admin_application_policy');

-- 11. Identity link used by the applicant form and the CEO lookup
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'nexa_person_identities'
  AND column_name IN ('person_code', 'user_id');
