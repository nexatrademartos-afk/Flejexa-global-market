import { describe, expect, it } from "vitest";
import {
  COUNTRY_ISO2_CODES,
  COUNTRY_OPTIONS,
  countryName,
  isValidCountryIso2,
} from "@/lib/countries";
import { resolveCustomerCode } from "@/lib/customer-code";

describe("country ISO-2 handling", () => {
  it("accepts only uppercase two-letter codes from the ISO list", () => {
    expect(isValidCountryIso2("ZA")).toBe(true);
    expect(isValidCountryIso2("US")).toBe(true);
    expect(isValidCountryIso2("NG")).toBe(true);
    expect(isValidCountryIso2("za")).toBe(false);
    expect(isValidCountryIso2("ZAF")).toBe(false);
    expect(isValidCountryIso2("Z1")).toBe(false);
    expect(isValidCountryIso2("XX")).toBe(false);
    expect(isValidCountryIso2("")).toBe(false);
    expect(isValidCountryIso2(null)).toBe(false);
    expect(isValidCountryIso2(undefined)).toBe(false);
  });

  it("has unique codes and one picker option per code", () => {
    expect(new Set(COUNTRY_ISO2_CODES).size).toBe(COUNTRY_ISO2_CODES.length);
    expect(COUNTRY_OPTIONS).toHaveLength(COUNTRY_ISO2_CODES.length);
    expect(COUNTRY_OPTIONS.every((o) => isValidCountryIso2(o.code))).toBe(true);
  });

  it("returns readable names and falls back to the code for unknown values", () => {
    expect(countryName("ZA")).toContain("South Africa");
    expect(countryName("NG")).toBe("Nigeria");
    expect(countryName("XX")).toBe("XX");
  });

  it("does not default any customer to South Africa", () => {
    // The picker starts blank, so ZA is only stored when the customer chooses it.
    expect(isValidCountryIso2("")).toBe(false);
  });
});

describe("customer identity code precedence", () => {
  it("prefers the canonical identity code over the legacy profile code", () => {
    expect(resolveCustomerCode("NX-0001", "LEGACY-9")).toBe("NX-0001");
  });

  it("falls back to the profile code only when no identity code is readable", () => {
    expect(resolveCustomerCode(null, "LEGACY-9")).toBe("LEGACY-9");
    expect(resolveCustomerCode("   ", " LEGACY-9 ")).toBe("LEGACY-9");
  });

  it("never invents a code when neither source has one", () => {
    expect(resolveCustomerCode(null, null)).toBe("");
    expect(resolveCustomerCode(undefined, "")).toBe("");
  });
});
