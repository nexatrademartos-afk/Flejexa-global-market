# Administration application contract

Status: the frontend is ready. The database parts are PROPOSED in `docs/sql/admin-application-proposed.sql` and are not installed until that file is reviewed and approved. Until then the applicant form can't insert the policy record and the CEO panel shows applicant identity as not verified.

There is no OpenAPI or Swagger documentation in this repository. This document is the only API reference for these contracts.

## 1. Applicant submission: `role_applications` insert

Sent by the signed-in applicant. The applicant id is read from the authenticated session, never from the form or URL.

| Field | Value |
| --- | --- |
| `applicant_id` | Authenticated user's UUID |
| `requested_role` | `admin` |
| `application_message` | Labelled application summary (form answers, declarations, typed signature) |
| `status` | `pending` |
| `reviewed_by`, `reviewed_at`, `review_notes` | `null` |
| `policy_version` | `nexa-admin-application-v1` |
| `policy_signatory_name` | The applicant's typed full legal name, whitespace normalised |
| `policy_acknowledgements` | JSON object with all seven keys set to `true` (see below) |

The browser never sends `policy_accepted_at`. The database trigger sets it with `now()`.

### Required acknowledgement keys

| On-screen declaration | Key |
| --- | --- |
| The information I have submitted is accurate and complete. | `information_accurate` |
| I understand this is an application, not an offer of employment. | `not_employment_offer` |
| I understand approval is subject to executive review. | `consent_to_review` |
| I will keep NEXA business and customer information confidential. | `confidentiality` |
| I will not share my credentials or access internal information without authorisation. | `no_credential_sharing` |
| I will follow NEXA security, privacy, acceptable-use and workplace policies. | `security_and_privacy` |
| I understand Administration access may be suspended or revoked if authorisation is withdrawn. | `access_revocable` |

### Database rules (proposed)

- The insert policy requires `applicant_id = auth.uid()` and a clean pending row.
- A trigger rejects any Administration application where the version, signature or any of the seven keys is missing or not `true` (error `23514`).
- Holding another role, including Admin or CEO, does not block submission.
- A duplicate pending Administration application is rejected by the existing one-pending-per-role unique index (error `23505`).

## 2. CEO identity lookup: `get_admin_application_dossiers` (PROPOSED)

Called by the CEO review panel with the ids of the pending Administration applications on screen.

- Arguments: `p_application_ids uuid[]`
- Returns one row per matching Administration application: `application_id`, `applicant_id`, `nexa_id`, `account_email`, `account_created_at`, `account_confirmed_at`, `profile_full_name`, `profile_phone`, `assigned_roles`.
- Authorisation: `SECURITY DEFINER`. It raises `42501` unless `auth.uid()` holds the `ceo` role. Anonymous and ordinary users are denied by `REVOKE` and by the check.
- Sources: `nexa_person_identities.person_code` (where `user_id` is the applicant), `auth.users` (email, created and confirmed timestamps), `profiles`, and `user_roles`. No table is opened to the browser.

The frontend matches each row to the application by `application_id` and also requires `applicant_id` to equal the application's `applicant_id`. Any mismatch, or a missing NEXA ID or email, means the identity is shown as not verified. Approval is then disabled for that application.

Error handling in the panel:

| Error | Shown as |
| --- | --- |
| `42501` | CEO access couldn't be confirmed. Identity details are hidden. |
| `42883` / `PGRST202` | Lookup not installed yet. Approval stays disabled. |
| Other | Identity couldn't be loaded. Approval stays disabled. |

## 3. Review decision: `review_role_application` (existing)

Parameters: `p_application_id`, `p_decision` (`approved` or `rejected`), optional `p_review_notes` (max 500).

- Administration applications: CEO only. Admins are denied.
- Self-review is denied.
- Only pending applications can be decided.
- Approval assigns the `admin` role in the same transaction, without duplicates.
- Direct `UPDATE` on `role_applications` is revoked from `anon` and `authenticated` (proposed).

## 4. Applicant status

The applicant sees their own row through the existing own-row select policy. Their NEXA ID comes from `nexa_person_identities` where `user_id` is their own account. Nothing is sent by email, SMS or push; the page does not claim a notification was sent.
