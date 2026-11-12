export type PolicyId =
  | "terms"
  | "privacy"
  | "buyer-returns"
  | "delivery"
  | "seller"
  | "delivery-partner"
  | "acceptable-use"
  | "digital-products"
  | "complaints"
  | "cookies";

export type PolicyContext =
  | "customer-registration"
  | "seller-application"
  | "delivery-application"
  | "checkout";

export type PolicyStatus = "draft" | "review-required";

export interface PolicyDocument {
  id: PolicyId;
  title: string;
  version: string;
  status: PolicyStatus;
  summary: string;
  sections: { heading: string; body: string }[];
}

export const POLICY_REGISTRY: Record<PolicyId, PolicyDocument> = {
  terms: {
    id: "terms",
    title: "Terms of Service",
    version: "1.0.0-draft",
    status: "review-required",
    summary: "General rules for using FleJexa Global Mart.",
    sections: [
      {
        heading: "Platform status",
        body:
          "FleJexa Global Mart is being developed as a marketplace for physical and digital products from FleJexa and independent sellers. Features marked as preview or coming soon are not active services. Do not treat a preview cart as a confirmed order.",
      },
      {
        heading: "Accounts and eligibility",
        body:
          "Users must provide accurate information and protect their sign-in credentials. Seller, delivery and commission roles require the relevant application and approval. Minimum-age rules and guardian arrangements require legal review before launch.",
      },
      {
        heading: "Orders and payments",
        body:
          "Payment methods, order confirmation, seller settlements, commissions and delivery options depend on the services actually enabled and the information disclosed before an order. A pending or failed payment is not a confirmed payment.",
      },
      {
        heading: "Marketplace conduct",
        body:
          "Users must not use FleJexa Global Mart for unlawful activity, fraud, scams, counterfeit or stolen goods, or other prohibited listings. FleJexa may investigate reports and restrict content or accounts for serious or repeated violations, subject to applicable law.",
      },
      {
        heading: "Disputes and legal rights",
        body:
          "FleJexa may review available evidence when handling marketplace disputes. Nothing in these terms removes consumer protections or other rights that cannot lawfully be excluded. Applicable law, dispute processes and the legal entity operating the platform require legal review.",
      },
      {
        heading: "Changes and support",
        body:
          "Material policy changes will be communicated before taking effect where practicable or legally required. Users may contact FleJexa support through the support channels published on the live platform. Exact contact details must be configured before launch.",
      },
    ],
  },

  privacy: {
    id: "privacy",
    title: "Privacy Policy",
    version: "1.0.0-draft",
    status: "review-required",
    summary: "How account, transaction and delivery information is handled.",
    sections: [
      {
        heading: "Information",
        body:
          "The platform may process account and contact details, order and transaction information, delivery details, support messages and information needed to operate and protect marketplace services.",
      },
      {
        heading: "Use and sharing",
        body:
          "Information should be used for account administration, order fulfilment, support, security, legal obligations and other purposes disclosed at collection. It may be shared with service providers only where needed for an authorised platform purpose and subject to applicable requirements.",
      },
      {
        heading: "Retention and requests",
        body:
          "Retention periods, deletion workflows, privacy request procedures, international transfers, security incident response and the responsible privacy contact still require configuration and legal review. Account closure does not necessarily remove records that must lawfully be retained.",
      },
      {
        heading: "Your choices",
        body:
          "This privacy acknowledgement is not consent to optional marketing. Any optional marketing consent must be separate, specific, unselected by default and accompanied by an appropriate opt-out method.",
      },
    ],
  },

  "buyer-returns": {
    id: "buyer-returns",
    title: "Buyer, Returns and Refunds Policy",
    version: "1.0.0-draft",
    status: "review-required",
    summary: "Order problems, cancellations, returns and refunds.",
    sections: [
      {
        heading: "Order problems",
        body:
          "Buyers can report orders that were not received, arrived damaged or defective, or materially differ from their descriptions. FleJexa may review information from the buyer, seller and delivery provider before deciding an appropriate resolution.",
      },
      {
        heading: "Cancellations and returns",
        body:
          "Cancellation may be possible before an order is processed or dispatched. Eligible physical products may be returned subject to disclosed conditions and applicable law. Product-specific exclusions and return instructions must be published before checkout.",
      },
      {
        heading: "Refunds",
        body:
          "Refund requests are reviewed according to the circumstances, the applicable policy and mandatory consumer law. Where possible, an approved refund is returned through the original payment method. Payment-provider timing and the final refund workflow remain to be configured.",
      },
      {
        heading: "Statutory rights",
        body:
          "This draft does not limit consumer rights or remedies that cannot lawfully be excluded or restricted.",
      },
    ],
  },

  delivery: {
    id: "delivery",
    title: "Delivery and Shipping Policy",
    version: "1.0.0-draft",
    status: "review-required",
    summary: "Delivery charges, tracking, delays and fulfilment.",
    sections: [
      {
        heading: "Fulfilment",
        body:
          "Fulfilment responsibility may depend on the seller, the delivery arrangement and the order. Applicable delivery charges and available options should be displayed before checkout.",
      },
      {
        heading: "Tracking and delays",
        body:
          "Tracking may be provided when available. For lost, delayed or disputed deliveries, FleJexa may review the available order and delivery evidence and determine an appropriate resolution under the applicable policy and law.",
      },
      {
        heading: "Not yet finalised",
        body:
          "Delivery providers, service areas, cross-border availability, delivery estimates, liability allocation and claims procedures require configuration and legal review. No delivery time is promised by this draft.",
      },
    ],
  },

  seller: {
    id: "seller",
    title: "Seller Agreement",
    version: "1.0.0-draft",
    status: "review-required",
    summary: "Requirements for businesses and independent sellers.",
    sections: [
      {
        heading: "Seller responsibilities",
        body:
          "Sellers must provide accurate product descriptions, images, prices and availability, and must fulfil accepted orders according to the arrangements disclosed to buyers. Sellers must comply with applicable law and must not list illegal, counterfeit or stolen goods.",
      },
      {
        heading: "Verification and listing review",
        body:
          "Sellers must complete the verification and approval process configured by FleJexa. Verification document requirements, review timelines and the detailed approval process must be finalised before seller onboarding goes live.",
      },
      {
        heading: "Fees and settlement",
        body:
          "FleJexa may charge a commission or other fees only under terms disclosed to the seller. Commission rates, payment-provider arrangements, payout schedules, reserves and dispute-related holds must be agreed and published before the seller service goes live.",
      },
      {
        heading: "Complaints and enforcement",
        body:
          "FleJexa may review buyer complaints and seller evidence. Serious or repeated violations may result in listing restrictions, suspension or termination, subject to applicable law and any applicable review process.",
      },
    ],
  },

  "delivery-partner": {
    id: "delivery-partner",
    title: "Delivery Partner Agreement",
    version: "1.0.0-draft",
    status: "review-required",
    summary: "Draft requirements for delivery partners.",
    sections: [
      {
        heading: "Assignments and conduct",
        body:
          "Delivery partners will be expected to handle assigned pickups and deliveries responsibly, protect customer information, follow applicable safety requirements and submit accurate delivery evidence where required.",
      },
      {
        heading: "Compensation and responsibility",
        body:
          "Eligibility, verification, insurance, compensation, payment schedules, incident reporting and allocation of responsibility must be finalised and disclosed before delivery partner applications or assignments become active.",
      },
    ],
  },

  "acceptable-use": {
    id: "acceptable-use",
    title: "Acceptable Use and Prohibited Listings",
    version: "1.0.0-draft",
    status: "review-required",
    summary: "Conduct and listing standards for marketplace users.",
    sections: [
      {
        heading: "Prohibited conduct",
        body:
          "Users must not use the platform for fraud, scams, unlawful activity, stolen goods, counterfeit goods or other listings prohibited by applicable law. Users must not manipulate reviews, misrepresent products or misuse another person's account or information.",
      },
      {
        heading: "Reports and action",
        body:
          "FleJexa may investigate reported listings and account activity, request relevant information and restrict or remove content or access for serious or repeated violations. Users may ask support to review a restriction. Detailed reporting and intellectual-property complaint procedures require finalisation.",
      },
    ],
  },

  "digital-products": {
    id: "digital-products",
    title: "Digital Products Policy",
    version: "1.0.0-draft",
    status: "review-required",
    summary: "Digital delivery, licence information and digital-product issues.",
    sections: [
      {
        heading: "Product information and licences",
        body:
          "Sellers should clearly state the digital product's contents, technical requirements, delivery method and applicable licence or usage rights before purchase.",
      },
      {
        heading: "Access problems and refunds",
        body:
          "Buyers may report missing access, corrupted files or other genuine product problems. Requests will be reviewed under the applicable refund terms and mandatory law. Delivery methods, access timelines, licence enforcement and product-specific conditions require finalisation before digital sales go live.",
      },
    ],
  },

  complaints: {
    id: "complaints",
    title: "Complaints and Appeals",
    version: "1.0.0-draft",
    status: "review-required",
    summary: "How complaints, disputes and account restrictions are reviewed.",
    sections: [
      {
        heading: "Contact and review",
        body:
          "Users may contact FleJexa support to report an issue. FleJexa aims to respond within two business days, but this is a target rather than a guaranteed resolution deadline. A complaint may require further investigation or evidence from other parties.",
      },
      {
        heading: "Appeals and external remedies",
        body:
          "Users may ask support to review account or listing restrictions. Internal review does not remove a person's right to use any external complaint, regulator, court or other remedy available under applicable law.",
      },
      {
        heading: "Support details",
        body:
          "The official support email, form and live messaging channels must be configured and verified before launch. Do not use placeholder contact details as if they were active.",
      },
    ],
  },

  cookies: {
    id: "cookies",
    title: "Cookies and Tracking",
    version: "1.0.0-draft",
    status: "review-required",
    summary: "Cookies, analytics and similar technologies.",
    sections: [
      {
        heading: "Configuration required",
        body:
          "The technologies used for essential operation, analytics, advertising and other tracking must be audited before this policy is finalised. This draft does not assert which cookies or tracking technologies are currently enabled.",
      },
      {
        heading: "Choices",
        body:
          "Where required by law, non-essential cookies or tracking must not run before valid consent, and users must be given an appropriate way to change or withdraw their choices. The actual consent controls and retention details require implementation and legal review.",
      },
    ],
  },
};

export function getPoliciesForContext(
  context: PolicyContext,
): PolicyDocument[] {
  const policyIds: Record<PolicyContext, PolicyId[]> = {
    "customer-registration": ["terms", "privacy"],
    "seller-application": [
      "terms",
      "privacy",
      "seller",
      "acceptable-use",
    ],
    "delivery-application": [
      "terms",
      "privacy",
      "delivery-partner",
    ],
    checkout: [
      "terms",
      "privacy",
      "buyer-returns",
      "delivery",
      "digital-products",
    ],
  };

  return policyIds[context].map((id) => POLICY_REGISTRY[id]);
}

export function getPolicyHref(policyId: PolicyId): string {
  return `/policies#${policyId}`;
}

export interface PolicyAcceptanceEvidence {
  policy_id: PolicyId;
  policy_version: string;
  accepted_at: string;
  action: "agree_and_continue" | "acknowledge_privacy";
  source: PolicyContext;
}

export function createPolicyAcceptanceEvidence(
  context: PolicyContext,
  acceptedAt: string = new Date().toISOString(),
): PolicyAcceptanceEvidence[] {
  return getPoliciesForContext(context).map((policy) => ({
    policy_id: policy.id,
    policy_version: policy.version,
    accepted_at: acceptedAt,
    action:
      policy.id === "privacy"
        ? "acknowledge_privacy"
        : "agree_and_continue",
    source: context,
  }));
}
