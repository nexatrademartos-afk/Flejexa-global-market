import { createFileRoute, Link } from "@tanstack/react-router";
import { AccountPage, accountHead } from "@/components/AccountPage";
import { Package, Truck, MessageCircle, ShoppingBag } from "lucide-react";
import { PlannedBadge } from "@/components/states";

export const Route = createFileRoute("/account/orders")({
  head: accountHead("Orders & Tracking", "Track your FleJexa Global Mart orders."),
  component: AccountOrdersPage,
});

function AccountOrdersPage() {
  return (
    <AccountPage
      title="Orders & Delivery Tracking"
      intro="Status and tracking for your marketplace orders."
    >
      <div className="space-y-4">
        <div className="surface rounded-2xl border p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-gold/40 bg-gold/10 text-gold">
                <Package className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-bold">In-App Order History</h2>
                <p className="text-xs text-muted-foreground">Order synchronization status</p>
              </div>
            </div>
            <PlannedBadge label="Planned" />
          </div>

          <div className="mt-5 space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Currently, product orders on FleJexa Global Mart are coordinated directly via verified{" "}
              <strong>WhatsApp order enquiries</strong> with the merchant team.
            </p>
            <p>
              Because WhatsApp messages are direct communications rather than automated backend
              transactions, they are not yet stored as synchronized in-app customer order records.
            </p>
            <p className="text-xs text-muted-foreground/80">
              Technical requirement: In-app customer order history requires an authenticated
              checkout pipeline that associates order records directly with your verified customer
              ID.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/account/cart" className="btn btn-primary inline-flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" /> View items in cart
            </Link>
            <Link to="/account/returns" className="btn border inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> Contact support for an existing enquiry
            </Link>
          </div>
        </div>

        <div className="surface rounded-2xl border p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-gold/40 bg-gold/10 text-gold">
                <Truck className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-bold">Courier & Delivery Tracking</h2>
                <p className="text-xs text-muted-foreground">Third-party logistics integration</p>
              </div>
            </div>
            <PlannedBadge label="Planned" />
          </div>

          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            Live delivery tracking requires verified integration with courier APIs. No simulated or
            dummy tracking numbers are shown here. For delivery updates regarding orders arranged
            via WhatsApp, please enquire directly with the merchant team.
          </p>
        </div>
      </div>
    </AccountPage>
  );
}
