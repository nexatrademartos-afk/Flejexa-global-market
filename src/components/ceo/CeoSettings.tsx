import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchVerifiedNexaIdForUser } from "@/lib/customer-identity";
import { ROLE_LABELS } from "@/lib/ceo-dashboard";
import { Notice, Panel } from "./ceo-ui";

interface SettingsState {
  email: string | null;
  name: string | null;
  nexaId: string | null;
  roles: string[];
  loaded: boolean;
  error: boolean;
}

export function CeoSettings() {
  const navigate = useNavigate();
  const [state, setState] = useState<SettingsState>({ email: null, name: null, nexaId: null, roles: [], loaded: false, error: false });
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        if (active) setState((previous) => ({ ...previous, loaded: true, error: true }));
        return;
      }
      const [profile, roles, nexaId] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        fetchVerifiedNexaIdForUser(user.id),
      ]);
      if (!active) return;
      setState({
        email: user.email ?? null,
        name: profile.data?.full_name ?? (typeof user.user_metadata?.["full_name"] === "string" ? user.user_metadata["full_name"] : null),
        nexaId,
        roles: (roles.data ?? []).map((row) => row.role),
        loaded: true,
        error: Boolean(roles.error),
      });
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    await navigate({ to: "/sign-in" });
  }

  return (
    <div className="space-y-6">
      <Panel id="ceo-settings" title="CEO Settings" description="Your authenticated account details. Settings that change roles or account access aren't available here.">
        {!state.loaded && <p role="status" className="text-sm text-muted-foreground">Loading your account…</p>}
        {state.loaded && state.error && <Notice tone="red">Some account details couldn't be loaded. Refresh and try again.</Notice>}
        {state.loaded && (
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Name</dt><dd className="font-semibold">{state.name ?? "Not recorded"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">NEXA ID</dt><dd className="font-semibold">{state.nexaId ?? "Not verified"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Account email</dt><dd className="break-all">{state.email ?? "Not recorded"}</dd></div>
            <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Assigned roles</dt><dd>{state.roles.length ? state.roles.map((role) => ROLE_LABELS[role] ?? role).join(", ") : "None recorded"}</dd></div>
          </dl>
        )}
      </Panel>
      <Panel id="ceo-session" title="Session" description="Sign out of this device.">
        <button type="button" className="btn btn-outline min-h-11 w-fit text-sm" onClick={signOut} disabled={signingOut}>
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </Panel>
    </div>
  );
}
