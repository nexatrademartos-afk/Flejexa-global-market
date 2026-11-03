/**
 * Picks the customer code to display. The canonical identity code (nexa_person_identities.person_code)
 * always wins; profiles.customer_code is only a fallback when no identity record is readable.
 */
export function resolveCustomerCode(
  canonicalCode: string | null | undefined,
  legacyProfileCode: string | null | undefined,
): string {
  const canonical = canonicalCode?.trim();
  if (canonical) return canonical;
  return legacyProfileCode?.trim() || "";
}
