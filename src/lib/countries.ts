// ISO 3166-1 alpha-2 country codes (officially assigned codes).
// Used by the delivery address form and stored in customer_addresses.country_iso2.
export const COUNTRY_ISO2_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ " +
  "BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ " +
  "DE DJ DK DM DO DZ " +
  "EC EE EG EH ER ES ET " +
  "FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY " +
  "HK HM HN HR HT HU " +
  "ID IE IL IM IN IO IQ IR IS IT " +
  "JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ " +
  "LA LB LC LI LK LR LS LT LU LV LY " +
  "MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ " +
  "NA NC NE NF NG NI NL NO NP NR NU NZ " +
  "OM " +
  "PA PE PF PG PH PK PL PM PN PR PS PT PW PY " +
  "QA " +
  "RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ " +
  "TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
  "UA UG UM US UY UZ " +
  "VA VC VE VG VI VN VU " +
  "WF WS " +
  "YE YT " +
  "ZA ZM ZW"
).split(" ");

const CODE_SET = new Set<string>(COUNTRY_ISO2_CODES);
const ISO2_PATTERN = /^[A-Z]{2}$/;

/** True only for uppercase two-letter codes present in the ISO 3166-1 list. */
export function isValidCountryIso2(code: string | null | undefined): code is string {
  return typeof code === "string" && ISO2_PATTERN.test(code) && CODE_SET.has(code);
}

let displayNames: Intl.DisplayNames | null = null;

/** English display name for an ISO-2 code; returns the code itself if it cannot be resolved. */
export function countryName(code: string): string {
  if (!isValidCountryIso2(code)) return code;
  try {
    displayNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Select options for the country picker, sorted by English name. */
export const COUNTRY_OPTIONS: ReadonlyArray<{ code: string; name: string }> = COUNTRY_ISO2_CODES.map(
  (code) => ({ code, name: countryName(code) }),
).sort((a, b) => a.name.localeCompare(b.name));
