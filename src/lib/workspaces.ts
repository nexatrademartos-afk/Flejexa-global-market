// The eight core NEXA workspaces. No other dashboards exist; extra areas are modules.
export type WorkspaceKey =
  | "customer" | "partner" | "delivery" | "commission"
  | "admin" | "ceo" | "finance" | "security";

export type ModuleStatus = "planned" | "ui-only";

export interface Workspace {
  key: WorkspaceKey;
  name: string;
  short: string;
  description: string;
  access: string;
  modules: { name: string; note: string; status: ModuleStatus }[];
}

export const WORKSPACES: Workspace[] = [
  {
    key: "customer", name: "Customer", short: "CU",
    description: "Your orders, addresses, wishlist, rewards and settings.",
    access: "Granted to every signed-up account.",
    modules: [],
  },
  {
    key: "partner", name: "Business Partner", short: "BP",
    description: "Shops, brands and businesses selling under NEXA.",
    access: "Requires an approved business application.",
    modules: [
      { name: "Business profile & verification", note: "NEXA reviews and approves each business account.", status: "planned" },
      { name: "Product listings", note: "Each listing is reviewed by NEXA before going live.", status: "planned" },
      { name: "Fulfilment options", note: "Own fulfilment, NEXA pickup/delivery, NEXA warehouse or approved third-party courier.", status: "planned" },
      { name: "Orders & returns", note: "Orders routed to this partner.", status: "planned" },
      { name: "Payouts & statements", note: "Settled by Finance.", status: "planned" },
      { name: "B2B wholesale pricing", note: "Tiered pricing for business buyers.", status: "planned" },
    ],
  },
  {
    key: "delivery", name: "Delivery", short: "DL",
    description: "Assigned pickups, drop-offs and proof of delivery.",
    access: "Requires an approved delivery application.",
    modules: [
      { name: "Assigned jobs", note: "Pickups and drop-offs assigned by NEXA.", status: "planned" },
      { name: "Route & navigation", note: "Mobile-first route view.", status: "planned" },
      { name: "Proof of delivery", note: "Photo / code confirmation.", status: "planned" },
      { name: "Earnings history", note: "Shown only from verified records.", status: "planned" },
    ],
  },
  {
    key: "commission", name: "Commission Partner", short: "CP",
    description: "Referral links, attributed sales and commission statements.",
    access: "Requires an approved commission application.",
    modules: [
      { name: "Referral links", note: "Unique tracked links.", status: "planned" },
      { name: "Attributed orders", note: "Only confirmed, non-returned orders count.", status: "planned" },
      { name: "Commission statements", note: "Issued by Finance.", status: "planned" },
    ],
  },
  {
    key: "admin", name: "Administration", short: "AD",
    description: "Day-to-day operations of the marketplace.",
    access: "Staff only. Assigned by NEXA leadership.",
    modules: [
      { name: "Partner & listing approvals", note: "Review business accounts and products.", status: "planned" },
      { name: "Role applications", note: "Approve or reject delivery, partner, commission applications.", status: "planned" },
      { name: "Catalogue & categories", note: "", status: "planned" },
      { name: "Orders & returns", note: "", status: "planned" },
      { name: "Warehouse", note: "Module inside Administration.", status: "planned" },
      { name: "Suppliers", note: "Module inside Administration.", status: "planned" },
      { name: "Marketing & promotions", note: "Module inside Administration.", status: "planned" },
      { name: "Customer support", note: "Module inside Administration.", status: "planned" },
      { name: "Legal & policies", note: "Module inside Administration.", status: "planned" },
      { name: "Integrations", note: "Payments, couriers, messaging.", status: "planned" },
    ],
  },
  {
    key: "ceo", name: "CEO", short: "CE",
    description: "Executive overview and strategic controls.",
    access: "Owner / CEO only.",
    modules: [
      { name: "Business overview", note: "Built from real data once connected.", status: "planned" },
      { name: "Analytics", note: "Module inside CEO.", status: "planned" },
      { name: "AI assistants", note: "Module inside CEO. No AI output shown until connected.", status: "planned" },
      { name: "Staff & role assignment", note: "", status: "planned" },
      { name: "Expansion: multi-vendor & B2B", note: "", status: "planned" },
    ],
  },
  {
    key: "finance", name: "Finance", short: "FI",
    description: "Payments, payouts, commissions and reconciliation.",
    access: "Finance staff and the CEO only.",
    modules: [
      { name: "Payments ledger", note: "Read from the payment provider once connected.", status: "planned" },
      { name: "Partner payouts", note: "", status: "planned" },
      { name: "Commission settlement", note: "", status: "planned" },
      { name: "Refunds", note: "", status: "planned" },
      { name: "Tax & reports", note: "", status: "planned" },
    ],
  },
  {
    key: "security", name: "Security", short: "SE",
    description: "Access control, audit trails and fraud review.",
    access: "Security staff only.",
    modules: [
      { name: "Audit log", note: "", status: "planned" },
      { name: "Role & permission review", note: "", status: "planned" },
      { name: "Fraud & risk flags", note: "", status: "planned" },
      { name: "Session & device management", note: "", status: "planned" },
    ],
  },
];

export const getWorkspace = (key: string) => WORKSPACES.find((w) => w.key === key);
