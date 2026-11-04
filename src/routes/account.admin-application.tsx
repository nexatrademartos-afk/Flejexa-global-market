import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AccountPage, accountHead } from "@/components/AccountPage";
import { supabase } from "@/integrations/supabase/client";
import {
  APPLICATION_STATUS_COPY,
  DECLARATIONS,
  DEPARTMENTS,
  FIELD_LIMITS,
  applicationReference,
  buildApplicationMessage,
  emptyAdminApplicationForm,
  hasErrors,
  validateAdminApplication,
  type AdminApplicationErrors,
  type AdminApplicationForm,
  type DeclarationKey,
} from "@/lib/admin-application";

type ApplicationRecord = {
  id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  review_notes: string | null;
  reviewed_at: string | null;
};

type Phase = "loading" | "signed-out" | "error" | "ready";

export const Route = createFileRoute("/account/admin-application")({
  head: accountHead(
    "Administration employment application",
    "Apply for an Administration role at NEXA. Applications are reviewed by authorised executive leadership.",
  ),
  component: AdminApplicationPage,
});

function AdminApplicationPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [hasAdminRole, setHasAdminRole] = useState(false);
  const [existing, setExisting] = useState<ApplicationRecord | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [form, setForm] = useState<AdminApplicationForm>(emptyAdminApplicationForm);
  const [errors, setErrors] = useState<AdminApplicationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submittingRef = useRef(false);

  const load = useCallback(async () => {
    setPhase("loading");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setPhase("signed-out");
      return;
    }

    const uid = authData.user.id;
    const [profileResult, rolesResult, applicationResult] = await Promise.all([
      supabase.from("profiles").select("full_name, email, phone").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase
        .from("role_applications")
        .select("id, status, created_at, review_notes, reviewed_at")
        .eq("applicant_id", uid)
        .eq("requested_role", "admin")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    if (profileResult.error || rolesResult.error || applicationResult.error) {
      console.error("Administration application load failed:", {
        profileError: profileResult.error,
        rolesError: rolesResult.error,
        applicationError: applicationResult.error,
      });
      setPhase("error");
      return;
    }

    setHasAdminRole((rolesResult.data ?? []).some((row) => row.role === "admin"));
    setExisting((applicationResult.data?.[0] ?? null) as ApplicationRecord | null);

    // Prefill only fields the applicant has not filled in. Existing profile data is never overwritten.
    const profile = profileResult.data;
    const nameParts = (profile?.full_name ?? "").trim().split(/\s+/).filter(Boolean);
    setForm((current) => ({
      ...current,
      firstName: current.firstName || nameParts[0] || "",
      surname: current.surname || nameParts.slice(1).join(" "),
      email: current.email || profile?.email || authData.user.email || "",
      phone: current.phone || profile?.phone || "",
    }));
    setPhase("ready");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function update<K extends keyof AdminApplicationForm>(key: K, value: AdminApplicationForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function toggleDeclaration(key: DeclarationKey, checked: boolean) {
    setForm((current) => ({
      ...current,
      declarations: { ...current.declarations, [key]: checked },
    }));
    setErrors((current) => ({ ...current, declarations: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    setSubmitError("");

    const nextErrors = validateAdminApplication(form);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      document.getElementById("admin-application-errors")?.focus();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setPhase("signed-out");
        return;
      }

      const submittedAt = new Date().toISOString();
      const { data, error } = await supabase
        .from("role_applications")
        .insert({
          applicant_id: authData.user.id,
          requested_role: "admin",
          application_message: buildApplicationMessage(form, submittedAt),
          status: "pending",
          reviewed_by: null,
          reviewed_at: null,
          review_notes: null,
        })
        .select("id, status, created_at, review_notes, reviewed_at")
        .single();

      if (error) {
        console.error("Administration application submission failed:", error);
        if (error.code === "23505") {
          setSubmitError("You already have a pending Administration application. Refresh this page to see its status.");
          await load();
        } else if (error.code === "42501") {
          setSubmitError("This account can't submit an Administration application. Sign in with the account you want to use for NEXA.");
        } else if (error.code === "23514") {
          setSubmitError("Administration applications aren't available for this account right now.");
        } else {
          setSubmitError("Your application could not be submitted. Please try again. If this continues, contact NEXA support.");
        }
        return;
      }

      setExisting(data as ApplicationRecord);
      setJustSubmitted(true);
      setForm(emptyAdminApplicationForm());
      setErrors({});
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const showForm =
    phase === "ready" &&
    !hasAdminRole &&
    !justSubmitted &&
    (!existing || existing.status === "rejected");

  return (
    <AccountPage
      title="NEXA GLOBAL MART — Administration employment application"
      intro="Thank you for your interest in joining the NEXA Administration team. Please complete this application carefully. All applications are reviewed by authorised executive leadership. Submitting an application does not guarantee employment or grant Administration access."
    >
      {phase === "loading" && (
        <p role="status" className="text-sm text-muted-foreground">
          Checking your account and application status...
        </p>
      )}

      {phase === "signed-out" && (
        <section className="surface rounded-xl border border-gold/30 p-5">
          <h2 className="font-semibold">Sign in to apply</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You need to sign in before you can submit or check an Administration application.
          </p>
          <Link to="/sign-in" className="btn btn-primary mt-4">
            Sign in
          </Link>
        </section>
      )}

      {phase === "error" && (
        <section role="alert" className="rounded-xl border border-red-500/40 p-5 text-sm">
          <p>We couldn't load your application status. Please try again. If this continues, contact NEXA support.</p>
          <button type="button" className="btn btn-outline mt-3" onClick={() => void load()}>
            Try again
          </button>
        </section>
      )}

      {phase === "ready" && hasAdminRole && (
        <section className="surface rounded-xl border border-gold/30 p-5">
          <h2 className="font-semibold">Your account already has Administration access</h2>
          <p className="mt-1 text-sm text-muted-foreground">No further application is needed.</p>
          <Link to="/workspace/$role" params={{ role: "admin" }} className="btn btn-primary mt-4">
            Open Administration workspace
          </Link>
        </section>
      )}

      {phase === "ready" && !hasAdminRole && justSubmitted && existing && (
        <section role="status" className="surface rounded-xl border border-gold/40 p-5 text-sm">
          <h2 className="font-semibold">Your Administration application has been submitted successfully.</h2>
          <p className="mt-2">
            Your application is now awaiting executive review. You will be able to check its status from your account.
            Submitting an application does not grant Administration access.
          </p>
          <ApplicationSummary application={existing} />
        </section>
      )}

      {phase === "ready" && !hasAdminRole && !justSubmitted && existing && existing.status !== "rejected" && (
        <section className="surface rounded-xl p-5">
          <h2 className="font-semibold">Your Administration application</h2>
          <ApplicationSummary application={existing} />
          {existing.status === "approved" && (
            <p className="mt-3 text-sm">
              Your application was approved. Your Administration role should appear in your access records. If the
              Administration workspace still doesn't open, contact NEXA support.
            </p>
          )}
        </section>
      )}

      {phase === "ready" && !hasAdminRole && !justSubmitted && existing?.status === "rejected" && (
        <section className="surface rounded-xl p-5 text-sm">
          <h2 className="font-semibold">Your previous application was not approved</h2>
          <ApplicationSummary application={existing} />
          <p className="mt-2 text-muted-foreground">You may submit a new application below.</p>
        </section>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} noValidate className="space-y-6" aria-busy={submitting}>
          {hasErrors(errors) && (
            <div
              id="admin-application-errors"
              role="alert"
              tabIndex={-1}
              className="rounded-lg border border-red-500/40 p-3 text-sm"
            >
              Please correct the highlighted fields before submitting.
            </div>
          )}

          {submitError && (
            <div role="alert" className="rounded-lg border border-red-500/40 p-3 text-sm">
              {submitError}
            </div>
          )}

          <FormSection title="A. Applicant information">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="firstName" label="First name" value={form.firstName} error={errors.firstName} max={FIELD_LIMITS.name} onChange={(v) => update("firstName", v)} />
              <TextField id="surname" label="Surname" value={form.surname} error={errors.surname} max={FIELD_LIMITS.name} onChange={(v) => update("surname", v)} />
              <TextField id="email" label="Email address" type="email" value={form.email} error={errors.email} max={FIELD_LIMITS.email} onChange={(v) => update("email", v)} />
              <TextField id="phone" label="Contact phone number" type="tel" value={form.phone} error={errors.phone} max={FIELD_LIMITS.phone} onChange={(v) => update("phone", v)} />
              <TextField id="city" label="City" value={form.city} error={errors.city} max={FIELD_LIMITS.place} onChange={(v) => update("city", v)} />
              <TextField id="province" label="Province" value={form.province} error={errors.province} max={FIELD_LIMITS.place} onChange={(v) => update("province", v)} />
            </div>
          </FormSection>

          <FormSection title="B. Position information">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="adminRole" label="Administration role" hint="The Administration role you are applying for." value={form.adminRole} error={errors.adminRole} max={FIELD_LIMITS.adminRole} onChange={(v) => update("adminRole", v)} />
              <Field id="department" label="Preferred department or area of responsibility" error={errors.department}>
                <select
                  id="department"
                  className="field w-full"
                  value={form.department}
                  aria-invalid={Boolean(errors.department)}
                  aria-describedby={errors.department ? "department-error" : undefined}
                  onChange={(e) => update("department", e.target.value)}
                >
                  <option value="">Choose one</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Field>
            </div>
            {form.department === "Other" && (
              <TextField id="departmentOther" label="Describe the area you prefer" value={form.departmentOther} error={errors.departmentOther} max={FIELD_LIMITS.departmentOther} onChange={(v) => update("departmentOther", v)} />
            )}
            <p className="text-xs text-muted-foreground">
              A department preference does not give access to any individual module.
            </p>
          </FormSection>

          <FormSection title="C. Experience and suitability">
            <TextArea id="experience" label="Previous employment or relevant experience" value={form.experience} error={errors.experience} max={FIELD_LIMITS.experience} onChange={(v) => update("experience", v)} />
            <TextArea id="skills" label="Relevant skills" value={form.skills} error={errors.skills} max={FIELD_LIMITS.skills} onChange={(v) => update("skills", v)} />
            <TextArea id="reason" label="Reason for applying" value={form.reason} error={errors.reason} max={FIELD_LIMITS.reason} onChange={(v) => update("reason", v)} />
            <TextArea id="contribution" label="What you believe you can contribute to NEXA" value={form.contribution} error={errors.contribution} max={FIELD_LIMITS.contribution} onChange={(v) => update("contribution", v)} />
            <TextArea id="availability" label="Availability and expected working schedule" value={form.availability} error={errors.availability} max={FIELD_LIMITS.availability} onChange={(v) => update("availability", v)} />
          </FormSection>

          <FormSection title="D. Declarations and agreements">
            <p className="text-sm text-muted-foreground">
              Please read each statement. All statements must be confirmed. Read the{" "}
              <Link to="/policies" className="text-gold underline">NEXA policies</Link> before you agree.
            </p>
            <fieldset className="space-y-3" aria-describedby={errors.declarations ? "declarations-error" : undefined}>
              <legend className="sr-only">Declarations</legend>
              {DECLARATIONS.map((d) => (
                <label key={d.key} className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={form.declarations[d.key]}
                    onChange={(e) => toggleDeclaration(d.key, e.target.checked)}
                  />
                  <span>{d.text}</span>
                </label>
              ))}
            </fieldset>
            {errors.declarations && (
              <p id="declarations-error" className="text-xs text-red-400">{errors.declarations}</p>
            )}
          </FormSection>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit application"}
            </button>
            <p className="text-xs text-muted-foreground">
              Submitting does not grant Administration access. Only authorised executive approval can do that.
            </p>
          </div>
        </form>
      )}
    </AccountPage>
  );
}

function ApplicationSummary({ application }: { application: ApplicationRecord }) {
  return (
    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">Reference</dt>
        <dd className="font-semibold">{applicationReference(application.id)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Submitted</dt>
        <dd>{new Date(application.created_at).toLocaleDateString()}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Status</dt>
        <dd>{APPLICATION_STATUS_COPY[application.status]}</dd>
      </div>
      {application.status === "rejected" && application.review_notes && (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Review note</dt>
          <dd>{application.review_notes}</dd>
        </div>
      )}
    </dl>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface space-y-4 rounded-xl p-5">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string | undefined; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children}
      {error && <p id={`${id}-error`} className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function TextField({
  id, label, value, error, hint, max, type = "text", onChange,
}: {
  id: string; label: string; value: string; error?: string | undefined; hint?: string | undefined; max: number; type?: string; onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label} error={error}>
      <input
        id={id}
        type={type}
        className="field w-full"
        value={value}
        maxLength={max}
        autoComplete={id === "email" ? "email" : id === "phone" ? "tel" : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    </Field>
  );
}

function TextArea({
  id, label, value, error, max, onChange,
}: {
  id: string; label: string; value: string; error?: string | undefined; max: number; onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label} error={error}>
      <textarea
        id={id}
        className="field min-h-24 w-full"
        value={value}
        maxLength={max}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : `${id}-count`}
        onChange={(e) => onChange(e.target.value)}
      />
      <p id={`${id}-count`} className="text-right text-xs text-muted-foreground">{value.length}/{max}</p>
    </Field>
  );
}
