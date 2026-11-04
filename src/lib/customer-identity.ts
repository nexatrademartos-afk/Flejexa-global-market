import { supabase } from "@/integrations/supabase/client";

/**
 * Reads the signed-in customer's canonical identity code via the existing RLS-protected table.
 * Returns null when no readable identity exists or the request fails, so callers can fall back safely.
 */
export async function fetchCanonicalCustomerCode(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("nexa_person_identities")
      .select("person_code")
      .limit(1)
      .maybeSingle();

    if (error || !data?.person_code) return null;
    return data.person_code.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Returns the canonical NEXA ID linked to one specific authenticated account (nexa_person_identities.user_id).
 * The account id must come from the authenticated session. Returns null when the identity cannot be verified.
 */
export async function fetchVerifiedNexaIdForUser(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from("nexa_person_identities")
      .select("person_code")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data?.person_code) return null;
    return data.person_code.trim() || null;
  } catch {
    return null;
  }
}
