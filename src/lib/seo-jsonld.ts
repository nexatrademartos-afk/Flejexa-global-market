/**
 * JSON-LD structured data built from BRAND + site URL.
 * Inject into public pages via a <script type="application/ld+json"> tag.
 * Do not hardcode brand strings here — update src/lib/brand.ts instead.
 */

import { BRAND } from "@/lib/brand";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

export type JsonLdObject = Record<string, unknown>;

/**
 * Organization + WebSite graph for the marketplace home page.
 * Helps Google and AI systems understand the brand entity.
 */
export function buildHomeJsonLd(): JsonLdObject {
  const siteUrl = getSiteUrl();
  const logoUrl = absoluteUrl(BRAND.logoPath);

  const organization: JsonLdObject = {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: BRAND.name,
    alternateName: [BRAND.shortName, "FJX", "FJX Global Mart"],
    url: siteUrl,
    logo: {
      "@type": "ImageObject",
      url: logoUrl,
    },
    description: BRAND.description,
    slogan: BRAND.tagline,
    telephone: BRAND.contact.phone,
    sameAs: [
      // Add official social profile URLs here when they exist, e.g.:
      // "https://www.facebook.com/flejexa",
      // "https://www.instagram.com/flejexa",
      // "https://www.linkedin.com/company/flejexa",
    ],
  };

  const website: JsonLdObject = {
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: BRAND.name,
    url: siteUrl,
    description: BRAND.description,
    publisher: { "@id": `${siteUrl}/#organization` },
    inLanguage: "en",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/shop?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return {
    "@context": "https://schema.org",
    "@graph": [organization, website],
  };
}

/** Serialize for embedding in HTML. */
export function jsonLdScriptContent(data: JsonLdObject): string {
  return JSON.stringify(data);
}
